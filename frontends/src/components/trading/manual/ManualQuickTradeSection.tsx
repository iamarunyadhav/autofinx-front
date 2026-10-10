import { useCallback, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { DEFAULT_OVERLAYS, type OverlayToggles } from "@/lib/chartStructure";
import { CHART_TIMEFRAMES, MANUAL_SYMBOLS, localEstimate, parseApiError, type ChartTimeframe, type ManualPreview, type OrderForm } from "@/lib/manualTrade";
import { useManualChartCandles } from "@/hooks/useManualChartCandles";
import { useManualPositions, useManualStatus, useSetManualEnabled } from "@/hooks/useQuickTradeManual";
import { ManualOrderForm } from "./ManualOrderForm";
import { ManualPositionPanel } from "./ManualPositionPanel";
import { ManualTradeChart, type ChartLine } from "./ManualTradeChart";

const OVERLAY_LABELS: { key: keyof OverlayToggles; label: string }[] = [
  { key: "ema50", label: "EMA 50" },
  { key: "ema200", label: "EMA 200" },
  { key: "swings", label: "Swing highs/lows (confirmed)" },
  { key: "zones", label: "Support / resistance zones" },
  { key: "trendlines", label: "Trendlines (higher lows / lower highs)" },
  { key: "structure", label: "BOS / CHoCH" },
];

/**
 * The whole Manual SL/TP experience. Chart timeframe and overlays are DISPLAY settings: nothing in this component sends a
 * timeframe to the backend, so changing them cannot affect an order or an open position.
 */
export function ManualQuickTradeSection({ workspaceId }: { workspaceId: string }) {
  const status = useManualStatus(workspaceId);
  const setEnabled = useSetManualEnabled(workspaceId);
  const [symbol, setSymbol] = useState<string>(MANUAL_SYMBOLS[0]);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("15m");
  const [toggles, setToggles] = useState<OverlayToggles>(DEFAULT_OVERLAYS);
  const [form, setForm] = useState<OrderForm | null>(null);
  const [preview, setPreview] = useState<ManualPreview | null>(null);

  const candles = useManualChartCandles(symbol, timeframe);
  const active = useManualPositions(workspaceId, "active");
  const history = useManualPositions(workspaceId, "history");

  const onFormChange = useCallback((f: OrderForm, p: ManualPreview | null) => { setForm(f); setPreview(p); }, []);

  const openForSymbol = active.data?.find((p) => p.symbol === symbol && !p.is_terminal) ?? null;
  const planned = useMemo(() => (form ? localEstimate(form, candles.lastPrice) : null), [form, candles.lastPrice]);

  const lines = useMemo<ChartLine[]>(() => {
    if (openForSymbol) {
      const liq = openForSymbol.exchange_liquidation_price ?? openForSymbol.estimated_liquidation_price;
      return [
        { price: openForSymbol.entry_price, title: "Entry", color: "#3b82f6" },
        { price: openForSymbol.sl_trigger_price, title: "SL", color: "#ef4444" },
        { price: openForSymbol.tp_trigger_price, title: "TP", color: "#22c55e" },
        { price: candles.lastPrice, title: "Price", color: "#e2e8f0", dashed: true, width: 1 },
        { price: liq, title: openForSymbol.exchange_liquidation_price != null ? "Liq" : "Liq (est)", color: "#f97316", dashed: true },
      ];
    }
    if (form && form.symbol === symbol && planned) {
      return [
        { price: candles.lastPrice, title: "Plan entry", color: "#3b82f6", dashed: true, width: 1 },
        { price: preview?.sl_trigger_price ?? planned.slTrigger, title: "Plan SL", color: "#ef4444", dashed: true, width: 1 },
        { price: preview?.take_profit?.trigger_price ?? planned.tpTrigger, title: "Plan TP", color: "#22c55e", dashed: true, width: 1 },
        { price: preview?.estimated_liquidation_price, title: "Liq (est)", color: "#f97316", dashed: true, width: 1 },
      ];
    }
    return [{ price: candles.lastPrice, title: "Price", color: "#e2e8f0", dashed: true, width: 1 }];
  }, [openForSymbol, form, planned, preview, candles.lastPrice, symbol]);

  if (status.isLoading) return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-400">Loading Manual SL/TP...</div>;
  if (status.isError || !status.data) {
    return <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">Manual SL/TP status is unavailable: {parseApiError((status.error as Error | null)?.message ?? "").text}</div>;
  }
  const st = status.data;

  if (!st.enabled) {
    return (
      <Card className="border-slate-800 bg-slate-950/80 text-slate-100">
        <CardHeader><CardTitle className="text-lg">Manual SL/TP is turned off</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          <div className="flex flex-wrap gap-2">
            <Badge className={st.server_enabled ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700/50 text-slate-300"}>Server flag: {st.server_enabled ? "on" : "off"}</Badge>
            <Badge className={st.workspace_enabled ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700/50 text-slate-300"}>Workspace flag: {st.workspace_enabled ? "on" : "off"}</Badge>
          </div>
          <p>This mode needs both flags. It has not been verified against the exchange yet ({st.exchange_verification.replace(/_/g, " ")}); it is limited to Binance TESTNET until the verification checklist is completed.</p>
          {!st.server_enabled && <p className="text-amber-300">The server flag is set by the operator on the server (QUICK_TRADE_MANUAL_ENABLED). It cannot be changed from this page.</p>}
          {st.server_enabled && !st.workspace_enabled && (
            st.can_manage
              ? <Button className="bg-blue-600 text-white hover:bg-blue-500" disabled={setEnabled.isPending} onClick={() => setEnabled.mutate(true)}>Enable for this workspace</Button>
              : <p className="text-amber-300">A workspace owner or admin must enable it.</p>
          )}
          {setEnabled.isError && <p className="text-rose-300">{parseApiError((setEnabled.error as Error).message).text}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-xs text-slate-400">
        <Info className="h-4 w-4 text-blue-300" />
        <span>Manual SL/TP: you pick the side; the stop-loss is placed ON the exchange and survives closing this page or restarting the server. Not verified on the exchange yet - {st.allow_mainnet ? "mainnet allowed" : "TESTNET only"}.</span>
        {st.can_manage && <Button size="sm" variant="ghost" className="ml-auto h-7 text-slate-400" disabled={setEnabled.isPending} onClick={() => setEnabled.mutate(false)}>Disable for workspace</Button>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <div className="rounded-[24px] border border-slate-800 bg-slate-950/80 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="text-sm font-bold text-slate-100">{symbol}</div>
              <div className="ml-2 flex gap-1">
                {CHART_TIMEFRAMES.map((tf) => (
                  <Button key={tf} size="sm" variant="ghost" className={cn("h-7 px-2", timeframe === tf ? "bg-slate-100 text-slate-950" : "bg-slate-900 text-slate-300")} onClick={() => setTimeframe(tf)}>{tf}</Button>
                ))}
              </div>
              <span className="text-xs text-slate-500">Chart timeframe only - it never changes an order or a position.</span>
              <span className="ml-auto text-xs text-slate-500">{candles.connected ? "live" : "connecting..."}{candles.loadingHistory ? " - loading history" : ""}</span>
            </div>
            <ManualTradeChart candles={candles.bars} toggles={toggles} lines={lines} height={440} />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {OVERLAY_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-1.5 text-xs text-slate-300">
                  <Checkbox checked={toggles[key]} onCheckedChange={(v) => setToggles((t) => ({ ...t, [key]: v === true }))} />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Overlays are visual aids computed only from candles already closed; they never place or change a trade.</div>
          </div>
        </div>
        <ManualOrderForm workspaceId={workspaceId} status={st} symbol={symbol} onSymbolChange={setSymbol} lastPrice={candles.lastPrice} onFormChange={onFormChange} />
      </div>

      <ManualPositionPanel workspaceId={workspaceId} positions={active.data ?? []} title="Open manual positions" empty="No open manual positions." />
      <ManualPositionPanel workspaceId={workspaceId} positions={(history.data ?? []).slice(0, 10)} title="Recent manual positions" empty="No finished manual positions yet." />
    </div>
  );
}
