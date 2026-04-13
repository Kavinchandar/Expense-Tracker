import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearAllTransactions,
  clearMonthTransactions,
  deleteTransaction,
  getBudgets,
  getCategories,
  getSurplusBudgets,
  getTransactions,
  restoreTransaction,
  setTransactionCategory,
  uploadStatement,
} from "./api";
import type { TransactionsPayload } from "./api";
import { mergeCategoryChange } from "./groupBuckets";
import { BudgetDashboard } from "./components/BudgetDashboard";
import { BucketList } from "./components/BucketList";
import { InsightsPanel } from "./components/InsightsPanel";
import { MonthPicker } from "./components/MonthPicker";
import { SurplusPanel } from "./components/SurplusPanel";
import { YearlyInsightsPanel } from "./components/YearlyInsightsPanel";
import "./App.css";

function currentYearMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseYearMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-").map(Number);
  return { year: y, month: m };
}

export default function App() {
  const [mainTab, setMainTab] = useState<
    "overview" | "surplus" | "yearly"
  >("overview");
  const [month, setMonth] = useState(currentYearMonth);
  const [tx, setTx] = useState<TransactionsPayload | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(
    {}
  );
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [surplusBudgets, setSurplusBudgets] = useState<Record<string, number>>(
    {}
  );
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [clearErr, setClearErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { year, monthNum } = useMemo(() => {
    const p = parseYearMonth(month);
    return { year: p.year, monthNum: p.month };
  }, [month]);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    setTxError(null);
    try {
      const data = await getTransactions(year, monthNum);
      setTx(data);
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : String(e));
      setTx(null);
    } finally {
      setTxLoading(false);
    }
  }, [year, monthNum]);

  useEffect(() => {
    void getCategories()
      .then((c) => {
        setCategories(c.categories);
        setCategoryLabels(c.labels);
      })
      .catch(() => {
        setCategories(["UNCATEGORIZED"]);
        setCategoryLabels({});
      });
  }, []);

  /** Budget targets are global (same for every month); API only needs a valid month for the request. */
  const loadBudgets = useCallback(async () => {
    try {
      const now = new Date();
      const b = await getBudgets(now.getFullYear(), now.getMonth() + 1);
      setBudgets(b.budgets);
    } catch {
      setBudgets({});
    }
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    void loadBudgets();
  }, [loadBudgets]);

  /** Global surplus targets; API uses a valid month on the query only. */
  const loadSurplusBudgets = useCallback(async () => {
    try {
      const now = new Date();
      const s = await getSurplusBudgets(now.getFullYear(), now.getMonth() + 1);
      setSurplusBudgets(s.budgets);
    } catch {
      setSurplusBudgets({});
    }
  }, []);

  useEffect(() => {
    void loadSurplusBudgets();
  }, [loadSurplusBudgets]);

  /** Updates transaction category locally (no full refetch); syncs with API. */
  const assignCategory = useCallback(
    async (transactionId: string, category: string) => {
      let previous: TransactionsPayload | null = null;
      setTx((cur) => {
        previous = cur;
        if (!cur) return cur;
        return mergeCategoryChange(cur, transactionId, category);
      });
      try {
        await setTransactionCategory(transactionId, category);
      } catch (e) {
        setTx(previous);
        throw e;
      }
    },
    []
  );

  const removeTransaction = useCallback(async (transactionId: string) => {
    await deleteTransaction(transactionId);
    await loadTransactions();
  }, [loadTransactions]);

  const restoreTxn = useCallback(async (transactionId: string) => {
    await restoreTransaction(transactionId);
    await loadTransactions();
  }, [loadTransactions]);

  const onPickFile = () => fileRef.current?.click();

  const onClearMonth = useCallback(async () => {
    const ok = window.confirm(
      `Clear all transactions for ${year}-${String(monthNum).padStart(2, "0")}? This cannot be undone.`
    );
    if (!ok) return;
    setClearErr(null);
    setClearMsg(null);
    setClearingData(true);
    try {
      const res = await clearMonthTransactions(year, monthNum);
      setClearMsg(
        `Cleared ${res.deleted_count} transaction${res.deleted_count === 1 ? "" : "s"} for ${year}-${String(monthNum).padStart(2, "0")}.`
      );
      await loadTransactions();
    } catch (err: unknown) {
      setClearErr(err instanceof Error ? err.message : String(err));
    } finally {
      setClearingData(false);
    }
  }, [loadTransactions, monthNum, year]);

  const onClearAll = useCallback(async () => {
    const ok = window.confirm(
      "Clear all transactions across every month? This cannot be undone."
    );
    if (!ok) return;
    setClearErr(null);
    setClearMsg(null);
    setClearingData(true);
    try {
      const res = await clearAllTransactions();
      setClearMsg(
        `Cleared ${res.deleted_count} transaction${res.deleted_count === 1 ? "" : "s"} across all months.`
      );
      await loadTransactions();
    } catch (err: unknown) {
      setClearErr(err instanceof Error ? err.message : String(err));
    } finally {
      setClearingData(false);
    }
  }, [loadTransactions]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadErr(null);
    setUploadMsg(null);
    setUploading(true);
    try {
      const res = await uploadStatement(file);
      const replaced = res.replaced_count ?? 0;
      const refresh =
        replaced > 0
          ? `Cleared ${replaced} existing line${replaced === 1 ? "" : "s"} in that statement's date range. `
          : "";
      if (res.parsed_count === 0 && res.skipped_duplicates === 0) {
        setUploadMsg(
          refresh ||
            "No transaction lines matched. Try a text-based PDF, or check date/description/amount layout."
        );
      } else if (res.parsed_count === 0 && res.skipped_duplicates > 0) {
        setUploadMsg(
          `${refresh}No new lines added (${res.skipped_duplicates} duplicate line${res.skipped_duplicates === 1 ? "" : "s"} in this PDF).`
        );
      } else {
        const skip =
          res.skipped_duplicates > 0
            ? ` ${res.skipped_duplicates} duplicate line${res.skipped_duplicates === 1 ? "" : "s"} skipped in this PDF.`
            : "";
        setUploadMsg(
          `${refresh}Imported ${res.parsed_count} transaction${res.parsed_count === 1 ? "" : "s"}.${skip}`
        );
      }
      await loadTransactions();
    } catch (err: unknown) {
      setUploadErr(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Expense Tracker</h1>
        <p className="tagline">PDF statement · categorize · local database</p>
      </header>

      <main>
        <section className="card toolbar">
          <div className="upload-block">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={onFileChange}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={onPickFile}
              disabled={uploading}
            >
              {uploading ? "Parsing PDF…" : "Upload bank statement (PDF)"}
            </button>
            <p className="upload-hint muted">
              Text-based PDFs work best; each line should look like date,
              description, and amount.
            </p>
          </div>
          <div className="toolbar-right">
            <MonthPicker value={month} onChange={setMonth} />
            <div className="danger-actions">
              <button
                type="button"
                className="btn-danger"
                onClick={onClearMonth}
                disabled={clearingData}
              >
                {clearingData ? "Clearing..." : "Clear this month"}
              </button>
              <button
                type="button"
                className="btn-danger btn-danger-soft"
                onClick={onClearAll}
                disabled={clearingData}
              >
                {clearingData ? "Clearing..." : "Clear all transactions"}
              </button>
            </div>
          </div>
        </section>

        {uploadErr ? <p className="error">{uploadErr}</p> : null}
        {uploadMsg ? <p className="upload-msg muted">{uploadMsg}</p> : null}
        {clearErr ? <p className="error">{clearErr}</p> : null}
        {clearMsg ? <p className="upload-msg muted">{clearMsg}</p> : null}

        <section className="card app-tab-bar" aria-label="Main views">
          <div className="app-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "overview"}
              className={
                mainTab === "overview" ? "app-tab app-tab--active" : "app-tab"
              }
              onClick={() => setMainTab("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "surplus"}
              className={
                mainTab === "surplus" ? "app-tab app-tab--active" : "app-tab"
              }
              onClick={() => setMainTab("surplus")}
            >
              Surplus
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "yearly"}
              className={
                mainTab === "yearly" ? "app-tab app-tab--active" : "app-tab"
              }
              onClick={() => setMainTab("yearly")}
            >
              Year
            </button>
          </div>
        </section>

        {mainTab === "overview" ? (
          <>
            <section className="card">
              <InsightsPanel
                year={year}
                month={monthNum}
                txLoading={txLoading}
              />
            </section>

            <section className="card">
              <BudgetDashboard
                year={year}
                month={monthNum}
                data={tx}
                loading={txLoading}
                budgets={budgets}
                labels={categoryLabels}
                categoryKeys={categories}
                onBudgetsSaved={setBudgets}
              />
            </section>

            <section className="card">
              <BucketList
                data={tx}
                loading={txLoading}
                error={txError}
                categories={categories}
                categoryLabels={categoryLabels}
                assignCategory={assignCategory}
                onDeleteTransaction={removeTransaction}
                onRestoreTransaction={restoreTxn}
              />
            </section>
          </>
        ) : mainTab === "surplus" ? (
          <section className="card">
            <SurplusPanel
              year={year}
              month={monthNum}
              surplusBudgets={surplusBudgets}
              onSurplusBudgetsSaved={setSurplusBudgets}
            />
          </section>
        ) : (
          <section className="card">
            <YearlyInsightsPanel anchorYear={year} />
          </section>
        )}
      </main>
    </div>
  );
}
