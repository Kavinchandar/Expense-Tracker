from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class LinkTokenResponse(BaseModel):
    link_token: str


class ExchangeBody(BaseModel):
    public_token: str = Field(..., min_length=1)


class PlaidStatusResponse(BaseModel):
    connected: bool
    institution_name: Optional[str] = None


class TransactionsResponse(BaseModel):
    year: int
    month: int
    month_total: float
    total_inflow: float
    total_outflow: float
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    buckets: List[dict]
    display_timezone: str


class UploadStatementResponse(BaseModel):
    ok: bool
    upload_id: int
    parsed_count: int
    skipped_duplicates: int = 0
    replaced_count: int = 0


class CategoryBody(BaseModel):
    category: str = Field(..., min_length=1, max_length=128)


class CategoriesResponse(BaseModel):
    categories: List[str]
    labels: Dict[str, str]


class BudgetsResponse(BaseModel):
    year: int
    month: int
    budgets: Dict[str, float]


class BudgetsPutBody(BaseModel):
    budgets: Dict[str, float] = Field(default_factory=dict)


class PlaidExchangeResponse(BaseModel):
    ok: bool
    institution_name: Optional[str] = None


class InsightsResponse(BaseModel):
    insights: str
