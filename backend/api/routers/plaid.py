from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.dependencies import get_db
from api.schemas import (
    ExchangeBody,
    LinkTokenResponse,
    PlaidExchangeResponse,
    PlaidStatusResponse,
)
from services.plaid_link_service import PlaidLinkService

router = APIRouter(tags=["plaid"])


@router.get("/plaid/status", response_model=PlaidStatusResponse)
def plaid_status(db: Session = Depends(get_db)):
    svc = PlaidLinkService(db)
    connected, name = svc.connection_status()
    return PlaidStatusResponse(connected=connected, institution_name=name)


@router.post("/plaid/link_token", response_model=LinkTokenResponse)
def plaid_link_token(db: Session = Depends(get_db)):
    svc = PlaidLinkService(db)
    return LinkTokenResponse(link_token=svc.create_link_token())


@router.post("/plaid/exchange", response_model=PlaidExchangeResponse)
def plaid_exchange(body: ExchangeBody, db: Session = Depends(get_db)):
    svc = PlaidLinkService(db)
    institution_name = svc.exchange_public_token(body.public_token)
    return PlaidExchangeResponse(ok=True, institution_name=institution_name)
