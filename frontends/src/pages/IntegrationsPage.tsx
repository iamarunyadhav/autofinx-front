import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { authHeaders } from "@/lib/auth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

type Integration = {
  id: string;
  provider_key: string;
  display_name: string;
  type: string;
  status: string;
  last_health_status?: string;
};

const IntegrationsPage = () => {
  const { currentWorkspace } = useWorkspace();
  const [items, setItems] = useState<Integration[]>([]);
  const [form, setForm] = useState({
    provider_key: "binance",
    display_name: "Binance",
    type: "exchange",
    api_key: "",
    api_secret: "",
  });

  const load = async () => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/integrations?workspace_id=${currentWorkspace?.id ?? ""}`, {
      headers,
      credentials: "include",
    });
    if (res.ok) setItems(await res.json());
  };

  useEffect(() => {
    load();
  }, [currentWorkspace?.id]);

  const save = async () => {
    if (!currentWorkspace?.id) return;
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/integrations`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        workspace_id: currentWorkspace.id,
        type: form.type,
        provider_key: form.provider_key,
        display_name: form.display_name,
        config_json: {},
        secrets: { api_key: form.api_key, api_secret: form.api_secret },
      }),
    });
    if (res.ok) {
      toast.success("Integration saved");
      setForm({ ...form, api_key: "", api_secret: "" });
      load();
    } else {
      toast.error("Save failed");
    }
  };

  const health = async (id: string) => {
    const headers = await authHeaders();
    await fetch(`${API_BASE}/integrations/${id}/health`, { method: "POST", headers, credentials: "include" });
    load();
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Connections</p>
            <h1 className="text-2xl font-semibold">Integrations</h1>
          </div>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Integration</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm">Type</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exchange">Exchange</SelectItem>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="defi">DeFi</SelectItem>
                  <SelectItem value="yield_provider">Yield</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Provider</label>
              <Input value={form.provider_key} onChange={(e) => setForm({ ...form, provider_key: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Display name</label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm">API key</label>
              <Input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm">API secret</label>
              <Input type="password" value={form.api_secret} onChange={(e) => setForm({ ...form, api_secret: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button onClick={save}>Save</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-3">
          {items.map((i) => (
            <Card key={i.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{i.display_name}</CardTitle>
                <Badge variant="outline">{i.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>Provider: {i.provider_key}</div>
                <div>Type: {i.type}</div>
                <div>Health: {i.last_health_status || "n/a"}</div>
                <Button size="sm" variant="ghost" onClick={() => health(i.id)}>Ping</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default IntegrationsPage;
