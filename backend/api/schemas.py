from __future__ import annotations

from typing import List, Optional

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
    buckets: List[dict]
    display_timezone: str


class UploadStatementResponse(BaseModel):
    ok: bool
    upload_id: int
    parsed_count: int


class CategoryBody(BaseModel):
    category: str = Field(..., min_length=1, max_length=128)


class CategoriesResponse(BaseModel):
    categories: List[str]


class PlaidExchangeResponse(BaseModel):
    ok: bool
    institution_name: Optional[str] = None
