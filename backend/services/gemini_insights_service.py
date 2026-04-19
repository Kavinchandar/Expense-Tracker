"""Call Gemini to summarize monthly transaction data (no key in frontend)."""

from __future__ import annotations

import json
import re
import time
from typing import Any

import httpx
from sqlalchemy.orm import Session

from categories import BUCKET_LABELS, DELETED_BUCKET_KEY
from config import get_settings
from services.exceptions import BadGatewayError, ServiceUnavailableError
from services.statement_service import MonthlyTransactionsResult, StatementService

_MAX_TX_LINES = 180
_DESC_MAX = 140
_MAX_429_RETRIES = 2
_RETRY_HINT = re.compile(r"Please retry in ([\d.]+)\s*s", re.IGNORECASE)


def _format_month_payload(result: MonthlyTransactionsResult) -> str:
    lines: list[str] = [
        f"Period: {result.year}-{result.month:02d}",
        f"Display timezone: {result.display_timezone}",
        f"Net change (sum of amounts): {result.month_total:.2f}",
        f"Total inflow (credits): {result.total_inflow:.2f}",
        f"Total outflow (debits, magnitude): {result.total_outflow:.2f}",
    ]
    if result.opening_balance is not None:
        lines.append(f"Balance at period start (if known): {result.opening_balance:.2f}")
    if result.closing_balance is not None:
        lines.append(f"Balance at period end (if known): {result.closing_balance:.2f}")
    lines.append("")
    lines.append("Totals by category (user-assigned bucket):")
    for b in sorted(result.buckets, key=lambda x: x["name"]):
        if b["name"] == DELETED_BUCKET_KEY:
            continue
        label = BUCKET_LABELS.get(b["name"], b["name"])
        lines.append(
            f"  - {label} ({b['name']}): {b['total']:.2f} — {len(b['transactions'])} transaction(s)"
        )
    flat: list[dict[str, Any]] = []
    for b in result.buckets:
        if b["name"] == DELETED_BUCKET_KEY:
            continue
        for t in b["transactions"]:
            flat.append(t)
    flat.sort(key=lambda x: (x["date"], x["transaction_id"]), reverse=True)
    truncated = False
    if len(flat) > _MAX_TX_LINES:
        flat = flat[:_MAX_TX_LINES]
        truncated = True
    lines.append("")
    lines.append("Transactions (newest first; amounts in account currency):")
    for t in flat:
        desc = (t.get("name") or "")[:_DESC_MAX]
        extra = (t.get("detail") or "").strip()
        if extra:
            desc = f"{desc} [detail: {extra[:80]}]"[: _DESC_MAX + 100]
        cat = BUCKET_LABELS.get(t.get("primary_category"), t.get("primary_category"))
        lines.append(
            f"  {t['date']} | {t['amount']:.2f} | {cat} | {desc}"
        )
    if truncated:
        lines.append(f"(List truncated to {_MAX_TX_LINES} rows for analysis.)")
    return "\n".join(lines)


def _extract_gemini_text(body: dict[str, Any]) -> str:
    try:
        cands = body.get("candidates") or []
        if not cands:
            err = body.get("error", {})
            msg = err.get("message", json.dumps(body)[:500])
            raise BadGatewayError(f"Gemini returned no candidates: {msg}")
        parts = (cands[0].get("content") or {}).get("parts") or []
        texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
        out = "".join(texts).strip()
        if not out:
            raise BadGatewayError("Gemini returned an empty response.")
        return out
    except BadGatewayError:
        raise
    except (KeyError, IndexError, TypeError) as e:
        raise BadGatewayError(f"Unexpected Gemini response shape: {e}") from e


def _sleep_before_429_retry(response: httpx.Response) -> float:
    """Seconds to wait before retrying a rate-limited request (capped)."""
    ra = response.headers.get("Retry-After")
    if ra:
        try:
            return min(float(ra), 120.0)
        except ValueError:
            pass
    try:
        body = response.json()
        msg = body.get("error", {}).get("message", "") or ""
    except Exception:
        msg = ""
    m = _RETRY_HINT.search(msg)
    if m:
        return min(float(m.group(1)) + 0.5, 120.0)
    return 55.0


def _gemini_error_message(status: int, api_message: str) -> str:
    if status == 404:
        return (
            "Gemini model not found (404). The model id may be wrong or retired. "
            "In backend .env set GEMINI_MODEL to a current id, e.g. "
            "gemini-2.5-flash-lite or gemini-2.5-flash "
            "(see https://ai.google.dev/gemini-api/docs/models/gemini). "
            "You can list models with: "
            "curl \"https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY\" "
            f"— API said: {api_message[:350]}"
        )
    if status == 429:
        return (
            "Gemini rate limit or quota exceeded (429). Try: wait a minute and generate again; "
            "set GEMINI_MODEL=gemini-2.5-flash-lite in backend .env; or enable billing / check usage at "
            "https://ai.google.dev/gemini-api/docs/rate-limits — "
            f"API said: {api_message[:400]}"
        )
    return f"Gemini API error ({status}): {api_message}"


def _call_gemini(prompt: str) -> str:
    settings = get_settings()
    key = (settings.gemini_api_key or "").strip()
    if not key:
        raise ServiceUnavailableError(
            "Gemini is not configured. Set GEMINI_API_KEY in the backend .env file "
            "(see https://aistudio.google.com/apikey)."
        )
    model = (settings.gemini_model or "gemini-2.5-flash-lite").strip()
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.65,
            "maxOutputTokens": 2048,
        },
    }

    last_status = 0
    last_msg = ""
    for attempt in range(_MAX_429_RETRIES + 1):
        try:
            with httpx.Client(timeout=120.0) as client:
                r = client.post(url, params={"key": key}, json=payload)
        except httpx.HTTPError as e:
            raise BadGatewayError(f"Could not reach Gemini API: {e}") from e

        if r.status_code == 429 and attempt < _MAX_429_RETRIES:
            wait = _sleep_before_429_retry(r)
            time.sleep(wait)
            continue

        if r.status_code >= 400:
            try:
                detail = r.json()
                last_msg = detail.get("error", {}).get("message", r.text[:800])
            except Exception:
                last_msg = r.text[:800]
            last_status = r.status_code
            break

        try:
            return _extract_gemini_text(r.json())
        except BadGatewayError:
            raise

    raise BadGatewayError(_gemini_error_message(last_status, last_msg))


def generate_insights_for_month(session: Session, year: int, month: int) -> str:
    svc = StatementService(session)
    result = svc.monthly_transactions(year, month)
    if not result.buckets:
        return (
            "There are no transactions for this month, so there is nothing to analyze. "
            "Upload a statement or pick a month that has data."
        )

    data_block = _format_month_payload(result)
    prompt = (
        "You are a concise personal finance assistant. The user tracks expenses in buckets "
        "(categories). Using ONLY the data below, write a brief analysis.\n\n"
        "Output format (strict):\n"
        "- Write one or two short paragraphs of plain prose only (no more than ~180 words total).\n"
        "- Do NOT use markdown headings (no ### or ##), section titles, numbered lists, or bullet lists.\n"
        "- Do NOT use labels like 'Financial Snapshot', 'Spending Breakdown', 'Insights', or 'Suggestions'.\n"
        "- Flow naturally: net flow, where money went (categories with real figures), anything notable, "
        "then weave in one or two practical observations in the same prose.\n"
        "- Reference specific numbers and category names from the data; do not invent transactions or balances.\n"
        "- If opening/closing balances are missing, mention only briefly if relevant.\n\n"
        "--- Data ---\n"
        f"{data_block}"
    )
    return _call_gemini(prompt)
