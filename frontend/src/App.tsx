import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCategories,
  getTransactions,
  uploadStatement,
} from "./api";
import type { TransactionsPayload } from "./api";
import { BucketList } from "./components/BucketList";
import { MonthPicker } from "./components/MonthPicker";
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
  const [month, setMonth] = useState(currentYearMonth);
  const [tx, setTx] = useState<TransactionsPayload | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
      .then(setCategories)
      .catch(() =>
        setCategories([
          "UNCATEGORIZED",
          "FOOD_AND_DRINK",
          "GENERAL_MERCHANDISE",
          "TRANSPORTATION",
        ])
      );
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadErr(null);
    setUploadMsg(null);
    setUploading(true);
    try {
      const res = await uploadStatement(file);
      setUploadMsg(
        res.parsed_count === 0
          ? "No transaction lines matched. Try a text-based PDF, or check date/description/amount layout."
          : `Imported ${res.parsed_count} transaction${res.parsed_count === 1 ? "" : "s"}.`
      );
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
          <MonthPicker value={month} onChange={setMonth} />
        </section>

        {uploadErr ? <p className="error">{uploadErr}</p> : null}
        {uploadMsg ? <p className="upload-msg muted">{uploadMsg}</p> : null}

        <section className="card">
          <BucketList
            data={tx}
            loading={txLoading}
            error={txError}
            categories={categories}
            onTransactionsChanged={loadTransactions}
          />
        </section>
      </main>
    </div>
  );
}
