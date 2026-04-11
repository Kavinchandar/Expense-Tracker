from datetime import date as date_type
from datetime import datetime
from typing import List, Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class StatementUpload(Base):
    __tablename__ = "statement_uploads"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(512))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    transactions: Mapped[List["StoredTransaction"]] = relationship(
        back_populates="upload", cascade="all, delete-orphan"
    )


class StoredTransaction(Base):
    __tablename__ = "stored_transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    upload_id: Mapped[int] = mapped_column(ForeignKey("statement_uploads.id"), index=True)
    line_fingerprint: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    posted_date: Mapped[date_type] = mapped_column(Date, index=True)
    description: Mapped[str] = mapped_column(String(1024))
    merchant_key: Mapped[str] = mapped_column(String(512), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Float)
    balance_after: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    category: Mapped[str] = mapped_column(String(128), default="UNCATEGORIZED")
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)

    upload: Mapped["StatementUpload"] = relationship(back_populates="transactions")
