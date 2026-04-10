import { useEffect, useState } from "react";
import { getInsights } from "../api";

type Props = {
  year: number;
  month: number;
  /** While the main transaction list for this month is loading */
  txLoading: boolean;
};

export function InsightsPanel({ year, month, txLoading }: Props) {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInsights(null);
    setError(null);
  }, [year, month]);

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInsights(year, month);
      setInsights(data.insights);
    } catch (e: unknown) {
      setInsights(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="insights-panel">
      <h2>AI Insights</h2>
      <p className="muted insights-lead">
        Google Gemini analyzes this month&apos;s categorized transactions (same data as
        below)
      </p>
      <button
        type="button"
        className="btn-primary insights-generate"
        onClick={() => void onGenerate()}
        disabled={txLoading || loading}
      >
        {loading ? "Generating…" : "Generate insights"}
      </button>
      {error ? <p className="error insights-error">{error}</p> : null}
      {insights ? (
        <div className="insights-body" role="region" aria-label="AI insights">
          {insights}
        </div>
      ) : null}
    </div>
  );
}
