import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NetEdgePayload } from "@/hooks/useQuickTrade";
import { computeCalculatorProjection, MAX_CALCULATOR_LEVERAGE, MIN_CALCULATOR_LEVERAGE } from "@/lib/quickTradeCalculator";

function formatUsdt(value: number) {
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) return value.toFixed(6);
  return value.toFixed(4);
}

export interface ProfitCalculatorCardProps {
  netEdge?: NetEdgePayload | null;
  /** Same meaning as `NearTermForecastCard`'s props of the same name --
   * both cards read the same `useQuickTradeForecast()` query, so a stalled
   * worker affects both at once. */
  isLoading?: boolean;
  isStalled?: boolean;
}

export function ProfitCalculatorCard({ netEdge, isLoading, isStalled }: ProfitCalculatorCardProps) {
  const [targetProfit, setTargetProfit] = useState(5);
  const [leverage, setLeverage] = useState(MIN_CALCULATOR_LEVERAGE);

  const projection = computeCalculatorProjection(netEdge ?? undefined, targetProfit, leverage);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">Profit calculator</div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Target profit ($)</Label>
          <Input
            type="number"
            min={0.01}
            step={0.5}
            value={targetProfit}
            onChange={(event) => setTargetProfit(Math.max(0.01, Number(event.target.value || 0)))}
            className="border-slate-800 bg-slate-950 text-slate-100"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Leverage (planning only, max {MAX_CALCULATOR_LEVERAGE}x)</Label>
          <Input
            type="number"
            min={MIN_CALCULATOR_LEVERAGE}
            max={MAX_CALCULATOR_LEVERAGE}
            step={1}
            value={leverage}
            onChange={(event) => setLeverage(Number(event.target.value || MIN_CALCULATOR_LEVERAGE))}
            className="border-slate-800 bg-slate-950 text-slate-100"
          />
        </div>
      </div>

      {leverage > MIN_CALCULATOR_LEVERAGE && (
        <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
          Leverage here is for planning only — Quick Trade currently executes unleveraged (1x) orders. The numbers
          below are not what your actual order will produce.
        </div>
      )}

      {!projection ? (
        <div className="mt-3 text-xs text-slate-500">
          {isStalled
            ? "The decision engine did not respond in time — profit estimate unavailable right now, retrying automatically."
            : isLoading
              ? "Computing a fresh profit estimate for this selection…"
              : "Waiting for a fresh signal to estimate profit."}
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 text-left sm:grid-cols-3 sm:text-right">
            <div>
              <div className="text-xs text-slate-500">Expected gross</div>
              <div className="text-sm font-semibold text-slate-200">{formatUsdt(projection.grossUsdt)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Fee + slippage</div>
              <div className="text-sm font-semibold text-rose-200">-{formatUsdt(projection.costUsdt)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Expected net</div>
              <div className={`text-sm font-semibold ${projection.netUsdt >= 0 ? "text-emerald-200" : "text-rose-300"}`}>
                {formatUsdt(projection.netUsdt)}
              </div>
            </div>
          </div>

          <div className="mt-2 text-xs leading-relaxed text-slate-400">
            {projection.blocked ? (
              // Part C4 -- name the ACTUAL binding constraint. The old text
              // ("try a longer duration or a bigger stake") was misleading:
              // fees and P&L both scale with notional, so a bigger stake can
              // only ever clear the absolute min-expected-net floor, never
              // the percentage cost gate. The backend decides which it is
              // (TradeForecastService::netEdge -> binding_constraint); this
              // component only renders it, and falls back to the old wording
              // solely when talking to a backend that doesn't send it.
              <span className={netEdge?.binding_constraint === "stake" ? "text-amber-300" : "text-rose-300"}>
                {netEdge?.binding_constraint_hint ??
                  "At the current signal, this duration/stake doesn't clear fees and slippage."}
              </span>
            ) : (
              <span>
                ~<span className="font-semibold text-slate-200">{projection.tradesNeeded}</span> trade
                {projection.tradesNeeded === 1 ? "" : "s"} at this rate to reach ${targetProfit.toFixed(2)} — an
                estimate from the current signal, not a guarantee.
              </span>
            )}
          </div>

          <div className="mt-2 text-xs text-slate-500">
            {netEdge?.tradeable ? "Meets Robot Trade's live safety threshold." : "Below Robot Trade's live safety threshold."}
            {" "}Round-trip fee ~{netEdge?.round_trip_fee_pct?.toFixed(4)}%, slippage buffer ~{netEdge?.slippage_buffer_pct?.toFixed(4)}%.
            {netEdge?.max_achievable_move_pct != null && (
              <> Max possible move at current volatility ~{netEdge.max_achievable_move_pct.toFixed(4)}% vs {netEdge.required_move_pct?.toFixed(4)}% required.</>
            )}
            {netEdge?.fee_rate_source && (
              <> Fee rate from {netEdge.fee_rate_source === "account" ? "your exchange account tier" : "platform config"}.</>
            )}
          </div>
        </>
      )}
    </div>
  );
}
