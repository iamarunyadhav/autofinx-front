import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Brain, Calendar, TriangleAlert } from "lucide-react";

interface FeatureFlagRow {
  key: string;
  enabled: boolean;
  label: string;
  description: string | null;
  category: string;
  default_value: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
}

interface FeatureFlagsResponse {
  flags: FeatureFlagRow[];
  grouped: Record<string, FeatureFlagRow[]>;
}

const CATEGORY_META: Record<string, { title: string; description: string; icon: typeof Brain }> = {
  unified_forecast: {
    title: "Unified Forecast Engine",
    description: "Shadow-mode comparisons and (once wired) live forecast integration across Quick Trade and Robot Trade.",
    icon: Brain,
  },
  scheduler: {
    title: "Scheduled Backtests & Calibration",
    description: "Once-daily read-only backtest/calibration refresh jobs and the readiness-evaluation sweep, per bot type.",
    icon: Calendar,
  },
};

/**
 * Generic on/off switch panel for AI/automation capability flags backed by
 * the `feature_flags` table (App\Domain\Ops\FeatureFlagService). Toggling
 * here takes effect within ~60s (FeatureFlagService's cache TTL) without a
 * code deploy. Flags whose category is `unified_forecast` and whose key
 * ends in `_live` are reserved: no code path reads them yet, so flipping
 * them has no effect until a follow-up task wires them in.
 */
export default function IntelligenceControlPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const res = await api.get<FeatureFlagsResponse>("/feature-flags");
      return res.data;
    },
  });

  const groups = useMemo(() => {
    const grouped = data?.grouped ?? {};
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  async function toggleFlag(flag: FeatureFlagRow, next: boolean) {
    setPendingKey(flag.key);
    try {
      await api.patch<FeatureFlagRow>(`/feature-flags/${encodeURIComponent(flag.key)}`, { enabled: next });
      await queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      toast({
        title: `${flag.label} ${next ? "enabled" : "disabled"}`,
        description: "Takes effect within about a minute.",
      });
    } catch (error) {
      toast({
        title: "Failed to update flag",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Intelligence Control</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            On/off switches for AI and automation capabilities — shadow-mode comparisons and scheduled backtest jobs.
            Every flag here defaults to today's real behavior; nothing changes until you flip a switch.
          </p>
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Loading flags...</div>}
        {isError && <div className="text-sm text-rose-400">Failed to load feature flags.</div>}

        {groups.map(([category, flags]) => {
          const meta = CATEGORY_META[category] ?? {
            title: category,
            description: "",
            icon: Brain,
          };
          const Icon = meta.icon;

          return (
            <Card key={category} className="border-slate-800 bg-slate-950 text-slate-50">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4" />
                  {meta.title}
                </CardTitle>
                {meta.description && (
                  <p className="text-xs text-slate-500">{meta.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3 px-4 sm:px-6">
                {flags.map((flag) => {
                  const isReserved = flag.category === "unified_forecast" && flag.key.endsWith("_live");

                  return (
                    <div
                      key={flag.key}
                      className="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-900/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-100">{flag.label}</span>
                          <Badge className={flag.enabled ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/10 text-slate-400"}>
                            {flag.enabled ? "ON" : "OFF"}
                          </Badge>
                          {isReserved && (
                            <Badge className="flex items-center gap-1 bg-amber-500/10 text-amber-300" title="No code currently reads this flag. Enabling it has no effect until a future update wires it in.">
                              <TriangleAlert className="h-3 w-3" />
                              Not yet connected
                            </Badge>
                          )}
                        </div>
                        {flag.description && (
                          <p className="max-w-2xl text-xs text-slate-500">{flag.description}</p>
                        )}
                        <p className="text-[11px] text-slate-600">
                          Key: <span className="font-mono">{flag.key}</span> · Default: {flag.default_value ? "on" : "off"}
                          {flag.updated_at ? ` · Last changed ${new Date(flag.updated_at).toLocaleString()}` : ""}
                        </p>
                      </div>
                      <Switch
                        checked={flag.enabled}
                        disabled={pendingKey === flag.key}
                        onCheckedChange={(checked) => toggleFlag(flag, checked)}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
