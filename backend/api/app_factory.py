from __future__ import annotations

from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import date as date_cls

from fastapi import FastAPI
from sqlalchemy import inspect, text
from fastapi.middleware.cors import CORSMiddleware

from api.error_handlers import register_exception_handlers
from api.routers import budgets, categories, health, insights, plaid, statements, transactions


def _ensure_stored_transaction_balance_column(engine) -> None:
    if not str(engine.url).startswith("sqlite"):
        return
    insp = inspect(engine)
    if not insp.has_table("stored_transactions"):
        return
    cols = {c["name"] for c in insp.get_columns("stored_transactions")}
    if "balance_after" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE stored_transactions ADD COLUMN balance_after FLOAT"))


def _ensure_stored_transaction_line_fingerprint(engine) -> None:
    """Add unique line fingerprint for global dedupe; backfill and dedupe existing rows (SQLite)."""
    if not str(engine.url).startswith("sqlite"):
        return
    insp = inspect(engine)
    if not insp.has_table("stored_transactions"):
        return
    cols = {c["name"] for c in insp.get_columns("stored_transactions")}
    if "line_fingerprint" in cols:
        return

    from services.transaction_fingerprint import line_fingerprint_digest_from_stored

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE stored_transactions ADD COLUMN line_fingerprint VARCHAR(64)"))

    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT id, posted_date, amount, description FROM stored_transactions")
        ).fetchall()
        by_digest: dict[str, list[int]] = defaultdict(list)
        for rid, pdate, amt, desc in rows:
            if isinstance(pdate, str):
                pdate = date_cls.fromisoformat(pdate)
            d = line_fingerprint_digest_from_stored(pdate, float(amt), str(desc or ""))
            by_digest[d].append(int(rid))
        for _d, ids in by_digest.items():
            ids.sort()
            for extra_id in ids[1:]:
                conn.execute(text("DELETE FROM stored_transactions WHERE id = :id"), {"id": extra_id})
        rows2 = conn.execute(
            text("SELECT id, posted_date, amount, description FROM stored_transactions")
        ).fetchall()
        for rid, pdate, amt, desc in rows2:
            if isinstance(pdate, str):
                pdate = date_cls.fromisoformat(pdate)
            fp = line_fingerprint_digest_from_stored(pdate, float(amt), str(desc or ""))
            conn.execute(
                text("UPDATE stored_transactions SET line_fingerprint = :fp WHERE id = :id"),
                {"fp": fp, "id": int(rid)},
            )

    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_stored_transactions_line_fingerprint "
                "ON stored_transactions(line_fingerprint)"
            )
        )


def _ensure_stored_transaction_merchant_key(engine) -> None:
    """Indexed normalized description for learn-from-history categorization (SQLite)."""
    if not str(engine.url).startswith("sqlite"):
        return
    insp = inspect(engine)
    if not insp.has_table("stored_transactions"):
        return
    cols = {c["name"] for c in insp.get_columns("stored_transactions")}
    if "merchant_key" in cols:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_stored_transactions_merchant_key "
                    "ON stored_transactions(merchant_key)"
                )
            )
        return

    from services.transaction_fingerprint import normalize_description

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE stored_transactions ADD COLUMN merchant_key VARCHAR(512)"))

    with engine.begin() as conn:
        rows = conn.execute(text("SELECT id, description FROM stored_transactions")).fetchall()
        for rid, desc in rows:
            mk = normalize_description(str(desc or ""))
            conn.execute(
                text("UPDATE stored_transactions SET merchant_key = :mk WHERE id = :id"),
                {"mk": mk, "id": int(rid)},
            )

    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_stored_transactions_merchant_key "
                "ON stored_transactions(merchant_key)"
            )
        )


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        from data.models import (  # noqa: F401
            BudgetDefault,
            MonthlyBudget,
            PlaidItem,
            StatementUpload,
            StoredTransaction,
        )
        from db import Base, engine

        _ = (BudgetDefault, MonthlyBudget, PlaidItem, StatementUpload, StoredTransaction)
        Base.metadata.create_all(bind=engine)
        _ensure_stored_transaction_balance_column(engine)
        _ensure_stored_transaction_line_fingerprint(engine)
        _ensure_stored_transaction_merchant_key(engine)
        yield

    app = FastAPI(title="Expense Tracker API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    app.include_router(health.router, prefix="/api")
    app.include_router(categories.router, prefix="/api")
    app.include_router(budgets.router, prefix="/api")
    app.include_router(statements.router, prefix="/api")
    app.include_router(transactions.router, prefix="/api")
    app.include_router(insights.router, prefix="/api")
    app.include_router(plaid.router, prefix="/api")

    return app
