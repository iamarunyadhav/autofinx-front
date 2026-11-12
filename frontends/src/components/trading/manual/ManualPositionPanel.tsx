import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  STATUS_LABEL,
  statusLabel,
  fmtAge,
  fmtPnl,
  fmtPrice,
  parseApiError,
  protectionLabel,
  type ManualClosePreview,
  type ManualPosition,
} from "@/lib/manualTrade";
import {
  useCloseManualPosition,
  useManualClosePreview,
  useManualPosition,
  useRefreshManualPosition,
  useUpdateManualStopLoss,
} from "@/hooks/useQuickTradeManual";

function Cell({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "warn" }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold text-slate-100", tone === "pos" && "text-emerald-300", tone === "neg" && "text-rose-300", tone === "warn" && "text-amber-300")}>{value}</div>
    </div>
  );
}

const pnlTone = (v: number | null | undefined) => (v == null ? undefined : v > 0 ? "pos" : v < 0 ? "neg" : undefined);

interface CardProps {
  workspaceId: string;
  position: ManualPosition;
}

/** One open (or recently ended) manual position, with the prominent Manual Close flow. */
function PositionCard({ workspaceId, position }: CardProps) {
  const [closeOpen, setCloseOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Live numbers come from the detail endpoint (exchange reads); the list endpoint is the DB snapshot.
  // Finished positions are only fetched in detail while the details dialog is open (no pointless polling).
  const detail = useManualPosition(workspaceId, position.is_terminal && !detailsOpen ? null : position.id);
  const p = detail.data ?? position;
  const live = p.live && !p.live.error ? p.live : null;
  const refresh = useRefreshManualPosition(workspaceId);
  const preview = useManualClosePreview(workspaceId);
  const close = useCloseManualPosition(workspaceId);
  const [closePreview, setClosePreview] = useState<ManualClosePreview | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [stopEditOpen, setStopEditOpen] = useState(false);
  const [stopPrice, setStopPrice] = useState("");
  const stopUpdate = useUpdateManualStopLoss(workspaceId);

  const prot = protectionLabel(p);
  const liq = live?.liquidation_price ?? p.exchange_liquidation_price ?? p.estimated_liquidation_price;
  const liqSource = live?.liquidation_price != null || p.exchange_liquidation_price != null ? "exchange" : "estimate";
  const isLong = p.direction === "long";
  const quantity = live?.exchange_quantity && live.exchange_quantity > 0 ? live.exchange_quantity : p.executed_quantity;

  useEffect(() => {
    if (!closeOpen) {
      setClosePreview(null);
      setCloseError(null);
      return;
    }
    preview.mutate(p.id, {
      onSuccess: setClosePreview,
      onError: (e) => setCloseError(parseApiError((e as Error).message).text),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeOpen, p.id]);

  const doClose = () => {
    setCloseError(null);
    close.mutate(p.id, {
      onSuccess: (result) => {
        if (result.status === "CLOSE_FAILED") {
          setCloseError(result.last_error ?? (p.no_stop_loss ? "The exchange did not confirm the close. The position is still open (it has no stop-loss): try again or press Refresh." : "The exchange did not confirm the close. Your exchange stop-loss is unchanged; try again or press Refresh."));
        } else {
          setCloseOpen(false);
        }
      },
      onError: (e) => setCloseError(parseApiError((e as Error).message).text),
    });
  };

  const openStopEditor = () => {
    setStopPrice(p.sl_trigger_price == null ? "" : String(p.sl_trigger_price));
    setStopEditOpen(true);
  };

  const saveStop = () => {
    const value = Number(stopPrice);
    if (!(value > 0)) return;
    stopUpdate.mutate({ positionId: p.id, stopLossPrice: value }, {
      onSuccess: () => setStopEditOpen(false),
    });
  };

  return (
    <div className={cn("space-y-3 rounded-[24px] border bg-slate-950/80 p-4", p.critical_alert ? "border-rose-500/60" : "border-slate-800")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-lg font-bold text-slate-50">{p.symbol}</div>
        <Badge className={isLong ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}>{isLong ? "LONG / BUY" : "SHORT / SELL"}</Badge>
        <Badge className="bg-slate-700/50 text-slate-200">{statusLabel(p)}</Badge>
        <Badge className={p.environment === "testnet" ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-300"}>{p.environment === "testnet" ? "TESTNET" : "LIVE"}</Badge>
        <Badge className="bg-slate-700/50 text-slate-200">{p.account_label ?? "Account unavailable"}</Badge>
        <Badge className="bg-blue-500/10 text-blue-300">No expiry</Badge>
        <div className={cn("ml-auto flex items-center gap-1.5 text-xs", prot.tone === "ok" ? "text-emerald-300" : prot.tone === "warn" ? "text-amber-300" : "text-rose-300")}>
          {prot.tone === "ok" ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {prot.text}
        </div>
      </div>

      {p.critical_alert && (
        <div className="flex gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Critical: needs your attention</div>
            <div className="text-rose-200/90">
              {p.outcome === "close_unconfirmed_position_may_be_unprotected"
                ? "An emergency close could not be confirmed by the exchange. The position may still be open and unprotected. Check Binance now; the system keeps retrying."
                : p.emergency_close_confirmed
                  ? "The exchange stop-loss could not be verified, so the position was closed immediately (confirmed flat on the exchange)."
                  : (p.last_error ?? "A critical event was recorded. Open Order Details.")}
            </div>
          </div>
        </div>
      )}

      {p.no_stop_loss && !p.is_terminal && (
        <div className="flex gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">No stop-loss: you must close this position manually</div>
            <div className="text-amber-200/90">
              Nothing closes it automatically except {p.tp_pct != null ? "take-profit and " : ""}liquidation (approx. {fmtPrice(liq)}{live?.mark_price != null && liq != null && liq > 0 ? `, ${(Math.abs(live.mark_price - liq) / live.mark_price * 100).toFixed(2)}% from mark` : ""}).
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Cell label="Entry" value={fmtPrice(p.entry_price)} />
        <Cell label="Mark" value={fmtPrice(live?.mark_price)} />
        <Cell label="Quantity" value={quantity != null ? String(quantity) : "-"} />
        <Cell label="Margin (stake)" value={`${fmtPrice(p.stake_amount)} USDT`} />
        <Cell label="Leverage" value={`${p.leverage}x`} />
        <Cell label="Unrealized P&L" value={fmtPnl(live?.unrealized_pnl)} tone={pnlTone(live?.unrealized_pnl)} />
        <Cell label="Est. net P&L (after fees)" value={fmtPnl(live?.estimated_net_pnl)} tone={pnlTone(live?.estimated_net_pnl)} />
        <Cell label="ROE" value={live?.roe_pct != null ? `${live.roe_pct.toFixed(2)}%` : "-"} tone={pnlTone(live?.roe_pct)} />
        {p.no_stop_loss
          ? <Cell label="Stop-loss" value="none (opted out)" tone="warn" />
          : <Cell label={`Stop-loss (${p.sl_pct}% price move)`} value={fmtPrice(p.sl_trigger_price)} tone="neg" />}
        <Cell label={p.tp_pct != null ? `Take-profit (${p.tp_pct}% price move)` : "Take-profit"} value={p.tp_pct != null ? fmtPrice(p.tp_trigger_price) : "not set"} tone={p.tp_pct != null ? "pos" : undefined} />
        <Cell label="Trailing" value={p.trailing_pct != null ? `${p.trailing_pct}% give-back${p.trailing_activation_pct != null ? ` after +${p.trailing_activation_pct}%` : ""}` : "not set"} tone={p.trailing_pct != null ? "pos" : undefined} />
        <Cell label={`Liquidation (${liqSource === "estimate" ? "approx. estimate" : liqSource})`} value={fmtPrice(liq)} tone="warn" />
        <Cell
          label="Funding"
          value={live?.funding_rate != null ? `${(live.funding_rate * 100).toFixed(4)}% / 8h${live.next_funding_ms ? ` - next ${new Date(live.next_funding_ms).toLocaleTimeString()}` : ""}` : "-"}
        />
        <Cell label="Exchange stop" value={p.no_stop_loss ? "none by choice" : p.sl_status === "WORKING" ? `working${p.sl_algo_id ? ` #${p.sl_algo_id}` : ""}` : p.sl_status.toLowerCase()} tone={p.no_stop_loss ? "warn" : p.sl_status === "WORKING" ? "pos" : "warn"} />
        <Cell label="Exchange take-profit" value={p.tp_pct == null ? "-" : p.tp_status === "WORKING" ? "working" : p.tp_status.toLowerCase()} tone={p.tp_pct != null && p.tp_status !== "WORKING" ? "warn" : undefined} />
        <Cell label="Position age" value={fmtAge(p.age_seconds)} />
        <Cell label="Last reconciled" value={p.last_reconciled_at ? new Date(p.last_reconciled_at).toLocaleTimeString() : "not yet"} />
      </div>

      {p.is_terminal && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Cell label="Exit reason" value={(p.exit_reason ?? "-").replace(/_/g, " ")} />
          <Cell label="Exit price" value={fmtPrice(p.exit_price)} />
          <Cell label={`Net P&L (${p.pnl_source ?? "n/a"})`} value={fmtPnl(p.net_pnl)} tone={pnlTone(p.net_pnl)} />
          <Cell label="Fees / funding" value={`${fmtPrice((p.entry_fee ?? 0) + (p.exit_fee ?? 0), 4)} / ${fmtPrice(p.funding_fee, 4)}`} />
        </div>
      )}

      {live == null && !p.is_terminal && (
        <div className="text-xs text-amber-300">Live exchange numbers are unavailable right now{p.live?.error ? ` (${p.live.error})` : ""}. {p.no_stop_loss ? "This position has no stop-loss." : "The exchange stop-loss is unaffected."}</div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          size="lg"
          className="bg-rose-600 px-6 font-bold text-white hover:bg-rose-500"
          disabled={!p.can_close || close.isPending}
          onClick={() => setCloseOpen(true)}
        >
          Manual Close
        </Button>
        <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-100" onClick={() => setDetailsOpen(true)}>View Order Details</Button>
        {!p.no_stop_loss && !p.is_terminal && p.protection_status === "PROTECTED" && (
          <Button variant="outline" className="border-amber-700/60 bg-slate-900 text-amber-200" onClick={openStopEditor}>Edit Stop Loss</Button>
        )}
        <Button variant="ghost" className="text-slate-300" disabled={refresh.isPending} onClick={() => refresh.mutate(p.id)}>
          <RefreshCw className={cn("mr-1.5 h-4 w-4", refresh.isPending && "animate-spin")} /> Refresh
        </Button>
        {!p.can_close && !p.is_terminal && <span className="text-xs text-slate-500">Close is unavailable while the position is {STATUS_LABEL[p.status]?.toLowerCase()}.</span>}
      </div>

      <Dialog open={stopEditOpen} onOpenChange={(open) => { if (!stopUpdate.isPending) setStopEditOpen(open); }}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Edit Stop Loss - {p.symbol}</DialogTitle>
            <DialogDescription className="text-slate-400">Enter an exact trigger price. The new exchange stop is placed and verified before the old stop is cancelled.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Fixed stop-loss trigger price</label>
            <Input type="number" step="any" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} className="border-slate-700 bg-slate-900 text-slate-100" />
            <div className="text-xs text-slate-500">Entry: {fmtPrice(p.entry_price)} · Current stop: {fmtPrice(p.sl_trigger_price)}</div>
            {stopUpdate.error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-sm text-rose-200">{parseApiError((stopUpdate.error as Error).message).text}</div>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStopEditOpen(false)} disabled={stopUpdate.isPending}>Cancel</Button>
            <Button className="bg-amber-600 text-slate-950 hover:bg-amber-500" onClick={saveStop} disabled={stopUpdate.isPending || !(Number(stopPrice) > 0)}>{stopUpdate.isPending ? "Saving..." : "Save fixed stop"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={closeOpen} onOpenChange={(o) => { if (!close.isPending) setCloseOpen(o); }}>
        <AlertDialogContent className="border-slate-800 bg-slate-950 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Close {p.symbol} {isLong ? "LONG" : "SHORT"} now?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-300">
                {preview.isPending && <div>Loading current exchange numbers...</div>}
                {closePreview && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <span className="text-slate-500">Symbol / direction</span><span>{closePreview.symbol} / {closePreview.direction}</span>
                    <span className="text-slate-500">Quantity</span><span>{closePreview.quantity}</span>
                    <span className="text-slate-500">Mark price</span><span>{fmtPrice(closePreview.mark_price)}</span>
                    <span className="text-slate-500">Est. gross P&L</span><span>{fmtPnl(closePreview.estimated_gross_pnl)} USDT</span>
                    <span className="text-slate-500">Est. fees (entry + exit)</span><span>{fmtPrice(closePreview.estimated_entry_fee + closePreview.estimated_exit_fee, 4)} USDT</span>
                    <span className="text-slate-500">Est. net P&L</span><span className="font-semibold">{fmtPnl(closePreview.estimated_net_pnl)} USDT</span>
                  </div>
                )}
                {closePreview?.already_flat_on_exchange && <div className="text-amber-300">The exchange already shows this position as flat (stop-loss/take-profit may have just fired). Closing will only reconcile it.</div>}
                {closePreview && <div className="text-amber-200">{closePreview.slippage_warning}</div>}
                {closePreview && <div className="text-xs text-slate-400">{closePreview.funding_note}</div>}
                {closeError && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-rose-200">{closeError}</div>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={close.isPending} className="border-slate-700 bg-slate-900 text-slate-100">Keep position open</AlertDialogCancel>
            <Button className="bg-rose-600 font-bold text-white hover:bg-rose-500" disabled={close.isPending || preview.isPending || !closePreview} onClick={doClose}>
              {close.isPending ? "Closing..." : "Close position now (market)"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-100 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Order details - {p.symbol}</DialogTitle>
            <DialogDescription className="text-slate-400">Exchange identifiers, verified protection facts and the audit trail. The exchange is authoritative.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-1 text-xs md:grid-cols-2">
            <div>Position id: <span className="font-mono">{p.id}</span></div>
            <div>Status: {p.status} / protection {p.protection_status}{p.no_stop_loss ? " (opened by explicit no-stop-loss opt-in)" : ""}</div>
            <div>Entry order id: <span className="font-mono">{p.entry_order_id ?? "-"}</span></div>
            <div>Close order id: <span className="font-mono">{p.close_order_id ?? "-"}</span></div>
            <div>Stop-loss algo id: <span className="font-mono">{p.sl_algo_id ?? "-"}</span> ({p.sl_status})</div>
            <div>Take-profit algo id: <span className="font-mono">{p.tp_algo_id ?? "-"}</span> ({p.tp_status})</div>
            <div>Requested / executed qty: {p.requested_quantity ?? "-"} / {p.executed_quantity ?? "-"}</div>
            <div>Entry slippage: {p.entry_slippage_pct != null ? `${p.entry_slippage_pct}%` : "-"}</div>
            <div>Stop verified at: {p.sl_verified_at ?? "-"}</div>
            <div>Position mode / margin: {p.position_mode} / {p.margin_type ?? "-"}</div>
          </div>
          <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">Event log</div>
          <div className="space-y-1">
            {(detail.data?.events ?? []).map((e, i) => (
              <div key={`${e.created_at}-${i}`} className={cn("rounded-lg border px-2 py-1 text-xs", e.severity === "critical" ? "border-rose-500/50 bg-rose-500/10" : e.severity === "high" ? "border-amber-500/40 bg-amber-500/5" : "border-slate-800 bg-slate-900/60")}>
                <span className="text-slate-500">{e.created_at ? new Date(e.created_at).toLocaleString() : ""}</span> <b>{e.type}</b>
                {e.to_status ? <span> {e.from_status ?? ""} {"->"} {e.to_status}</span> : null} <span className="text-slate-500">[{e.source}]</span>
                {e.payload ? <div className="break-all font-mono text-[10px] text-slate-400">{JSON.stringify(e.payload)}</div> : null}
              </div>
            ))}
            {!detail.data?.events?.length && <div className="text-xs text-slate-500">Loading...</div>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PanelProps {
  workspaceId: string;
  positions: ManualPosition[];
  title: string;
  empty: string;
}

export function ManualPositionPanel({ workspaceId, positions, title, empty }: PanelProps) {
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-[0.28em] text-slate-500">{title}</div>
      {positions.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-center text-sm text-slate-500">{empty}</div>
      ) : (
        positions.map((p) => <PositionCard key={p.id} workspaceId={workspaceId} position={p} />)
      )}
    </div>
  );
}
