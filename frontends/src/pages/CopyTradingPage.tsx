import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/hooks/useWorkspace";
import { authHeaders } from "@/lib/auth";
import { toast } from "sonner";
import { Pause, Play, RefreshCw } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

interface Profile {
  id: string;
  master_instance_id: string;
  follower_workspace_id: string;
  allocation_type: string;
  allocation_value: number;
  paused: boolean;
  allowed_symbols?: string[];
  max_trade_size?: number;
}

interface Replication {
  id: string;
  master_trade_id: string;
  follower_workspace_id: string;
  order_id?: string;
  meta?: any;
  created_at?: string;
}

const CopyTradingPage = () => {
  const { currentWorkspace } = useWorkspace();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [replications, setReplications] = useState<Replication[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<Profile>>({
    allocation_type: "PERCENT_EQUITY",
    allocation_value: 10,
  });

  const load = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    const headers = await authHeaders();
    try {
      const pRes = await fetch(
        `${API_BASE}/copy-trading/profiles?workspace_id=${currentWorkspace.id}`,
        { headers, credentials: "include" }
      );
      setProfiles((await pRes.json()) || []);

      const rRes = await fetch(
        `${API_BASE}/copy-trading/replications?workspace_id=${currentWorkspace.id}`,
        { headers, credentials: "include" }
      );
      setReplications((await rRes.json()) || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load copy-trading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentWorkspace?.id]);

  const saveProfile = async () => {
    if (!currentWorkspace?.id || !form.master_instance_id) return;
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/copy-trading/profiles`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...form,
        follower_workspace_id: currentWorkspace.id,
        allowed_symbols: form.allowed_symbols || [],
      }),
    });
    if (!res.ok) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile saved");
      setForm({ allocation_type: "PERCENT_EQUITY", allocation_value: 10 });
      load();
    }
  };

  const togglePause = async (id: string, paused: boolean) => {
    const headers = await authHeaders();
    await fetch(`${API_BASE}/copy-trading/profiles/${id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ paused }),
    });
    load();
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Social</p>
            <h1 className="text-2xl font-semibold">Copy Trading</h1>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create / Update Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm">Master strategy instance ID</label>
              <Input
                value={form.master_instance_id || ""}
                onChange={(e) => setForm({ ...form, master_instance_id: e.target.value })}
                placeholder="strategy instance uuid"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Allocation type</label>
              <Input
                value={form.allocation_type}
                onChange={(e) => setForm({ ...form, allocation_type: e.target.value })}
                placeholder="PERCENT_EQUITY | FIXED_AMOUNT | MIRROR_EXACT"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Allocation value</label>
              <Input
                type="number"
                value={form.allocation_value ?? 0}
                onChange={(e) => setForm({ ...form, allocation_value: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Allowed symbols (comma separated)</label>
              <Input
                value={form.allowed_symbols?.join(",") || ""}
                onChange={(e) =>
                  setForm({ ...form, allowed_symbols: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Max trade size (notional)</label>
              <Input
                type="number"
                value={form.max_trade_size ?? ""}
                onChange={(e) => setForm({ ...form, max_trade_size: Number(e.target.value) })}
                placeholder="optional"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={saveProfile}>Save profile</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Follower Profiles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profiles.map((p) => (
                <div key={p.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">Master: {p.master_instance_id}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.allocation_type} • value {p.allocation_value}
                    </div>
                    {p.allowed_symbols?.length ? (
                      <div className="text-xs text-muted-foreground">Symbols: {p.allowed_symbols.join(", ")}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={p.paused ? "text-amber-500" : "text-emerald-500"}>
                      {p.paused ? "Paused" : "Active"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => togglePause(p.id, !p.paused)}
                      title={p.paused ? "Resume" : "Pause"}
                    >
                      {p.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ))}
              {profiles.length === 0 && <p className="text-sm text-muted-foreground">No profiles yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Replication Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
              {replications.map((r) => (
                <div key={r.id} className="border rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium">{r.meta?.symbol}</span>
                    <Badge variant="outline">{r.order_id ? "filled" : "pending"}</Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {r.meta?.side?.toUpperCase()} qty {r.meta?.qty} @ {r.meta?.price}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    master {r.master_trade_id} → follower {r.follower_workspace_id}
                  </div>
                </div>
              ))}
              {replications.length === 0 && <p className="text-sm text-muted-foreground">No replications yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};

export default CopyTradingPage;
