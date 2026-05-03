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
    detected_format: str = "pdf"


class CategoryBody(BaseModel):
    category: str = Field(..., min_length=1, max_length=128)
    surplus_subcategory: Optional[str] = Field(default=None, max_length=64)


class DetailBody(BaseModel):
    detail: str = Field(default="", max_length=2048)


class CategoriesResponse(BaseModel):
    """`categories` is expense then surplus (full assignable set); split lists for UI."""

    categories: List[str]
    expense_categories: List[str]
    surplus_categories: List[str]
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
    all_time_surplus: float = 0.0
    available_to_spend: float = 0.0
    fd_debits_all_time: float = 0.0
    mf_debits_all_time: float = 0.0
    fd_investment_debits_year: float = 0.0
    pf_cumulative_all_time: float = 0.0


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
    pf: Optional[float] = None


class SurplusMonthlySeriesResponse(BaseModel):
    end_year: int
    end_month: int
    months: int
    series: List[SurplusMonthlySeriesItem]
