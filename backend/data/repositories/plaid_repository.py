from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from data.models.plaid_item import PlaidItem


class PlaidRepository:
    """Single stored Plaid item (local demo pattern)."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def get_stored_item(self) -> Optional[PlaidItem]:
        return self._session.execute(select(PlaidItem)).scalars().first()

    def replace_item(
        self,
        item_id: str,
        access_token: str,
        institution_name: Optional[str],
    ) -> None:
        self._session.execute(delete(PlaidItem))
        self._session.add(
            PlaidItem(
                item_id=item_id,
                access_token=access_token,
                institution_name=institution_name,
            )
        )
