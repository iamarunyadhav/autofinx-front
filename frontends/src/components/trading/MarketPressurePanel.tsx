import { useState } from "react";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type PressureWindow, useBinanceMarketPressure } from "@/hooks/useBinanceMarketPressure";

const WINDOWS: PressureWindow[] = ["1m", "5m", "15m"];
const compact = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(value);

export function MarketPressurePanel({ workspaceId, symbol, enabled }: { workspaceId?: string; symbol: string; enabled: boolean }) {
  const [selectedWindow, setSelectedWindow] = useState<PressureWindow>("1m");
  const [expanded, setExpanded] = useState(false);
  const { snapshot: pressure } = useBinanceMarketPressure(workspaceId, symbol, selectedWindow, enabled);
  const usable = pressure.usable && pressure.buyPct != null;
  const buyPct = pressure.buyPct ?? 0; const sellPct = pressure.sellPct ?? 0;
  const dominant = !usable ? "Unavailable" : buyPct >= sellPct ? "Buy pressure" : "Sell pressure";
  const statusTone = pressure.state === "live" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : pressure.state === "stale" ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : "border-slate-700 bg-slate-900 text-slate-400";

  return <section className="rounded-[28px] border border-slate-800 bg-slate-950/85 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.35)]" aria-label="Live buyer and seller pressure">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><div className="rounded-2xl bg-cyan-500/10 p-2.5 text-cyan-300"><Activity className="h-5 w-5" /></div><div><div className="text-xs uppercase tracking-[0.22em] text-slate-500">Live executed-trade pressure</div><div className="mt-0.5 text-sm font-semibold text-slate-100">{symbol} · {dominant}</div></div></div>
      <div className="flex items-center gap-2"><Badge variant="outline" className={cn("uppercase", statusTone)}>{pressure.state}</Badge>{WINDOWS.map((item) => <Button key={item} size="sm" variant="ghost" onClick={() => setSelectedWindow(item)} className={selectedWindow === item ? "bg-slate-100 text-slate-950" : "bg-slate-900 text-slate-300"}>{item}</Button>)}</div>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
      <div><span className="text-xs uppercase tracking-wider text-emerald-400">Aggressive buys</span><div className="text-3xl font-black text-emerald-300">{usable ? `${buyPct.toFixed(1)}%` : "—"}</div></div>
      <div className="text-center text-xs text-slate-500">{pressure.tradeCount.toLocaleString()} aggregate trades</div>
      <div className="text-left md:text-right"><span className="text-xs uppercase tracking-wider text-rose-400">Aggressive sells</span><div className="text-3xl font-black text-rose-300">{usable ? `${sellPct.toFixed(1)}%` : "—"}</div></div>
    </div>
    <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-800" aria-label={usable ? `Buy ${buyPct.toFixed(1)} percent, sell ${sellPct.toFixed(1)} percent` : "Pressure unavailable"}><div className="bg-emerald-500 transition-[width] duration-300" style={{ width: `${usable ? buyPct : 0}%` }} /><div className="bg-rose-500 transition-[width] duration-300" style={{ width: `${usable ? sellPct : 0}%` }} /></div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400"><span>Momentum: <b className="capitalize text-slate-200">{usable ? pressure.momentum : "disabled while stale"}</b></span><span>CVD: <b className={pressure.cvd >= 0 ? "text-emerald-300" : "text-rose-300"}>{usable ? `${pressure.cvd >= 0 ? "+" : ""}$${compact(pressure.cvd)}` : "—"}</b></span><Button variant="ghost" size="sm" className="text-cyan-300" onClick={() => setExpanded((value) => !value)}>{expanded ? "Hide details" : "Expand analysis"}{expanded ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}</Button></div>
    {expanded && <div className="mt-3 grid gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-xs sm:grid-cols-5"><div><span className="text-slate-500">Buy notional</span><div className="mt-1 font-semibold text-emerald-300">${compact(pressure.buyNotional)}</div></div><div><span className="text-slate-500">Sell notional</span><div className="mt-1 font-semibold text-rose-300">${compact(pressure.sellNotional)}</div></div><div><span className="text-slate-500">Last trade</span><div className="mt-1 font-semibold text-slate-200">{pressure.eventAgeMs == null ? "—" : `${Math.round(pressure.eventAgeMs)} ms ago`}</div></div><div><span className="text-slate-500">Last price</span><div className="mt-1 font-semibold text-slate-200">{pressure.lastPrice == null ? "—" : `$${pressure.lastPrice.toLocaleString()}`}</div></div><div><span className="text-slate-500">Top-5 visible book</span><div className="mt-1 font-semibold text-slate-200">{pressure.orderBook ? `${pressure.orderBook.bid_pct.toFixed(1)}% bid / ${pressure.orderBook.ask_pct.toFixed(1)}% ask` : "unavailable"}</div>{pressure.orderBook?.spread_bps != null && <div className="text-[10px] text-slate-500">Spread {pressure.orderBook.spread_bps.toFixed(2)} bps · partial depth</div>}</div></div>}
    <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Server/Redis projection of Binance executed aggressive-trade notional in the selected rolling window. Every trade has both a buyer and seller; this shows the aggressor side, not participant counts or a guaranteed forecast. Stale data disables the reading.</p>
  </section>;
}
