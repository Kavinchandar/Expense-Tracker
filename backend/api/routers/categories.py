from __future__ import annotations

from fastapi import APIRouter

from api.schemas import CategoriesResponse
from categories import (
    API_ALL_ASSIGNABLE_KEYS,
    BUCKET_LABELS,
    EXPENSE_CATEGORY_KEYS,
    SURPLUS_CATEGORY_KEYS,
)

router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=CategoriesResponse)
def list_categories():
    return CategoriesResponse(
        categories=list(API_ALL_ASSIGNABLE_KEYS),
        expense_categories=list(EXPENSE_CATEGORY_KEYS),
        surplus_categories=list(SURPLUS_CATEGORY_KEYS),
        labels=dict(BUCKET_LABELS),
    )
