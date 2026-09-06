import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Stethoscope,
  Wrench,
  XCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type DiagnosticStatus = "pass" | "fail" | "warn";

export interface DiagnosticCheck {
  key: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
  raw?: unknown;
  fixable: boolean;
  fix_key: string | null;
}

export interface DiagnosticsResult {
  checks: DiagnosticCheck[];
  overall: DiagnosticStatus;
  checked_at: string;
}

function statusIcon(status: DiagnosticStatus) {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "fail":
      return <XCircle className="h-5 w-5 text-rose-500" />;
    case "warn":
    default:
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  }
}

function statusBadgeClass(status: DiagnosticStatus) {
  switch (status) {
    case "pass":
      return "bg-emerald-500/15 text-emerald-300";
    case "fail":
      return "bg-rose-500/15 text-rose-300";
    case "warn":
    default:
      return "bg-amber-500/15 text-amber-300";
  }
}

function formatCheckedAt(value?: string | null) {
  if (!value) return "Not run yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `Checked ${new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(date)}`;
}

function CheckRow({
  check,
  onFixClick,
  isFixing,
}: {
  check: DiagnosticCheck;
  onFixClick: (check: DiagnosticCheck) => void;
  isFixing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasRaw = check.raw !== undefined && check.raw !== null && !(Array.isArray(check.raw) && check.raw.length === 0);

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        check.status === "fail" ? "border-rose-500/30 bg-rose-500/5" : check.status === "warn" ? "border-amber-500/30 bg-amber-500/5" : "border-border/60",
      )}
    >
      <div className="flex items-start gap-3">
        {statusIcon(check.status)}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{check.label}</span>
            <Badge variant="outline" className={cn("text-[10px] border-transparent", statusBadgeClass(check.status))}>
              {check.status.toUpperCase()}
            </Badge>
          </div>
          <div className="whitespace-pre-line text-xs text-muted-foreground">{check.detail}</div>
          {hasRaw ? (
            <Collapsible open={expanded} onOpenChange={setExpanded} className="mt-1">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", expanded ? "rotate-180" : undefined)} />
                  {expanded ? "Hide details" : "Show details"}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted/50 p-2 text-[11px] leading-relaxed">
                  {JSON.stringify(check.raw, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>
        {check.fixable && check.fix_key ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onFixClick(check)} disabled={isFixing}>
            <Wrench className="mr-2 h-3.5 w-3.5" />
            Fix
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * On-demand "why is this bot stuck/stale/confusing" panel (2026-09-06).
 * Diagnose is an explicit action (not an auto-poll) since effectiveFeedStatus()
 * re-checks the live exchange feed on every call. A Fix always re-verifies
 * server-side before mutating anything real (see RatioBotFixActionService) --
 * this dialog is just an extra confirmation step on top of that, since these
 * are real-money bots and fixes should never be a silent single click.
 */
export function RatioBotDiagnosticsPanel({
  botId,
  onFixApplied,
}: {
  botId: string;
  onFixApplied?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingFix, setPendingFix] = useState<DiagnosticCheck | null>(null);

  const diagnosticsQuery = useQuery({
    queryKey: ["ratio-bot-diagnostics", botId],
    queryFn: async () => {
      const response = await api.get<DiagnosticsResult>(`/ratio-bots/${botId}/diagnostics`);
      return response.data;
    },
    enabled: false,
  });

  const fixMutation = useMutation({
    mutationFn: async (fixKey: string) => {
      const response = await api.post<DiagnosticsResult>(`/ratio-bots/${botId}/diagnostics/fix`, { fix_key: fixKey });
      return response.data;
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(["ratio-bot-diagnostics", botId], result);
      toast({ title: "Fix applied", description: "The check has been re-verified and the panel refreshed below." });
      setPendingFix(null);
      await onFixApplied?.();
    },
    onError: (error: Error) => {
      toast({ title: "Fix failed", description: error.message, variant: "destructive" });
      setPendingFix(null);
    },
  });

  const result = diagnosticsQuery.data;
  const isLoading = diagnosticsQuery.isFetching;
  const failCount = result?.checks.filter((c) => c.status === "fail").length ?? 0;
  const warnCount = result?.checks.filter((c) => c.status === "warn").length ?? 0;

  return (
    <Card className={cn(result && result.overall === "fail" ? "border-rose-500/40" : undefined)}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Diagnostics &amp; Auto-Fix</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{formatCheckedAt(result?.checked_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          {result ? (
            <Badge className={statusBadgeClass(result.overall)}>
              {result.overall === "pass"
                ? "✅ All clear"
                : result.overall === "fail"
                  ? `❌ ${failCount} failing${warnCount ? `, ${warnCount} warning` : ""}`
                  : `⚠️ ${warnCount} warning`}
            </Badge>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => diagnosticsQuery.refetch()} disabled={isLoading}>
            <Stethoscope className={cn("mr-2 h-3.5 w-3.5", isLoading ? "animate-pulse" : undefined)} />
            {result ? "Re-check" : "Diagnose"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {!result ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <Stethoscope className="h-4 w-4" />
            {isLoading
              ? "Running checks..."
              : "Click Diagnose to check the market feed, symbol breaker, recent events, daemon health, and other bots on this symbol."}
          </div>
        ) : (
          result.checks.map((check) => (
            <CheckRow
              key={check.key}
              check={check}
              isFixing={fixMutation.isPending}
              onFixClick={(c) => setPendingFix(c)}
            />
          ))
        )}
      </CardContent>

      <AlertDialog open={pendingFix !== null} onOpenChange={(open) => !open && setPendingFix(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply this fix?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingFix?.label}: {pendingFix?.detail}
              <br />
              <br />
              This is a real-money bot. The server will re-verify the underlying condition before making any change --
              if it's no longer safe to apply, the fix will be refused rather than applied blindly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={fixMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={fixMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (pendingFix?.fix_key) {
                  fixMutation.mutate(pendingFix.fix_key);
                }
              }}
            >
              {fixMutation.isPending ? "Applying..." : "Apply fix"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
