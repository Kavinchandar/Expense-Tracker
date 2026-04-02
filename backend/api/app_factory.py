from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import inspect, text
from fastapi.middleware.cors import CORSMiddleware

from api.error_handlers import register_exception_handlers
from api.routers import budgets, categories, health, plaid, statements, transactions


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


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        from data.models import (  # noqa: F401
            MonthlyBudget,
            PlaidItem,
            StatementUpload,
            StoredTransaction,
        )
        from db import Base, engine

        _ = (MonthlyBudget, PlaidItem, StatementUpload, StoredTransaction)
        Base.metadata.create_all(bind=engine)
        _ensure_stored_transaction_balance_column(engine)
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
    app.include_router(plaid.router, prefix="/api")

    return app
