import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToneBadge } from "@/components/strategy-lab/LabShell";
import { cn } from "@/lib/utils";
import {
  labCostKeys,
  labNum,
  labPct,
  labSignClass,
  labVerdictText,
  labVerdictTone,
  labWords,
  type LabCostCards,
  type LabResult,
  type LabRunKind,
  type LabScorecard,
} from "@/lib/strategyLab";

const costLabel = (key: string, keys: string[]) =>
  `${key}% cost${keys.length > 1 ? (key === keys[0] ? " (base)" : key === keys[keys.length - 1] ? " (stressed)" : "") : ""}`;

interface Metric {
  label: ReactNode;
  render: (s: LabScorecard) => ReactNode;
  signed?: (s: LabScorecard) => number | null | undefined;
}

const METRICS: Metric[] = [
  { label: "Trades", render: (s) => labNum(s.trades, 0) },
  { label: "Buy / sell", render: (s) => `${labNum(s.buy_trades, 0)} / ${labNum(s.sell_trades, 0)}` },
  { label: "Gross total", render: (s) => labPct(s.gross_total_pct, 2), signed: (s) => s.gross_total_pct },
  { label: "Fees total", render: (s) => labPct(s.fees_total_pct, 2, false) },
  { label: "Funding total", render: (s) => labPct(s.funding_total_pct, 2, false) },
  { label: "Net total", render: (s) => labPct(s.net_total_pct, 2), signed: (s) => s.net_total_pct },
  { label: "Avg net / trade", render: (s) => labPct(s.avg_net_pct, 4), signed: (s) => s.avg_net_pct },
  { label: "Median net / trade", render: (s) => labPct(s.median_net_pct, 4), signed: (s) => s.median_net_pct },
  { label: "Profit factor", render: (s) => labNum(s.profit_factor, 3) },
  {
    label: (
      <span>
        Win / loss rate
        <span className="block text-[10px] font-normal text-muted-foreground">information only — not used for the verdict</span>
      </span>
    ),
    render: (s) => `${labPct(s.win_rate_pct, 1, false)} / ${labPct(s.loss_rate_pct, 1, false)}`,
  },
  { label: "Avg win / avg loss", render: (s) => `${labPct(s.avg_win_pct, 4)} / ${labPct(s.avg_loss_pct, 4)}` },
  { label: "Reward / risk", render: (s) => labNum(s.reward_risk, 3) },
  { label: "Max drawdown (additive)", render: (s) => labPct(s.max_drawdown_additive_pct, 2, false) },
  { label: "t-stat", render: (s) => labNum(s.t_stat, 3) },
  { label: "Avg hold", render: (s) => (s.avg_hold_minutes == null ? "—" : `${labNum(s.avg_hold_minutes, 1)} min`) },
];

/** Metric rows x one column per cost (quick: base only; deep: base + stressed). */
function ScorecardTable({ cards }: { cards: LabCostCards }) {
  const keys = labCostKeys(cards);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[9rem]">Metric</TableHead>
            {keys.map((k) => <TableHead key={k} className="whitespace-nowrap text-right">{costLabel(k, keys)}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {METRICS.map((m, i) => (
            <TableRow key={i}>
              <TableCell className="py-1.5 text-xs">{m.label}</TableCell>
              {keys.map((k) => {
                const s = cards[k];
                const empty = !s || !s.trades;
                return (
                  <TableCell key={k} className={cn("py-1.5 text-right font-mono text-xs tabular-nums", !empty && m.signed && labSignClass(m.signed(s)))}>
                    {!s ? "—" : empty ? (i === 0 ? "0" : "—") : m.render(s)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SlicesTable({ cards }: { cards: LabCostCards }) {
  const keys = labCostKeys(cards);
  const rows = Math.max(0, ...keys.map((k) => cards[k]?.slices?.length ?? 0));
  if (rows === 0) return <p className="text-xs text-muted-foreground">No time slices (no trades).</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slice</TableHead>
            <TableHead className="text-right">Trades</TableHead>
            {keys.map((k) => <TableHead key={k} className="whitespace-nowrap text-right">Avg net @ {k}%</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => {
            const base = cards[keys[0]]?.slices?.[i];
            return (
              <TableRow key={i}>
                <TableCell className="py-1.5 text-xs">{i + 1} of {rows}</TableCell>
                <TableCell className="py-1.5 text-right font-mono text-xs">{labNum(base?.trades, 0)}</TableCell>
                {keys.map((k) => {
                  const v = cards[k]?.slices?.[i]?.avg_net_pct;
                  return <TableCell key={k} className={cn("py-1.5 text-right font-mono text-xs", labSignClass(v))}>{labPct(v, 4)}</TableCell>;
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ExitReasons({ card }: { card: LabScorecard | undefined }) {
  const entries = Object.entries(card?.exit_reasons ?? {});
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([reason, n]) => (
        <span key={reason} className="rounded border border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[11px]">
          {reason}: {n}
        </span>
      ))}
    </div>
  );
}

function PerSymbolTable({ result, chartTf, stressed }: { result: LabResult; chartTf: string; stressed: boolean }) {
  const symbols = Object.entries(result.symbols ?? {});
  if (symbols.length === 0) return <p className="text-xs text-muted-foreground">No per-symbol results.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead className="text-right">Trades</TableHead>
            <TableHead className="text-right">Net total</TableHead>
            <TableHead className="text-right">Avg net</TableHead>
            {stressed && <TableHead className="text-right">Avg net (stressed)</TableHead>}
            <TableHead className="hidden text-right sm:table-cell">PF</TableHead>
            <TableHead className="hidden text-right md:table-cell">Max DD</TableHead>
            <TableHead className="hidden text-right md:table-cell">t-stat</TableHead>
            <TableHead className="hidden lg:table-cell">Window</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {symbols.map(([sym, data]) => {
            const cards = data.charts?.[chartTf] ?? {};
            const keys = labCostKeys(cards);
            const base = cards[keys[0]];
            const st = keys.length > 1 ? cards[keys[keys.length - 1]] : undefined;
            const w = data.window;
            return (
              <TableRow key={sym}>
                <TableCell className="py-1.5 font-mono text-xs">{sym}</TableCell>
                <TableCell className="py-1.5 text-right font-mono text-xs">{labNum(base?.trades, 0)}</TableCell>
                <TableCell className={cn("py-1.5 text-right font-mono text-xs", labSignClass(base?.net_total_pct))}>{labPct(base?.net_total_pct, 2)}</TableCell>
                <TableCell className={cn("py-1.5 text-right font-mono text-xs", labSignClass(base?.avg_net_pct))}>{labPct(base?.avg_net_pct, 4)}</TableCell>
                {stressed && <TableCell className={cn("py-1.5 text-right font-mono text-xs", labSignClass(st?.avg_net_pct))}>{labPct(st?.avg_net_pct, 4)}</TableCell>}
                <TableCell className="hidden py-1.5 text-right font-mono text-xs sm:table-cell">{labNum(base?.profit_factor, 3)}</TableCell>
                <TableCell className="hidden py-1.5 text-right font-mono text-xs md:table-cell">{labPct(base?.max_drawdown_additive_pct, 2, false)}</TableCell>
                <TableCell className="hidden py-1.5 text-right font-mono text-xs md:table-cell">{labNum(base?.t_stat, 3)}</TableCell>
                <TableCell className="hidden py-1.5 text-xs text-muted-foreground lg:table-cell">
                  {w ? `${new Date(w.start_ms).toLocaleDateString()} → ${new Date(w.end_ms).toLocaleDateString()}` : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Flattens {feature, wait:{long:{keep_top_50pct}}, rule:{...}} into "wait · long · keep top 50pct" rows. */
function flatten(value: unknown, prefix: string[] = []): Array<[string, string]> {
  if (value === null || value === undefined) return [[prefix.join(" · ") || "—", "—"]];
  if (typeof value !== "object") return [[prefix.join(" · ") || "value", String(value)]];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => flatten(v, [...prefix, labWords(k)]));
}

function ComponentLayers({ layers }: { layers: NonNullable<LabResult["component_layers_h15"]> }) {
  const symbols = Object.entries(layers);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {symbols.map(([sym, data]) => (
        <div key={sym} className="rounded-lg border border-border p-3">
          <div className="mb-2 font-mono text-xs font-semibold">{sym}</div>
          <dl className="space-y-1 text-xs">
            {flatten(data).map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd><ToneBadge tone={labVerdictTone(v)}>{v}</ToneBadge></dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

export function VerdictBanner({ verdict, reasons }: { verdict: string | null | undefined; reasons?: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Verdict (pre-registered rule, development data)</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <ToneBadge tone={labVerdictTone(verdict)} className="px-2 py-1 text-sm">{verdict ?? "UNKNOWN"}</ToneBadge>
        <span className="text-sm">{labVerdictText(verdict)}</span>
      </div>
      {reasons && reasons.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
          {reasons.map((r, i) => <li key={i} className="break-words">{r}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Completed run result: verdict, primary-chart scorecard, slices, per-symbol, and (deep) component layers. */
export function ResultView({ result, kind, verdict }: { result: LabResult; kind: LabRunKind; verdict: string | null }) {
  const charts = Object.keys(result.combined ?? {});
  const primary = result.primary_chart && charts.includes(result.primary_chart) ? result.primary_chart : charts[0];
  const [tf, setTf] = useState<string | undefined>(undefined);
  const chartTf = tf && charts.includes(tf) ? tf : primary;
  const cards = chartTf ? result.combined?.[chartTf] ?? {} : {};
  const keys = labCostKeys(cards);
  const rules = result.rules;

  return (
    <div className="space-y-4">
      <VerdictBanner verdict={result.verdict ?? verdict} reasons={result.verdict_reasons} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {result.sample_policy && <span>Policy <span className="font-mono">{result.sample_policy}</span></span>}
        {result.policy?.window && <span>Window: {result.policy.window}</span>}
        {rules && (
          <span>
            Rules: ≥{rules.min_trades} trades, PF ≥{rules.min_profit_factor}, ≥{rules.min_positive_slices} positive slices; accuracy is not used
          </span>
        )}
        {result.seconds != null && <span>Took {labNum(result.seconds, 1)} s</span>}
      </div>

      {charts.length === 0 ? (
        <p className="text-sm text-muted-foreground">The result has no combined scorecard.</p>
      ) : (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 p-4 pb-2">
            <CardTitle className="text-base">
              All symbols combined · {chartTf} chart{chartTf === primary ? " (primary)" : ""}
            </CardTitle>
            {charts.length > 1 && (
              <Select value={chartTf} onValueChange={setTf}>
                <SelectTrigger className="h-8 w-28" aria-label="Chart timeframe"><SelectValue /></SelectTrigger>
                <SelectContent>{charts.map((c) => <SelectItem key={c} value={c}>{c}{c === primary ? " (primary)" : ""}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0">
            <ScorecardTable cards={cards} />
            <div>
              <div className="mb-1 text-xs font-semibold">Time slices</div>
              <SlicesTable cards={cards} />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold">Exit reasons (base cost)</div>
              <ExitReasons card={cards[keys[0]]} />
            </div>
          </CardContent>
        </Card>
      )}

      {chartTf && (
        <Card>
          <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Per symbol · {chartTf} chart</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <PerSymbolTable result={result} chartTf={chartTf} stressed={kind === "DEEP" && keys.length > 1} />
          </CardContent>
        </Card>
      )}

      {kind === "DEEP" && result.component_layers_h15 && Object.keys(result.component_layers_h15).length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Component layers (h15)</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><ComponentLayers layers={result.component_layers_h15} /></CardContent>
        </Card>
      )}

      {(result.execution || result.data) && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {result.execution && <p>Execution model: {result.execution}</p>}
          {result.data && <p>Data: {result.data}</p>}
        </div>
      )}
    </div>
  );
}
