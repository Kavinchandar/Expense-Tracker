from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from api.dependencies import get_db
from api.schemas import UploadStatementResponse
from services.statement_service import StatementService

router = APIRouter(tags=["statements"])


@router.post("/statements/upload", response_model=UploadStatementResponse)
async def upload_statement(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    name = (file.filename or "").strip()
    data = await file.read()
    svc = StatementService(db)
    result = svc.upload_pdf(name, data)
    return UploadStatementResponse(
        ok=True,
        upload_id=result.upload_id,
        parsed_count=result.parsed_count,
    )
