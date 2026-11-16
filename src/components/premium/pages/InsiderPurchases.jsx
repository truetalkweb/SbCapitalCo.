import { useEffect, useState } from "react";
import { ActionButton, PremiumCard, PremiumTable } from "../PremiumWorkspacePrimitives";

const quantity = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });
const amount = (value) => value == null ? "Unavailable" : quantity.format(value);
const text = (value) => value || "Unavailable";
const PAGE_SIZE = 25;

export default function InsiderPurchases({ brokerApiUrl, theme }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState({ ticker: "", page: 1 });
  const [result, setResult] = useState({ status: "loading", rows: [] });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open || !brokerApiUrl) return;
    const controller = new AbortController();
    let timer;
    setResult({ status: "loading", rows: [] });

    async function load() {
      try {
        const params = new URLSearchParams({ ...query, pageSize: PAGE_SIZE });
        const response = await fetch(`${brokerApiUrl.replace(/\/$/, "")}/api/edgar/insider-purchases?${params}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        });
        if (!response.ok) throw new Error("Filings request failed");
        const data = await response.json();
        if (controller.signal.aborted) return;
        setResult(data);
        if (data.refreshing) timer = setTimeout(load, 3000);
      } catch {
        if (!controller.signal.aborted) setResult((prior) => ({
          ...prior, status: prior.refreshedAt ? "cached" : "unavailable",
        }));
      }
    }

    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, brokerApiUrl, query, retry]);

  const status = brokerApiUrl ? result.status : "unavailable";
  const rows = result.rows ?? [];
  const columns = [
    { key: "issuer", label: "Issuer", width: "1.25fr", render: row => text(row.issuer) },
    { key: "ticker", label: "Ticker", width: "70px", render: row => text(row.ticker) },
    { key: "owners", label: "Reporting owners", width: "1.25fr", render: row => text(row.owners.map(owner => owner.name).filter(Boolean).join(", ")) },
    { key: "transactionDate", label: "Transaction date", width: "110px", render: row => text(row.transactionDate) },
    { key: "filingDate", label: "Filed", width: "100px" },
    { key: "shares", label: "Shares", width: "100px", render: row => amount(row.shares) },
    { key: "price", label: "Price / share", width: "100px", render: row => amount(row.price) },
    { key: "value", label: "Est. value", width: "100px", render: row => amount(row.estimatedValue) },
    { key: "purchaseType", label: "Transaction", width: "135px" },
    { key: "form", label: "SEC filing", width: "110px", render: row => (
      <a href={row.sourceUrl} target="_blank" rel="noreferrer" style={{ color: theme.blue }}>
        Form {row.form}{row.form.endsWith("/A") ? " amendment" : ""}
      </a>
    ) },
  ];

  return (
    <PremiumCard theme={theme} title="SEC filings" action={
      <ActionButton theme={theme} onClick={() => setOpen(value => !value)}>
        {open ? "Hide filings" : "Show filings"}
      </ActionButton>
    }>
      {open && <>
        <div style={{ padding: 16 }}>
          <h3>Reported insider purchases</h3>
          <form onSubmit={event => {
            event.preventDefault();
            setQuery({ ticker: input.trim().toUpperCase(), page: 1 });
          }} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label htmlFor="edgar-ticker">Ticker</label>
            <input id="edgar-ticker" value={input} onChange={event => setInput(event.target.value)} maxLength={15} pattern="[A-Za-z0-9][A-Za-z0-9.\\-]{0,14}" placeholder="All tickers" />
            <button type="submit">Filter</button>
          </form>
          <div role="status" style={{ color: theme.muted, marginTop: 8 }}>
            {status === "loading" && "Loading verified SEC filings…"}
            {status === "unavailable" && "SEC filings are temporarily unavailable."}
            {status === "cached" && "Showing cached SEC filings. "}
            {result.refreshedAt && `Last verified ${new Date(result.refreshedAt).toLocaleString()}. `}
            {result.coverage && `${result.coverage.verified.toLocaleString()} of ${result.coverage.eligible.toLocaleString()} eligible filings checked in the latest ${result.coverage.lookbackDays} days.`}
          </div>
          {(status === "unavailable" || status === "cached") &&
            <ActionButton theme={theme} onClick={() => setRetry(value => value + 1)}>Check again</ActionButton>}
        </div>
        {(status === "ready" || status === "cached") && <>
          <div style={{ overflowX: "auto" }}>
            <PremiumTable theme={theme} columns={columns} rows={rows} keyField="id"
              emptyMessage="No reported purchases match this filter in the verified filing subset." />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12 }}>
            <ActionButton theme={theme} disabled={query.page === 1}
              onClick={() => setQuery({ ...query, page: query.page - 1 })}>Previous</ActionButton>
            <span>Page {query.page}</span>
            <ActionButton theme={theme} disabled={query.page * PAGE_SIZE >= result.total}
              onClick={() => setQuery({ ...query, page: query.page + 1 })}>Next</ActionButton>
          </div>
        </>}
      </>}
    </PremiumCard>
  );
}

