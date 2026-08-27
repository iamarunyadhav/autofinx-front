import { AlertTriangle, CheckCircle2, CircleSlash, Clock, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ChecklistStatus = "pass" | "fail" | "warn" | "skip";

export interface ChecklistItem {
  key: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
}

export interface StartupChecklist {
  items: ChecklistItem[];
  overall_ready: boolean;
  checked_at?: string | null;
}

function statusIcon(status: ChecklistStatus) {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "fail":
      return <XCircle className="h-5 w-5 text-rose-500" />;
    case "warn":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "skip":
    default:
      return <CircleSlash className="h-5 w-5 text-muted-foreground" />;
  }
}

function statusLabel(status: ChecklistStatus) {
  switch (status) {
    case "pass":
      return "PASS";
    case "fail":
      return "FAIL";
    case "warn":
      return "WARN";
    case "skip":
    default:
      return "SKIPPED";
  }
}

function formatCheckedAt(value?: string | null) {
  if (!value) return "Never checked";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `Checked ${new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(date)}`;
}

/**
 * Rich Start-readiness checklist (spec §3) — exchange connection, wallet,
 * market feed, symbol, risk state, exchange filters, each shown as its own
 * pass/fail/warn/skip row with a plain-English reason, so it's obvious at a
 * glance which check is blocking Start instead of one opaque error.
 */
export function RatioBotStartupChecklist({
  checklist,
  isLoading,
  onRefresh,
}: {
  checklist: StartupChecklist | null | undefined;
  isLoading?: boolean;
  onRefresh?: () => void;
}) {
  const items = checklist?.items ?? [];
  const failCount = items.filter((item) => item.status === "fail").length;
  const warnCount = items.filter((item) => item.status === "warn").length;

  return (
    <Card className={cn(checklist && !checklist.overall_ready ? "border-rose-500/40" : undefined)}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Start Readiness Checklist</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{formatCheckedAt(checklist?.checked_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          {checklist ? (
            <Badge className={checklist.overall_ready ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}>
              {checklist.overall_ready ? "✅ READY" : `❌ ${failCount} failing${warnCount ? `, ${warnCount} warning` : ""}`}
            </Badge>
          ) : null}
          {onRefresh ? (
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isLoading ? "animate-spin" : undefined)} />
              Re-check
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {isLoading ? "Checking..." : "No checklist yet."}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.key}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2",
                item.status === "fail" ? "border-rose-500/30 bg-rose-500/5" : "border-border/60",
              )}
            >
              {statusIcon(item.status)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.label}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {statusLabel(item.status)}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
