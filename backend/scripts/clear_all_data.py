#!/usr/bin/env python3
"""Remove all expense data so you can re-import PDF statements from scratch.

From the backend directory:

  python scripts/clear_all_data.py --yes

Removes:
  - All stored bank lines (stored_transactions)
  - All PDF upload records (statement_uploads)
  - Budget defaults (budget_defaults)
  - Surplus defaults (surplus_defaults)
  - Legacy per-month budgets (monthly_budgets) if present

Does not delete the database file itself; tables stay empty.
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import delete, inspect

from data.models.budget_default import BudgetDefault
from data.models.monthly_budget import MonthlyBudget
from data.models.statement import StatementUpload, StoredTransaction
from data.models.surplus_default import SurplusDefault
from db import SessionLocal, engine


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Required: confirm you want to delete all data.",
    )
    args = parser.parse_args()
    if not args.yes:
        parser.error("Refusing to run without --yes (this deletes all expense data).")

    session = SessionLocal()
    try:
        insp = inspect(engine)
        tx_n = session.execute(delete(StoredTransaction)).rowcount or 0
        up_n = session.execute(delete(StatementUpload)).rowcount or 0
        bd_n = 0
        sd_n = 0
        mb_n = 0
        if insp.has_table("budget_defaults"):
            bd_n = session.execute(delete(BudgetDefault)).rowcount or 0
        if insp.has_table("surplus_defaults"):
            sd_n = session.execute(delete(SurplusDefault)).rowcount or 0
        if insp.has_table("monthly_budgets"):
            mb_n = session.execute(delete(MonthlyBudget)).rowcount or 0

        session.commit()

        print(
            "Cleared:",
            f"transactions={tx_n}, uploads={up_n}, budget_defaults={bd_n}, "
            f"surplus_defaults={sd_n}, monthly_budgets={mb_n}",
        )
        print("Done. You can upload statements again.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
