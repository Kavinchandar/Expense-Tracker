from typing import Optional

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class PlaidItem(Base):
    __tablename__ = "plaid_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    item_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    access_token: Mapped[str] = mapped_column(String(512))
    institution_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
