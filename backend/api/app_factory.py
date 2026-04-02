from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.error_handlers import register_exception_handlers
from api.routers import categories, health, plaid, statements, transactions


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        from data.models import PlaidItem, StatementUpload, StoredTransaction  # noqa: F401
        from db import Base, engine

        _ = (PlaidItem, StatementUpload, StoredTransaction)
        Base.metadata.create_all(bind=engine)
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
    app.include_router(statements.router, prefix="/api")
    app.include_router(transactions.router, prefix="/api")
    app.include_router(plaid.router, prefix="/api")

    return app
