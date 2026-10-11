import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
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
} from "@/lib/manualTrade";
import { cn } from "@/lib/utils";

interface Props {
  workspaceId: string;
  status: ManualStatus;
  symbol: string;
  onSymbolChange: (s: string) => void;
  lastPrice: number | null;
  /** Reports the current form so the chart can draw the planned entry/SL/TP. */
  onFormChange: (f: OrderForm, preview: ManualPreview | null) => void;
}

const OUTCOME_TEXT: Record<string, { text: string; tone: "ok" | "warn" | "bad" }> = {
  open_protected: { text: "Position opened. Exchange stop-loss placed and VERIFIED by the exchange.", tone: "ok" },
  protection_failed_emergency_closed: { text: "The exchange stop-loss could not be verified, so the position was closed immediately (confirmed flat by the exchange). No position is open.", tone: "bad" },
  close_unconfirmed_position_may_be_unprotected: { text: "CRITICAL: the stop-loss could not be verified and the emergency close was NOT confirmed by the exchange. The position may be open and unprotected. Check Binance now.", tone: "bad" },
  state_unknown_reconciling: { text: "The exchange did not give a clear answer for the entry. The system is reconciling it against the exchange; check the open positions list shortly.", tone: "warn" },
  entry_failed: { text: "The entry did not fill. Nothing is open and the reserved stake was released.", tone: "bad" },
};

/** Order form for Manual SL/TP + the two-step (Review, then separate final confirmation) open flow. */
export function ManualOrderForm({ workspaceId, status, symbol, onSymbolChange, lastPrice, onFormChange }: Props) {
  const { toast } = useToast();
  const limits = status.limits;
  const [direction, setDirection] = useState<ManualDirection>("long");
  const [stake, setStake] = useState<number>(Math.max(limits.min_stake, 20));
  const [leverage, setLeverage] = useState<number>(5);
  const [slPct, setSlPct] = useState<number | null>(1);
  const [tpPct, setTpPct] = useState<number | null>(null);
  const [trailingPct, setTrailingPct] = useState<number | null>(null);
  const [trailingActivationPct, setTrailingActivationPct] = useState<number | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [openError, setOpenError] = useState<{ code: string; text: string } | null>(null);
  const [result, setResult] = useState<ManualPosition | null>(null);
  const idemRef = useRef<string>("");

  const form = useMemo<OrderForm>(() => ({ symbol, direction, stake, leverage, slPct, tpPct, trailingPct, trailingActivationPct }), [symbol, direction, stake, leverage, slPct, tpPct, trailingPct, trailingActivationPct]);
  const preview = useManualPreview(workspaceId);
  const open = useOpenManualPosition(workspaceId);

  const valid = slPct != null && slPct >= limits.min_sl_pct && slPct <= limits.max_sl_pct
    && stake >= limits.min_stake && stake <= limits.max_stake
    && Number.isInteger(leverage) && leverage >= 1 && leverage <= limits.max_leverage
    && (tpPct == null || tpPct > 0);
  const trailingValid = trailingPct == null || (trailingPct >= limits.min_trailing_pct && trailingPct <= limits.max_trailing_pct && (trailingActivationPct == null || (trailingActivationPct >= 0 && trailingActivationPct <= limits.max_trailing_activation_pct)));

  // Exchange-backed preview, debounced. The review screen shows ONLY this (never the local estimate).
  const previewMutate = preview.mutate;
  useEffect(() => {
    if (!valid) return;
    const t = window.setTimeout(() => previewMutate(buildPreviewRequest(form)), 600);
    return () => window.clearTimeout(t);
  }, [form, valid, previewMutate]);

  const p = valid ? preview.data ?? null : null;
  useEffect(() => { onFormChange(form, p); }, [form, p, onFormChange]);

  const local = useMemo(() => localEstimate(form, lastPrice), [form, lastPrice]);
  const blocking = p && !p.ok ? p.errors : [];

  const openReview = () => {
    idemRef.current = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `qtm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setAck(false);
    setOpenError(null);
    setResult(null);
    setReviewOpen(true);
  };

  const confirm = () => {
    if (!p) return;
    setOpenError(null);
    open.mutate(buildOpenRequest(form, { idempotencyKey: idemRef.current, referencePrice: p.reference_price, integrationId: p.integration_id }), {
      onSuccess: (pos) => {
        setResult(pos);
        idemRef.current = "";
        if (pos.outcome === "open_protected") {
          setReviewOpen(false);
          toast({ title: "Manual position opened", description: `${pos.direction.toUpperCase()} ${pos.symbol} - exchange stop verified` });
        }
      },
      onError: (e) => {
        const err = parseApiError((e as Error).message);
        setOpenError(err);
        if (err.code === "price_moved" || err.code === "stale_mark_price") {
          idemRef.current = "";   // nothing was sent: a fresh confirmation needs a fresh request id
          previewMutate(buildPreviewRequest(form));
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
          <Select value={symbol} onValueChange={onSymbolChange}>
            <SelectTrigger className="border-slate-800 bg-slate-950 text-slate-100"><SelectValue /></SelectTrigger>
            <SelectContent>{MANUAL_SYMBOLS.filter((s) => limits.symbols.includes(s)).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-400">Stake / margin (USDT)</Label>
          {numInput(stake, (n) => setStake(n ?? 0), { min: limits.min_stake })}
        </div>
        <div>
          <Label className="text-xs text-slate-400">Leverage (whole number, max {limits.max_leverage}x)</Label>
          {numInput(leverage, (n) => setLeverage(n ?? 0), { step: "1", min: 1 })}
        </div>
        <div>
          <Label className="text-xs text-slate-400">Stop-loss % (required) - price movement</Label>
          {numInput(slPct, setSlPct, { step: "0.1", min: limits.min_sl_pct })}
        </div>
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
          Stop-loss % is the <b>price movement</b> against you (not margin %). With {leverage}x leverage a {slPct ?? "-"}% price move is about {slPct != null ? (slPct * leverage).toFixed(1) : "-"}% of your margin before fees.
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <span className="text-slate-500">Notional</span><span>{fmtPrice(p?.notional ?? local?.notional)} USDT</span>
          <span className="text-slate-500">Quantity</span><span>{p?.quantity ?? (local ? local.quantity.toFixed(4) : "-")}{p ? "" : local ? " (est.)" : ""}</span>
          <span className="text-slate-500">Stop-loss trigger</span><span className="text-rose-300">{fmtPrice(p?.sl_trigger_price ?? local?.slTrigger)}{p ? "" : local ? " (est.)" : ""}</span>
          <span className="text-slate-500">Take-profit trigger</span><span className="text-emerald-300">{p?.take_profit ? fmtPrice(p.take_profit.trigger_price) : local?.tpTrigger ? `${fmtPrice(local.tpTrigger)} (est.)` : "not set"}</span>
          <span className="text-slate-500">Est. loss at stop (after fees)</span><span>{p ? `${fmtPrice(p.estimated_loss_at_sl)} USDT (${p.margin_loss_pct_at_sl.toFixed(1)}% of margin)` : "-"}</span>
          <span className="text-slate-500">Est. liquidation</span><span className="text-amber-300">{p ? fmtPrice(p.estimated_liquidation_price) : "-"}</span>
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

      {result && result.outcome !== "open_protected" && (
        <div className={cn("rounded-xl border px-3 py-2 text-sm", (OUTCOME_TEXT[result.outcome]?.tone ?? "warn") === "bad" ? "border-rose-500/40 bg-rose-500/10 text-rose-100" : "border-amber-500/40 bg-amber-500/10 text-amber-100")}>
          {OUTCOME_TEXT[result.outcome]?.text ?? `Result: ${result.status}`}
        </div>
      )}

      <Dialog open={reviewOpen} onOpenChange={(o) => { if (!open.isPending) setReviewOpen(o); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-100 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirm: {direction === "long" ? "BUY / LONG" : "SELL / SHORT"} {symbol}</DialogTitle>
            <DialogDescription className="text-slate-400">
              This opens a real {p?.environment === "testnet" ? "TESTNET" : "LIVE"} futures position with an exchange-side stop-loss. There is no expiry.
            </DialogDescription>
          </DialogHeader>
          {p && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm">
              <span className="text-slate-500">Reference (mark) price</span><span>{fmtPrice(p.reference_price)}</span>
              <span className="text-slate-500">Quantity</span><span>{p.quantity}</span>
              <span className="text-slate-500">Notional</span><span>{fmtPrice(p.notional)} USDT</span>
              <span className="text-slate-500">Margin / leverage</span><span>{fmtPrice(p.margin_required)} USDT / {p.leverage}x ({p.position_mode.replace("_", "-")}, {p.margin_type ?? "margin type unknown"})</span>
              <span className="text-slate-500">Stop-loss</span><span className="text-rose-300">{p.sl_pct}% price move = trigger {fmtPrice(p.sl_trigger_price)}</span>
              <span className="text-slate-500">Expected loss at stop</span><span>{fmtPrice(p.estimated_loss_at_sl)} USDT ({p.margin_loss_pct_at_sl.toFixed(1)}% of margin, after fees)</span>
              <span className="text-slate-500">Fees (entry + exit at stop)</span><span>{fmtPrice(p.entry_fee_estimate + p.exit_fee_estimate_at_sl, 4)} USDT</span>
              <span className="text-slate-500">Slippage risk (est.)</span><span>{fmtPrice(p.slippage_risk_estimate, 4)} USDT</span>
              <span className="text-slate-500">Take-profit</span><span className="text-emerald-300">{p.take_profit ? `${fmtPrice(p.take_profit.trigger_price)} (net ${fmtPnl(p.take_profit.net_profit)} USDT)` : "not set"}</span>
              <span className="text-slate-500">Trailing exit</span><span className="text-violet-300">{trailingPct != null ? `${trailingPct}% give-back${trailingActivationPct != null ? ` after +${trailingActivationPct}%` : " immediately"}` : "not set"}</span>
              <span className="text-slate-500">Est. liquidation</span><span className="text-amber-300">{fmtPrice(p.estimated_liquidation_price)} ({p.estimated_liquidation_distance_pct?.toFixed(2)}% away)</span>
              <span className="text-slate-500">Funding</span><span>{p.funding_rate != null ? `${(p.funding_rate * 100).toFixed(4)}% / 8h` : "unknown"}</span>
              <span className="text-slate-500">Expiry</span><span className="font-semibold">None - stays open until a verified exit</span>
            </div>
          )}
          <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100">
            {(p?.warnings ?? []).map((w) => <div key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{w}</div>)}
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-200">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
            <span>I understand the stop-loss does not guarantee a maximum loss, funding and liquidation risk apply, and this position stays open until it is closed or stopped out.</span>
          </label>
          {openError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-sm text-rose-100">
              {openError.text}
              {unknownResult && <div className="mt-1 text-xs text-rose-200">The result of this request is unknown. Retrying uses the SAME request id, so it can never open a second position. Also check the open positions list.</div>}
            </div>
          )}
          {result && result.outcome !== "open_protected" && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-100">{OUTCOME_TEXT[result.outcome]?.text ?? `Result: ${result.status}`}</div>
          )}
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-100" disabled={open.isPending} onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 font-bold text-white hover:bg-blue-500" disabled={!ack || !p || open.isPending || (result != null)} onClick={confirm}>
              {open.isPending ? "Opening..." : unknownResult ? "Retry (same request)" : "Confirm & open position"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
