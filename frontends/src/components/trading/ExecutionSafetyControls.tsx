import { Save, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ExecutionSafetyValues {
  liveFeedMaxAgeSeconds: number;
  webhookMaxSignalLatencyMs: number;
}

export interface ExecutionSafetyTelemetry {
  feedAgeSeconds?: number | null;
  feedState?: string | null;
  feedReason?: string | null;
  truthSource?: string | null;
  lastTickAt?: string | null;
  evaluatorAgeSeconds?: number | null;
  evaluatorState?: string | null;
  latestDecisionAgeSeconds?: number | null;
  chartLatencyMs?: number | null;
  webhookSignalLatencyMs?: number | null;
  serverNow?: string | null;
}

const LIVE_FEED_GUARD_OPTIONS = [1, 3, 5, 10] as const;
const WEBHOOK_LATENCY_GUARD_OPTIONS = [1000, 3000, 4000, 5000, 10000] as const;
const DEFAULT_PRIMARY_OPTIONS = LIVE_FEED_GUARD_OPTIONS.map((value) => ({ value, label: `${value}s` }));
const DEFAULT_SECONDARY_OPTIONS = WEBHOOK_LATENCY_GUARD_OPTIONS.map((value) => ({ value, label: `${value / 1000}s` }));

export function ExecutionSafetyControls({
  title = "Execution Safety",
  moduleLabel,
  values,
  telemetry,
  onChange,
  onSave,
  busy,
  className,
  primaryGuardLabel = "Live feed guard",
  primaryGuardOptions = DEFAULT_PRIMARY_OPTIONS,
  secondaryGuardLabel = "Webhook latency guard",
  secondaryGuardName = "TradingView webhook",
  secondaryGuardOptions = DEFAULT_SECONDARY_OPTIONS,
}: {
  title?: string;
  moduleLabel: string;
  values: ExecutionSafetyValues;
  telemetry?: ExecutionSafetyTelemetry;
  onChange: (values: ExecutionSafetyValues) => void;
  onSave: () => void;
  busy?: boolean;
  className?: string;
  /** Label above the 1st guard's button group. Defaults keep Robot Trade/Future Trade unchanged. */
  primaryGuardLabel?: string;
  /** Button options for the 1st (feed staleness) guard, in seconds. */
  primaryGuardOptions?: Array<{ value: number; label: string }>;
  /** Label above the 2nd guard's button group. Defaults keep Robot Trade/Future Trade unchanged. */
  secondaryGuardLabel?: string;
  /** Row name for the 2nd guard in the check table. */
  secondaryGuardName?: string;
  /** Button options for the 2nd guard. A `value` of 0 renders as an explicit "Off" state. */
  secondaryGuardOptions?: Array<{ value: number; label: string }>;
}) {
  const feedAge = telemetry?.feedAgeSeconds ?? null;
  const webhookLatency = telemetry?.webhookSignalLatencyMs ?? null;
  const feedOk = feedAge == null ? false : feedAge <= values.liveFeedMaxAgeSeconds;
  // A limit of 0 means the guard is disabled — never block, regardless of the sample.
  const webhookGuardOff = values.webhookMaxSignalLatencyMs <= 0;
  const webhookOk = webhookGuardOff || webhookLatency == null ? true : webhookLatency <= values.webhookMaxSignalLatencyMs;
  const rows = [
    {
      key: "feed",
      name: "Binance live feed",
      current: feedAge == null ? "-" : `${round(feedAge)}s`,
      limit: `${values.liveFeedMaxAgeSeconds}s`,
      state: feedOk ? "Fresh" : "Blocks live entry",
      detail: telemetry?.feedReason ?? telemetry?.feedState ?? "-",
      ok: feedOk,
    },
    {
      key: "webhook",
      name: secondaryGuardName,
      current: webhookLatency == null ? "-" : `${round(webhookLatency)}ms`,
      limit: webhookGuardOff ? "off" : `${values.webhookMaxSignalLatencyMs}ms`,
      state: webhookOk ? "Allowed" : "Blocks BUY/SELL",
      detail: webhookLatency == null ? "No recent latency sample" : "Latest signal latency",
      ok: webhookOk,
    },
    {
      key: "evaluator",
      name: `${moduleLabel} worker`,
      current: telemetry?.evaluatorAgeSeconds == null ? "-" : `${round(telemetry.evaluatorAgeSeconds)}s`,
      limit: "heartbeat",
      state: telemetry?.evaluatorState ?? "-",
      detail: "Scheduler/supervisor status",
      ok: telemetry?.evaluatorState === "green",
    },
    {
      key: "chart",
      name: "Graph/live chart",
      current: telemetry?.chartLatencyMs == null ? "-" : `${round(telemetry.chartLatencyMs)}ms`,
      limit: "display only",
      state: telemetry?.truthSource ?? "-",
      detail: telemetry?.lastTickAt ?? telemetry?.serverNow ?? "-",
      ok: true,
    },
  ];

  return (
    <Card className={cn("border-slate-800 bg-slate-950 text-slate-50", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <GuardOptionGroup
            label={primaryGuardLabel}
            value={values.liveFeedMaxAgeSeconds}
            options={primaryGuardOptions}
            onChange={(value) => onChange({ ...values, liveFeedMaxAgeSeconds: value })}
          />
          <GuardOptionGroup
            label={secondaryGuardLabel}
            value={values.webhookMaxSignalLatencyMs}
            options={secondaryGuardOptions}
            onChange={(value) => onChange({ ...values, webhookMaxSignalLatencyMs: value })}
          />
        </div>

        <div className="overflow-hidden rounded-md border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Check</th>
                <th className="px-3 py-2 font-medium">Current</th>
                <th className="px-3 py-2 font-medium">Limit</th>
                <th className="px-3 py-2 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-slate-800">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-100">{row.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{row.detail}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-200">{row.current}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{row.limit}</td>
                  <td className="px-3 py-2">
                    <Badge className={row.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}>
                      {row.state}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
          Binance websocket cache is the single market truth for live execution. Signals can come from webhook or backend logic, but live orders are blocked when these guard windows fail.
        </div>

        <Button className="w-full" disabled={busy} onClick={onSave}>
          <Save className="mr-2 h-4 w-4" />Save Safety Guards
        </Button>
      </CardContent>
    </Card>
  );
}

function GuardOptionGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: Array<{ value: number; label: string }>;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="grid grid-cols-4 gap-1">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? "default" : "outline"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
