from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from services.exceptions import ServiceError


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ServiceError)
    async def service_error_handler(_request: Request, exc: ServiceError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.http_status,
            content={"detail": exc.message},
        )
