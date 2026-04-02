"""Normalize Plaid API errors to user-facing strings."""

from __future__ import annotations

import json
from typing import Any

from plaid.exceptions import ApiException


def plaid_error_detail(exc: BaseException) -> str:
    if isinstance(exc, ApiException) and exc.body:
        raw: Any = exc.body
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                msg = data.get("error_message") or data.get("error_code")
                if msg:
                    return str(msg)
        except (json.JSONDecodeError, TypeError):
            pass
        return raw if isinstance(raw, str) else str(exc)
    return str(exc)
