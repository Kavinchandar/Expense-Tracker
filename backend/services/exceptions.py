from __future__ import annotations


class ServiceError(Exception):
    """Raised by the service layer; mapped to HTTP by the API layer."""

    http_status: int = 400

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class ValidationError(ServiceError):
    http_status = 400


class NotFoundError(ServiceError):
    http_status = 404


class UnprocessableEntityError(ServiceError):
    http_status = 422


class BadGatewayError(ServiceError):
    http_status = 502


class ServiceUnavailableError(ServiceError):
    http_status = 503
