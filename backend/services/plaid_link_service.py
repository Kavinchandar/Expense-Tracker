"""Application-level Plaid link/exchange flows using repositories + SDK."""

from __future__ import annotations

from typing import Optional, Tuple

from sqlalchemy.orm import Session

from data.repositories.plaid_repository import PlaidRepository
from plaid_client import get_plaid_api
from services import plaid_sdk
from services.exceptions import BadGatewayError, ServiceUnavailableError
from services.plaid_errors import plaid_error_detail


class PlaidLinkService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._repo = PlaidRepository(session)

    def connection_status(self) -> Tuple[bool, Optional[str]]:
        row = self._repo.get_stored_item()
        if row is None:
            return False, None
        return True, row.institution_name

    def create_link_token(self) -> str:
        try:
            client = get_plaid_api()
        except RuntimeError as e:
            raise ServiceUnavailableError(str(e)) from e
        try:
            return plaid_sdk.create_link_token(client)
        except Exception as e:
            raise BadGatewayError(plaid_error_detail(e)) from e

    def exchange_public_token(self, public_token: str) -> Optional[str]:
        try:
            client = get_plaid_api()
        except RuntimeError as e:
            raise ServiceUnavailableError(str(e)) from e
        try:
            access_token, item_id, institution_name = plaid_sdk.exchange_public_token(
                client, public_token
            )
        except Exception as e:
            raise BadGatewayError(plaid_error_detail(e)) from e

        self._repo.replace_item(item_id, access_token, institution_name)
        self._session.commit()
        return institution_name
