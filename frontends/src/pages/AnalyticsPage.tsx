import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { authHeaders } from "@/lib/auth";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const AnalyticsPage = () => {
  const { currentWorkspace } = useWorkspace();
  const [overview, setOverview] = useState<any>(null);

  const load = async () => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/analytics/overview?workspace_id=${currentWorkspace?.id ?? ""}`, { headers, credentials: "include" });
    if (res.ok) {
      setOverview(await res.json());
    } else {
      toast.error("Failed to load analytics");
    }
  };

  useEffect(() => {
    load();
  }, [currentWorkspace?.id]);

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Analytics</p>
            <h1 className="text-2xl font-semibold">Analytics Dashboard</h1>
          </div>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>PnL Realized: {overview?.pnl_realized ?? 0}</div>
            <div>Win Rate: {overview?.win_rate ?? 0}</div>
            <div>Trade Count: {overview?.trade_count ?? 0}</div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default AnalyticsPage;
