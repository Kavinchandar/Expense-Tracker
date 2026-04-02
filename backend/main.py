"""ASGI entrypoint: composes the API from layered packages."""

from api.app_factory import create_app

app = create_app()
