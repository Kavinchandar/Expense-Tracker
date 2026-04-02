from __future__ import annotations

from fastapi import APIRouter

from api.schemas import CategoriesResponse
from categories import EXPENSE_CATEGORIES

router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=CategoriesResponse)
def list_categories():
    return CategoriesResponse(categories=list(EXPENSE_CATEGORIES))
