import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useManualPreview, useOpenManualPosition } from "@/hooks/useQuickTradeManual";
import {
  MANUAL_SYMBOLS,
  buildOpenRequest,
  buildPreviewRequest,
  fmtPnl,
  fmtPrice,
  localEstimate,
  parseApiError,
  type ManualDirection,
  type ManualPosition,
  type ManualPreview,
  type ManualStatus,
  type OrderForm,
  type ProtectionPairInput,
} from "@/lib/manualTrade";
import { cn } from "@/lib/utils";

interface Props {
  workspaceId: string;
  status: ManualStatus;
  integrationId: string;
  symbols: { symbol: string; display?: string }[];
  symbol: string;
  onSymbolChange: (s: string) => void;
  lastPrice: number | null;
  /** Reports the current form so the chart can draw the planned entry/SL/TP. */
  onFormChange: (f: OrderForm, preview: ManualPreview | null) => void;
  protectionPairs: ProtectionPairInput[];
  setProtectionPairs: React.Dispatch<React.SetStateAction<ProtectionPairInput[]>>;
}

const OUTCOME_TEXT: Record<string, { text: string; tone: "ok" | "warn" | "bad" }> = {
  open_protected: { text: "Position opened. Exchange stop-loss placed and VERIFIED by the exchange.", tone: "ok" },
  open_no_stop_loss: { text: "Position opened WITHOUT a stop-loss (your explicit choice). Nothing closes it automatically except liquidation: close it manually.", tone: "warn" },
  protection_failed_emergency_closed: { text: "The exchange stop-loss could not be verified, so the position was closed immediately (confirmed flat by the exchange). No position is open.", tone: "bad" },
  close_unconfirmed_position_may_be_unprotected: { text: "CRITICAL: the stop-loss could not be verified and the emergency close was NOT confirmed by the exchange. The position may be open and unprotected. Check Binance now.", tone: "bad" },
  state_unknown_reconciling: { text: "The exchange did not give a clear answer for the entry. The system is reconciling it against the exchange; check the open positions list shortly.", tone: "warn" },
  entry_failed: { text: "The entry did not fill. Nothing is open and the reserved stake was released.", tone: "bad" },
};

export function ManualProtectionPairEditor({ pairs, setPairs, disabled = false }: { pairs: ProtectionPairInput[]; setPairs: React.Dispatch<React.SetStateAction<ProtectionPairInput[]>>; disabled?: boolean }) {
  return <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5"><div className="mb-4 flex items-center justify-between"><div><div className="text-base font-black uppercase tracking-[0.16em] text-violet-200">TP observation / reversal stages</div><div className="mt-1 text-sm text-slate-400">TP levels do not close the position; they activate their paired stop.</div></div><Button type="button" size="sm" variant="outline" disabled={disabled || pairs.length >= 20} onClick={() => setPairs((prev) => [...prev, { tpMode: "percent", tpValue: 1, slMode: "fixed", slInputMode: "percent", slValue: 0.5 }])}>+ Add TP/SL</Button></div><div className="space-y-3">{pairs.map((pair, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-700 bg-slate-950/80 p-4 md:grid-cols-[70px_120px_1fr_70px_150px_1fr_auto] md:items-end"><div><Label className="text-xs text-slate-500">TP level</Label><div className="mt-2 text-lg font-black text-emerald-300">TP{index + 1}</div></div><div><Label className="text-xs text-slate-400">TP type</Label><Select value={pair.tpMode} onValueChange={(value: "percent" | "price") => setPairs((prev) => prev.map((x, i) => i === index ? { ...x, tpMode: value } : x))}><SelectTrigger className="mt-1 border-slate-700 bg-slate-900 text-slate-100"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">Percent %</SelectItem><SelectItem value="price">Exact price</SelectItem></SelectContent></Select></div><div><Label className="text-xs text-slate-400">TP{index + 1} value</Label><Input type="number" step="any" placeholder={pair.tpMode === "percent" ? "e.g. 1.0" : "e.g. 72500"} value={pair.tpValue ?? ""} onChange={(e) => setPairs((prev) => prev.map((x, i) => i === index ? { ...x, tpValue: e.target.value === "" ? null : Number(e.target.value) } : x))} className="mt-1 border-slate-700 bg-slate-900 text-slate-100" /></div><div><Label className="text-xs text-slate-500">SL level</Label><div className="mt-2 text-lg font-black text-orange-300">SL{index + 1}</div></div><div><Label className="text-xs text-slate-400">SL type</Label><Select value={pair.slMode} onValueChange={(value: "fixed" | "trailing") => setPairs((prev) => prev.map((x, i) => i === index ? { ...x, slMode: value, slInputMode: value === "trailing" && x.slInputMode === "price" ? "percent" : x.slInputMode } : x))}><SelectTrigger className="mt-1 border-slate-700 bg-slate-900 text-slate-100"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed stop</SelectItem><SelectItem value="trailing">Dynamic trailing</SelectItem></SelectContent></Select></div><div><Label className="text-xs text-slate-400">SL{index + 1} value</Label><div className="mt-1 flex gap-2"><Select value={pair.slInputMode} onValueChange={(value: "percent" | "price" | "distance") => setPairs((prev) => prev.map((x, i) => i === index ? { ...x, slInputMode: value } : x))}><SelectTrigger className="w-[120px] border-slate-700 bg-slate-900 text-slate-100"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">Percent %</SelectItem><SelectItem value="price" disabled={pair.slMode === "trailing"}>Exact price</SelectItem><SelectItem value="distance">Distance</SelectItem></SelectContent></Select><Input type="number" step="any" placeholder="value" value={pair.slValue ?? ""} onChange={(e) => setPairs((prev) => prev.map((x, i) => i === index ? { ...x, slValue: e.target.value === "" ? null : Number(e.target.value) } : x))} className="border-slate-700 bg-slate-900 text-slate-100" /></div></div><Button type="button" variant="ghost" className="text-rose-300" onClick={() => setPairs((prev) => prev.filter((_, i) => i !== index))}>Remove</Button></div>)}</div></div>;
}

/** Order form for Manual SL/TP + the two-step (Review, then separate final confirmation) open flow. */
export function ManualOrderForm({ workspaceId, status, integrationId, symbols, symbol, onSymbolChange, lastPrice, onFormChange, protectionPairs, setProtectionPairs }: Props) {
  const { toast } = useToast();
  const limits = status.limits;
  const [direction, setDirection] = useState<ManualDirection>("long");
  const [stake, setStake] = useState<number>(Math.max(limits.min_stake, 20));
  const [leverage, setLeverage] = useState<number>(5);
  const [slPct, setSlPct] = useState<number | null>(1);
  const [tpPct, setTpPct] = useState<number | null>(null);
  const [trailingPct, setTrailingPct] = useState<number | null>(null);
  const [trailingActivationPct, setTrailingActivationPct] = useState<number | null>(null);
  const [noStop, setNoStop] = useState(false);
  const [noStopAck, setNoStopAck] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [openError, setOpenError] = useState<{ code: string; text: string } | null>(null);
  const [symbolSearch, setSymbolSearch] = useState("");
  const [symbolPage, setSymbolPage] = useState(0);
  const [result, setResult] = useState<ManualPosition | null>(null);
  const idemRef = useRef<string>("");

  const noStopAllowed = status.allow_no_stop_loss === true;
  const noStopActive = noStopAllowed && noStop;
  const maxLeverage = noStopActive ? Math.min(limits.max_leverage, limits.no_stop_loss_max_leverage) : limits.max_leverage;
  const form = useMemo<OrderForm>(() => ({ symbol, direction, stake, leverage, slPct, noStopLoss: noStopActive, tpPct, trailingPct: noStopActive ? null : trailingPct, trailingActivationPct: noStopActive ? null : trailingActivationPct, protectionPairs: noStopActive ? [] : protectionPairs }), [symbol, direction, stake, leverage, slPct, noStopActive, tpPct, trailingPct, trailingActivationPct, protectionPairs]);
  const preview = useManualPreview(workspaceId);
  const open = useOpenManualPosition(workspaceId);

  const valid = (noStopActive || (slPct != null && slPct >= limits.min_sl_pct && slPct <= limits.max_sl_pct))
    && stake >= limits.min_stake && stake <= limits.max_stake
    && Number.isInteger(leverage) && leverage >= 1 && leverage <= maxLeverage
    && (tpPct == null || tpPct > 0);
  const trailingValid = trailingPct == null || (trailingPct >= limits.min_trailing_pct && trailingPct <= limits.max_trailing_pct && (trailingActivationPct == null || (trailingActivationPct >= 0 && trailingActivationPct <= limits.max_trailing_activation_pct)));

  // Exchange-backed preview, debounced. The review screen shows ONLY this (never the local estimate).
  const previewMutate = preview.mutate;
  useEffect(() => {
    if (!valid) return;
    const t = window.setTimeout(() => previewMutate(buildPreviewRequest(form, integrationId)), 600);
    return () => window.clearTimeout(t);
  }, [form, integrationId, valid, previewMutate]);

  const p = valid && preview.data?.integration_id === integrationId ? preview.data : null;
  const filteredSymbols = useMemo(() => {
    const query = symbolSearch.trim().toUpperCase();
    return symbols.filter((item) => !query || item.symbol.includes(query) || (item.display ?? "").toUpperCase().includes(query));
  }, [symbolSearch, symbols]);
  const symbolPageCount = Math.max(1, Math.ceil(filteredSymbols.length / 10));
  const pagedSymbols = filteredSymbols.slice(symbolPage * 10, symbolPage * 10 + 10);
  useEffect(() => { setSymbolPage((page) => Math.min(page, symbolPageCount - 1)); }, [symbolPageCount]);
  useEffect(() => { setSymbolPage(0); }, [symbolSearch]);
  useEffect(() => { onFormChange(form, p); }, [form, p, onFormChange]);

  const local = useMemo(() => localEstimate(form, lastPrice), [form, lastPrice]);
  const blocking = p && !p.ok ? p.errors : [];

  const openReview = () => {
    idemRef.current = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `qtm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setAck(false);
    setNoStopAck(false);
    setOpenError(null);
    setResult(null);
    setReviewOpen(true);
  };

  const confirm = () => {
    if (!p) return;
    setOpenError(null);
    open.mutate(buildOpenRequest(form, { idempotencyKey: idemRef.current, referencePrice: p.reference_price, integrationId: p.integration_id, noStopLossAck: noStopAck }), {
      onSuccess: (pos) => {
        setResult(pos);
        idemRef.current = "";
        if (pos.outcome === "open_protected" || pos.outcome === "open_no_stop_loss") {
          setReviewOpen(false);
          toast({ title: "Manual position opened", description: `${pos.direction.toUpperCase()} ${pos.symbol} - ${pos.no_stop_loss ? "NO stop-loss, close manually" : "exchange stop verified"}` });
        }
      },
      onError: (e) => {
        const err = parseApiError((e as Error).message);
        setOpenError(err);
        if (err.code === "price_moved" || err.code === "stale_mark_price") {
          idemRef.current = "";   // nothing was sent: a fresh confirmation needs a fresh request id
          previewMutate(buildPreviewRequest(form, integrationId));
        }
      },
    });
  };

  const numInput = (value: number | null, set: (n: number | null) => void, extra?: { step?: string; min?: number }) => (
    <Input
      type="number"
      inputMode="decimal"
      step={extra?.step ?? "any"}
      min={extra?.min}
      value={value ?? ""}
      onChange={(e) => set(e.target.value === "" ? null : Number(e.target.value))}
      className="border-slate-800 bg-slate-950 text-slate-100"
    />
  );

  const unknownResult = openError && openError.code === "error";

  return (
    <div className="space-y-4 rounded-[24px] border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Manual order</div>
        <Badge className="bg-blue-500/10 text-blue-300">No Expiry</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="ghost" className={cn("h-12 text-base font-bold", direction === "long" ? "bg-emerald-500 text-slate-950" : "bg-slate-900 text-slate-300")} onClick={() => setDirection("long")}>BUY / LONG</Button>
        <Button type="button" variant="ghost" className={cn("h-12 text-base font-bold", direction === "short" ? "bg-rose-500 text-white" : "bg-slate-900 text-slate-300")} onClick={() => setDirection("short")}>SELL / SHORT</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-slate-400">Symbol</Label>
          <Input value={symbolSearch} onChange={(event) => setSymbolSearch(event.target.value)} placeholder="Search Binance coin..." className="mb-2 border-slate-800 bg-slate-950 text-slate-100" />
          <Select value={symbol} onValueChange={onSymbolChange}>
            <SelectTrigger className="border-slate-800 bg-slate-950 text-slate-100"><SelectValue /></SelectTrigger>
            <SelectContent>
              {pagedSymbols.map((s) => <SelectItem key={s.symbol} value={s.symbol}>{s.display ?? s.symbol}</SelectItem>)}
              {pagedSymbols.length === 0 && <div className="px-2 py-1.5 text-xs text-slate-500">No matching Binance coin</div>}
            </SelectContent>
          </Select>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{filteredSymbols.length} coins · showing {Math.min(10, filteredSymbols.length)} per page</span>
            <span className="flex items-center gap-1">
              <Button type="button" size="sm" variant="ghost" disabled={symbolPage === 0} className="h-6 px-2" onClick={() => setSymbolPage((page) => Math.max(0, page - 1))}>Prev</Button>
              <span>{symbolPage + 1}/{symbolPageCount}</span>
              <Button type="button" size="sm" variant="ghost" disabled={symbolPage >= symbolPageCount - 1} className="h-6 px-2" onClick={() => setSymbolPage((page) => Math.min(symbolPageCount - 1, page + 1))}>Next</Button>
            </span>
          </div>
        </div>
        <div className="hidden col-span-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">TP observation / reversal stages</div>
              <div className="text-[11px] text-slate-400">TP levels do not close the position; they activate their paired stop.</div>
            </div>
            <Button type="button" size="sm" variant="outline" disabled={noStopActive || protectionPairs.length >= 20} onClick={() => { setTpPct(null); setProtectionPairs((prev) => [...prev, { tpMode: "percent", tpValue: 1, slMode: "fixed", slInputMode: "percent", slValue: 0.5 }]); }}>+ Add TP/SL</Button>
          </div>
          <div className="space-y-2">
            {protectionPairs.map((pair, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2 md:grid-cols-6">
                <div className="text-xs font-semibold text-slate-300">TP{index + 1}</div>
                <Select value={pair.tpMode} onValueChange={(value: "percent" | "price") => setProtectionPairs((prev) => prev.map((x, i) => i === index ? { ...x, tpMode: value } : x))}><SelectTrigger className="border-slate-800 bg-slate-900 text-slate-100"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">%</SelectItem><SelectItem value="price">Price</SelectItem></SelectContent></Select>
                <Input type="number" step="any" value={pair.tpValue ?? ""} onChange={(e) => setProtectionPairs((prev) => prev.map((x, i) => i === index ? { ...x, tpValue: e.target.value === "" ? null : Number(e.target.value) } : x))} className="border-slate-800 bg-slate-900 text-slate-100" />
                <div className="text-xs font-semibold text-slate-300">SL{index + 1}</div>
                <Select value={pair.slMode} onValueChange={(value: "fixed" | "trailing") => setProtectionPairs((prev) => prev.map((x, i) => i === index ? { ...x, slMode: value } : x))}><SelectTrigger className="border-slate-800 bg-slate-900 text-slate-100"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="trailing">Dynamic trailing</SelectItem></SelectContent></Select>
                <div className="flex gap-1"><Input type="number" step="any" value={pair.slValue ?? ""} onChange={(e) => setProtectionPairs((prev) => prev.map((x, i) => i === index ? { ...x, slValue: e.target.value === "" ? null : Number(e.target.value) } : x))} className="border-slate-800 bg-slate-900 text-slate-100" /><Button type="button" size="sm" variant="ghost" className="text-rose-300" onClick={() => setProtectionPairs((prev) => prev.filter((_, i) => i !== index))}>×</Button></div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-400">Stake / margin (USDT)</Label>
          {numInput(stake, (n) => setStake(n ?? 0), { min: limits.min_stake })}
        </div>
        <div>
          <Label className="text-xs text-slate-400">Leverage (whole number, max {maxLeverage}x{noStopActive ? " without a stop-loss" : ""})</Label>
          {numInput(leverage, (n) => setLeverage(n ?? 0), { step: "1", min: 1 })}
        </div>
        <div>
          <Label className="text-xs text-slate-400">{noStopActive ? "Stop-loss % - NONE (opted out)" : "Stop-loss % (recommended, required by default) - price movement"}</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={limits.min_sl_pct}
            disabled={noStopActive}
            value={noStopActive ? "" : slPct ?? ""}
            placeholder={noStopActive ? "no stop-loss" : undefined}
            onChange={(e) => setSlPct(e.target.value === "" ? null : Number(e.target.value))}
            className="border-slate-800 bg-slate-950 text-slate-100"
          />
        </div>
        {noStopAllowed && (
          <label className="col-span-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-100">
            <Checkbox checked={noStop} onCheckedChange={(v) => setNoStop(v === true)} className="mt-0.5" />
            <span>
              Trade <b>without a stop-loss</b> (not recommended). The position has no expiry and no automatic exit except take-profit and liquidation; you must watch it and close it manually. Max {limits.no_stop_loss_max_leverage}x leverage, isolated margin only.
            </span>
          </label>
        )}
        <div className="col-span-2">
          <Label className="text-xs text-slate-400">Take-profit % (optional) - price movement</Label>
          {numInput(tpPct, setTpPct, { step: "0.1", min: 0 })}
        </div>
        <div>
          <Label className="text-xs text-slate-400">Trailing give-back % (optional)</Label>
          {numInput(trailingPct, setTrailingPct, { step: "0.1", min: limits.min_trailing_pct })}
        </div>
        <div>
          <Label className="text-xs text-slate-400">Trail activation profit %</Label>
          {numInput(trailingActivationPct, setTrailingActivationPct, { step: "0.1", min: 0 })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
        <div className="mb-1 text-slate-400">
          {noStopActive ? (
            <span className="text-amber-200"><b>NO STOP-LOSS.</b> If price reaches the liquidation price you can lose your entire margin ({fmtPrice(stake)} USDT). The liquidation price below is approximate; the exchange figure is authoritative.</span>
          ) : (
            <>Stop-loss % is the <b>price movement</b> against you (not margin %). With {leverage}x leverage a {slPct ?? "-"}% price move is about {slPct != null ? (slPct * leverage).toFixed(1) : "-"}% of your margin before fees.</>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <span className="text-slate-500">Notional</span><span>{fmtPrice(p?.notional ?? local?.notional)} USDT</span>
          <span className="text-slate-500">Quantity</span><span>{p?.quantity ?? (local ? local.quantity.toFixed(4) : "-")}{p ? "" : local ? " (est.)" : ""}</span>
          <span className="text-slate-500">Stop-loss trigger</span>{noStopActive ? <span className="font-semibold text-amber-300">none - close manually</span> : <span className="text-rose-300">{fmtPrice(p?.sl_trigger_price ?? local?.slTrigger)}{p ? "" : local ? " (est.)" : ""}</span>}
          <span className="text-slate-500">Take-profit trigger</span><span className="text-emerald-300">{p?.take_profit ? fmtPrice(p.take_profit.trigger_price) : local?.tpTrigger ? `${fmtPrice(local.tpTrigger)} (est.)` : "not set"}</span>
          {noStopActive ? (
            <><span className="text-slate-500">Worst case (approx.)</span><span>{p?.max_loss_without_stop_estimate != null ? `~${fmtPrice(p.max_loss_without_stop_estimate)} USDT (entire margin at liquidation)` : "-"}</span></>
          ) : (
            <><span className="text-slate-500">Est. loss at stop (after fees)</span><span>{p && p.estimated_loss_at_sl != null && p.margin_loss_pct_at_sl != null ? `${fmtPrice(p.estimated_loss_at_sl)} USDT (${p.margin_loss_pct_at_sl.toFixed(1)}% of margin)` : "-"}</span></>
          )}
          <span className="text-slate-500">Est. liquidation (approx.)</span><span className="text-amber-300">{p ? fmtPrice(p.estimated_liquidation_price) : "-"}</span>
        </div>
        {preview.isPending && <div className="mt-1 text-slate-500">Checking the exchange...</div>}
        {preview.isError && <div className="mt-1 text-rose-300">{parseApiError((preview.error as Error).message).text}</div>}
        {p?.live_gate && <div className="mt-1 text-amber-300">{p.live_gate}</div>}
        {blocking.map((e) => <div key={e.code} className="mt-1 text-rose-300">{e.message}</div>)}
        {!trailingValid && <div className="mt-1 text-rose-300">Trailing values are outside the allowed exchange range.</div>}
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full bg-blue-600 font-bold text-white hover:bg-blue-500"
        disabled={!valid || !trailingValid || !p || !p.ok || preview.isPending || open.isPending || Boolean(p?.live_gate)}
        onClick={openReview}
      >
        Review &amp; Open Position
      </Button>

      {result && result.outcome !== "open_protected" && result.outcome !== "open_no_stop_loss" && (
        <div className={cn("rounded-xl border px-3 py-2 text-sm", (OUTCOME_TEXT[result.outcome]?.tone ?? "warn") === "bad" ? "border-rose-500/40 bg-rose-500/10 text-rose-100" : "border-amber-500/40 bg-amber-500/10 text-amber-100")}>
          {OUTCOME_TEXT[result.outcome]?.text ?? `Result: ${result.status}`}
        </div>
      )}

      <Dialog open={reviewOpen} onOpenChange={(o) => { if (!open.isPending) setReviewOpen(o); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-100 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirm: {direction === "long" ? "BUY / LONG" : "SELL / SHORT"} {symbol}</DialogTitle>
            <DialogDescription className="text-slate-400">
              This opens a real {p?.environment === "testnet" ? "TESTNET" : "LIVE"} futures position {noStopActive ? "WITHOUT a stop-loss" : "with an exchange-side stop-loss"}. There is no expiry.
            </DialogDescription>
          </DialogHeader>
          {p && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm">
              <span className="text-slate-500">Reference (mark) price</span><span>{fmtPrice(p.reference_price)}</span>
              <span className="text-slate-500">Quantity</span><span>{p.quantity}</span>
              <span className="text-slate-500">Notional</span><span>{fmtPrice(p.notional)} USDT</span>
              <span className="text-slate-500">Margin / leverage</span><span>{fmtPrice(p.margin_required)} USDT / {p.leverage}x ({p.position_mode.replace("_", "-")}, {p.margin_type ?? "margin type unknown"})</span>
              {p.no_stop_loss ? (
                <>
                  <span className="text-slate-500">Stop-loss</span><span className="font-semibold text-amber-300">NONE - you must close manually</span>
                  <span className="text-slate-500">Worst case (approx.)</span><span>~{fmtPrice(p.max_loss_without_stop_estimate)} USDT (entire margin at liquidation)</span>
                  <span className="text-slate-500">Entry fee (estimate)</span><span>{fmtPrice(p.entry_fee_estimate, 4)} USDT</span>
                </>
              ) : (
                <>
                  <span className="text-slate-500">Stop-loss</span><span className="text-rose-300">{p.sl_pct}% price move = trigger {fmtPrice(p.sl_trigger_price)}</span>
                  <span className="text-slate-500">Expected loss at stop</span><span>{fmtPrice(p.estimated_loss_at_sl)} USDT ({(p.margin_loss_pct_at_sl ?? 0).toFixed(1)}% of margin, after fees)</span>
                  <span className="text-slate-500">Fees (entry + exit at stop)</span><span>{fmtPrice(p.entry_fee_estimate + (p.exit_fee_estimate_at_sl ?? 0), 4)} USDT</span>
                </>
              )}
              <span className="text-slate-500">Slippage risk (est.)</span><span>{fmtPrice(p.slippage_risk_estimate, 4)} USDT</span>
              <span className="text-slate-500">Take-profit</span><span className="text-emerald-300">{p.take_profit ? `${fmtPrice(p.take_profit.trigger_price)} (net ${fmtPnl(p.take_profit.net_profit)} USDT)` : "not set"}</span>
              <span className="text-slate-500">Trailing exit</span><span className="text-violet-300">{trailingPct != null ? `${trailingPct}% give-back${trailingActivationPct != null ? ` after +${trailingActivationPct}%` : " immediately"}` : "not set"}</span>
              <span className="text-slate-500">Est. liquidation (approx.)</span><span className="text-amber-300">{fmtPrice(p.estimated_liquidation_price)} ({p.estimated_liquidation_distance_pct?.toFixed(2)}% away)</span>
              <span className="text-slate-500">Funding</span><span>{p.funding_rate != null ? `${(p.funding_rate * 100).toFixed(4)}% / 8h` : "unknown"}</span>
              <span className="text-slate-500">Expiry</span><span className="font-semibold">None - stays open until a verified exit</span>
            </div>
          )}
          <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100">
            {(p?.warnings ?? []).map((w) => <div key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{w}</div>)}
          </div>
          {p?.no_stop_loss && (
            <label className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-2 text-sm text-rose-100">
              <Checkbox checked={noStopAck} onCheckedChange={(v) => setNoStopAck(v === true)} className="mt-0.5" />
              <span>I am opening this position with <b>NO stop-loss</b>. Nothing will close it automatically except take-profit (if set) and liquidation. I must watch it and close it manually, and I can lose my entire margin.</span>
            </label>
          )}
          <label className="flex items-start gap-2 text-sm text-slate-200">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
            <span>{p?.no_stop_loss ? "I understand funding and liquidation risk apply and this position stays open until I close it." : "I understand the stop-loss does not guarantee a maximum loss, funding and liquidation risk apply, and this position stays open until it is closed or stopped out."}</span>
          </label>
          {openError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-sm text-rose-100">
              {openError.text}
              {unknownResult && <div className="mt-1 text-xs text-rose-200">The result of this request is unknown. Retrying uses the SAME request id, so it can never open a second position. Also check the open positions list.</div>}
            </div>
          )}
          {result && result.outcome !== "open_protected" && result.outcome !== "open_no_stop_loss" && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-100">{OUTCOME_TEXT[result.outcome]?.text ?? `Result: ${result.status}`}</div>
          )}
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-100" disabled={open.isPending} onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 font-bold text-white hover:bg-blue-500" disabled={!ack || !p || (p.no_stop_loss && !noStopAck) || open.isPending || (result != null)} onClick={confirm}>
              {open.isPending ? "Opening..." : unknownResult ? "Retry (same request)" : "Confirm & open position"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
