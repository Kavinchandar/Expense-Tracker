from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from data.models import MonthlyBudget  # noqa: F401
from db import Base


@pytest.fixture
def memory_engine(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    import db as db_module

    monkeypatch.setattr(db_module, "engine", engine)
    monkeypatch.setattr(db_module, "SessionLocal", session_factory)

    yield engine


@pytest.fixture
def client(memory_engine):
    from fastapi.testclient import TestClient

    from api.app_factory import create_app

    app = create_app()
    with TestClient(app) as tc:
        yield tc
