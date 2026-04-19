from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


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


class InsightsResponse(BaseModel):
    insights: str


class UsdInrResponse(BaseModel):
    usd_to_inr: float
    as_of_date: str = ""


class YearlyInsightsResponse(BaseModel):
    year: int
    total_inflow: float
    total_outflow: float
    gross_movement: float
    net_flow: float
    inflow_pct_of_gross: float
    outflow_pct_of_gross: float
    total_worth: Optional[float] = None


class SurplusBudgetsResponse(BaseModel):
    year: int
    month: int
    budgets: Dict[str, float]


class SurplusBudgetsPutBody(BaseModel):
    budgets: Dict[str, float] = Field(default_factory=dict)


class SurplusMonthlySeriesItem(BaseModel):
    year: int
    month: int
    total_inflow: float
    total_outflow: float
    surplus: float


class SurplusMonthlySeriesResponse(BaseModel):
    end_year: int
    end_month: int
    months: int
    series: List[SurplusMonthlySeriesItem]
