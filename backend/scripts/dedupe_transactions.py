#!/usr/bin/env python3
"""Remove duplicate stored_transactions (same date, amount, description). Keeps lowest id.

Run from the backend directory:
  python scripts/dedupe_transactions.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from collections import defaultdict
from sqlalchemy import select

from data.models.statement import StoredTransaction
from db import SessionLocal
from services.transaction_fingerprint import fingerprint_from_stored


def main() -> None:
    session = SessionLocal()
    try:
        rows = list(session.execute(select(StoredTransaction)).scalars().all())
        by_fp: dict[tuple[str, float, str], list[StoredTransaction]] = defaultdict(list)
        for t in rows:
            fp = fingerprint_from_stored(t.posted_date, t.amount, t.description)
            by_fp[fp].append(t)

        deleted = 0
        for _fp, group in by_fp.items():
            if len(group) <= 1:
                continue
            group.sort(key=lambda x: x.id)
            for t in group[1:]:
                session.delete(t)
                deleted += 1

        session.commit()
        print(f"Removed {deleted} duplicate row(s).")
    finally:
        session.close()


if __name__ == "__main__":
    main()
