import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/useWorkspace";
import { authHeaders } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, RefreshCw, Activity } from "lucide-react";

type RegimeView = {
  symbol: string;
  regime: string;
  meta?: Record<string, any>;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const regimeBadgeColor = (regime: string) => {
  switch (regime) {
    case "TRENDING":
      return "bg-emerald-500/10 text-emerald-500";
    case "RANGING":
      return "bg-blue-500/10 text-blue-500";
    case "HIGH_VOLATILITY":
      return "bg-amber-500/10 text-amber-500";
    case "LOW_VOLATILITY":
      return "bg-slate-500/10 text-slate-300";
    default:
      return "bg-muted text-foreground";
  }
};

const RegimePage = () => {
  const { currentWorkspace } = useWorkspace();
  const [regimes, setRegimes] = useState<RegimeView[]>([]);
  const [loading, setLoading] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(5);

  const loadSettings = async () => {
    const headers = await authHeaders();
    const res = await fetch(
      `${API_BASE}/settings?group=regime&workspace_id=${currentWorkspace?.id ?? ""}`,
      { headers, credentials: "include" }
    );
    if (res.ok) {
      const json = await res.json();
      setIntervalMinutes(json?.evaluation_interval_minutes ?? 5);
    }
  };

  const loadRegimes = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const symRes = await fetch(`${API_BASE}/market/symbols`, { headers, credentials: "include" });
      const symbols = (await symRes.json()) || [];
      const items: RegimeView[] = [];
      for (const s of symbols.slice(0, 12)) {
        const r = await fetch(
          `${API_BASE}/regime/current?symbol=${encodeURIComponent(s.symbol)}&workspace_id=${currentWorkspace?.id ?? ""}`,
          { headers, credentials: "include" }
        );
        if (r.ok) {
          const json = await r.json();
          items.push({
            symbol: s.symbol,
            regime: json?.regime ?? "UNKNOWN",
            meta: json?.meta_json ?? json?.meta,
          });
        } else {
          items.push({ symbol: s.symbol, regime: "UNKNOWN" });
        }
      }
      setRegimes(items);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load regimes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadRegimes();
  }, [currentWorkspace?.id]);

  const saveSettings = async () => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/settings`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        workspace_id: currentWorkspace?.id,
        settings: {
          regime: {
            evaluation_interval_minutes: Number(intervalMinutes),
          },
        },
      }),
    });
    if (!res.ok) {
      toast.error("Failed to save regime settings");
    } else {
      toast.success("Regime settings saved");
    }
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Meta-Agent</p>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              AI Regime Center
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadRegimes} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </Button>
            <Button onClick={saveSettings} disabled={loading}>Save Settings</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Regime Runtime Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Evaluation interval (minutes)</label>
              <Input
                type="number"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                min={1}
              />
              <p className="text-xs text-muted-foreground">How often regime detector runs in trading loop.</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-3">
          {regimes.map((r) => (
            <Card key={r.symbol}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{r.symbol}</CardTitle>
                <Badge className={regimeBadgeColor(r.regime)}>{r.regime}</Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <div>Vol: {(r.meta?.vol ?? 0).toFixed(4)}</div>
                <div>Range: {(r.meta?.range ?? 0).toFixed(4)}</div>
                <div>Trend: {(r.meta?.trend ?? 0).toFixed(4)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default RegimePage;
