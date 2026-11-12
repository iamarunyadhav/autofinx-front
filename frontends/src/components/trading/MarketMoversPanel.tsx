import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Interval = "1m" | "15m" | "1h" | "4h" | "24h";
type Row = { symbol: string; change: number; price: number; volume: number };
const intervals: Array<{ key: Interval; api: string }> = [{ key: "1m", api: "1m" }, { key: "15m", api: "15m" }, { key: "1h", api: "1h" }, { key: "4h", api: "4h" }, { key: "24h", api: "1d" }];
const endpoint = "https://fapi.binance.com/fapi/v1";

async function loadMovers(interval: Interval): Promise<Row[]> {
  const tickers = await fetch(`${endpoint}/ticker/24hr`).then((r) => r.json()) as Array<{ symbol: string; lastPrice: string; quoteVolume: string; priceChangePercent: string }>;
  const universe = tickers.filter((t) => t.symbol.endsWith("USDT") && Number(t.quoteVolume) > 0).sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume)).slice(0, 80);
  if (interval === "24h") return universe.map((t) => ({ symbol: t.symbol, change: Number(t.priceChangePercent), price: Number(t.lastPrice), volume: Number(t.quoteVolume) }));
  const rows = await Promise.all(universe.map(async (t) => {
    try {
      const k = await fetch(`${endpoint}/klines?symbol=${t.symbol}&interval=${intervals.find((x) => x.key === interval)?.api}&limit=2`).then((r) => r.json()) as Array<Array<string | number>>;
      const open = Number(k[0]?.[1]); const close = Number(k.at(-1)?.[4] ?? t.lastPrice);
      return { symbol: t.symbol, change: open > 0 ? (close - open) / open * 100 : 0, price: close, volume: Number(t.quoteVolume) };
    } catch { return null; }
  }));
  return rows.filter((r): r is Row => r !== null).sort((a, b) => b.change - a.change);
}

export function MarketMoversPanel() {
  const [interval, setInterval] = useState<Interval>("24h");
  const [rows, setRows] = useState<Row[]>([]); const [loading, setLoading] = useState(false);
  const refresh = useCallback(() => { setLoading(true); void loadMovers(interval).then(setRows).finally(() => setLoading(false)); }, [interval]);
  useEffect(() => { refresh(); }, [interval]);
  const gainers = useMemo(() => rows.slice(0, 10), [rows]); const losers = useMemo(() => [...rows].sort((a, b) => a.change - b.change).slice(0, 10), [rows]);
  const table = (title: string, items: Row[], red = false) => <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3"><div className="mb-2 flex items-center gap-2 text-sm font-bold">{red ? <ArrowDown className="h-4 w-4 text-rose-400" /> : <ArrowUp className="h-4 w-4 text-emerald-400" />}{title}</div><div className="space-y-1.5">{items.map((r, i) => <div key={r.symbol} className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-2 text-xs"><span className="text-slate-600">{i + 1}</span><span className="font-semibold text-slate-200">{r.symbol.replace("USDT", " / USDT")}</span><span className="text-slate-400">{r.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span><span className={red ? "font-bold text-rose-300" : "font-bold text-emerald-300"}>{r.change >= 0 ? "+" : ""}{r.change.toFixed(2)}%</span></div>)}</div></div>;
  return <section className="rounded-[28px] border border-slate-800 bg-slate-950/85 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.35)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs uppercase tracking-[0.22em] text-slate-500">Market analyzer</div><div className="mt-1 text-lg font-bold text-slate-100">Top gainers / losers</div><div className="text-xs text-slate-500">Read-only Binance USDⓈ-M market scan · not an entry signal</div></div><div className="flex flex-wrap items-center gap-1">{intervals.map((x) => <Button key={x.key} size="sm" variant="ghost" onClick={() => setInterval(x.key)} className={interval === x.key ? "bg-slate-100 text-slate-950" : "bg-slate-900 text-slate-300"}>{x.key}</Button>)}<Button size="icon" variant="ghost" onClick={refresh} disabled={loading} className="text-cyan-300"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button></div></div>{loading && <div className="mt-4 text-sm text-slate-500">Analyzing {interval} movers…</div>}{!loading && <div className="mt-4 grid gap-3 lg:grid-cols-2">{table("Top 10 gainers", gainers)}{table("Top 10 losers", losers, true)}</div>}<div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500"><Activity className="h-3.5 w-3.5" /> Click a timeframe to recalculate the ranking from Binance public futures candles. Values are informational only.</div></section>;
}
