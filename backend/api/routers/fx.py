from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException

from api.schemas import UsdInrResponse

router = APIRouter(tags=["fx"])

_FRANKFURTER = "https://api.frankfurter.app/latest"


@router.get("/fx/usd-inr", response_model=UsdInrResponse)
def get_usd_inr() -> UsdInrResponse:
    """Latest USD→INR from Frankfurter (ECB-based; no API key)."""
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(_FRANKFURTER, params={"from": "USD", "to": "INR"})
            r.raise_for_status()
            data = r.json()
        rate = float(data["rates"]["INR"])
        as_of = str(data.get("date") or "")
        return UsdInrResponse(usd_to_inr=rate, as_of_date=as_of)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Could not fetch USD/INR rate: {e!s}",
        ) from e
