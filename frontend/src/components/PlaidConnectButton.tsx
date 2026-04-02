import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { exchangePublicToken, fetchLinkToken, plaidLinkEnv } from "../api";

type Props = {
  onConnected: () => void;
};

export function PlaidConnectButton({ onConnected }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openedForToken = useRef<string | null>(null);

  const onSuccess = useCallback(
    async (publicToken: string) => {
      setError(null);
      try {
        await exchangePublicToken(publicToken);
        setLinkToken(null);
        openedForToken.current = null;
        onConnected();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [onConnected]
  );

  const onExit = useCallback(() => {
    setLinkToken(null);
    openedForToken.current = null;
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess,
    onExit,
    env: plaidLinkEnv(),
  });

  useEffect(() => {
    if (!linkToken || !ready) return;
    if (openedForToken.current === linkToken) return;
    openedForToken.current = linkToken;
    open();
  }, [linkToken, ready, open]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await fetchLinkToken();
      setLinkToken(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="plaid-connect">
      <button type="button" className="btn-primary" onClick={start} disabled={busy}>
        {busy ? "Preparing…" : "Connect bank"}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
