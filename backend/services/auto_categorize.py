"""Hybrid auto-categorization: rules first, then learn-from-history, else UNCATEGORIZED."""

from __future__ import annotations

from sqlalchemy import case, desc, func, select
from sqlalchemy.orm import Session

from categories import (
    PATCH_CATEGORY_VALUES,
    SURPLUS_LEFTOVER_SUB,
    SURPLUS_PRIMARY_KEY,
)
from data.models.statement import StoredTransaction
from services.categorization_rules import match_rules
from services.transaction_fingerprint import normalize_description

_EFF_CATEGORY = case(
    (
        StoredTransaction.category == SURPLUS_PRIMARY_KEY,
        func.coalesce(StoredTransaction.surplus_subcategory, SURPLUS_LEFTOVER_SUB),
    ),
    else_=StoredTransaction.category,
)


def history_suggest(session: Session, merchant_key: str) -> str | None:
    """Most frequent non-UNCATEGORIZED category for this merchant_key; ties → most recent row."""
    if not merchant_key:
        return None
    cnt = func.count().label("cnt")
    last_date = func.max(StoredTransaction.posted_date).label("last_date")
    last_id = func.max(StoredTransaction.id).label("last_id")
    stmt = (
        select(_EFF_CATEGORY, cnt, last_date, last_id)
        .where(StoredTransaction.merchant_key == merchant_key)
        .where(StoredTransaction.deleted_at.is_(None))
        .where(StoredTransaction.category != "UNCATEGORIZED")
        .group_by(_EFF_CATEGORY)
        .order_by(desc(cnt), desc(last_date), desc(last_id))
        .limit(1)
    )
    row = session.execute(stmt).first()
    if row is None:
        return None
    cat = row[0]
    return cat if cat in PATCH_CATEGORY_VALUES else None


def classify(session: Session, description: str, amount: float) -> str:
    merchant_key = normalize_description(description)
    ruled = match_rules(merchant_key, amount)
    if ruled is not None and ruled in PATCH_CATEGORY_VALUES:
        return ruled
    hist = history_suggest(session, merchant_key)
    if hist is not None:
        return hist
    return "UNCATEGORIZED"
