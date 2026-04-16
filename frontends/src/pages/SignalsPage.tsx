import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/hooks/useWorkspace";
import { authHeaders } from "@/lib/auth";
import { toast } from "sonner";
import { Copy, RefreshCw, Send } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

interface SignalRow {
  id: string;
  symbol: string;
  action: string;
  confidence: number;
  regime?: string;
  strategy_name?: string;
  created_at?: string;
}

interface WebhookRow {
  id: string;
  target_url: string;
  enabled: boolean;
}

interface TokenRow {
  id: string;
  name: string;
  scopes: string[];
  token_hash: string;
}

const SignalsPage = () => {
  const { currentWorkspace } = useWorkspace();
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [newWebhook, setNewWebhook] = useState({ target_url: "" });
  const [newTokenName, setNewTokenName] = useState("");
  const [plainToken, setPlainToken] = useState<string | null>(null);

  const load = async () => {
    const headers = await authHeaders();
    try {
      const sRes = await fetch(
        `${API_BASE}/signals/history?workspace_id=${currentWorkspace?.id ?? ""}`,
        { headers, credentials: "include" }
      );
      setSignals((await sRes.json()) || []);

      if (currentWorkspace?.id) {
        const wRes = await fetch(
          `${API_BASE}/signals/webhooks?workspace_id=${currentWorkspace.id}`,
          { headers, credentials: "include" }
        );
        setWebhooks((await wRes.json()) || []);

        const tRes = await fetch(
          `${API_BASE}/api-tokens?workspace_id=${currentWorkspace.id}`,
          { headers, credentials: "include" }
        );
        setTokens((await tRes.json()) || []);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load signals data");
    }
  };

  useEffect(() => {
    load();
  }, [currentWorkspace?.id]);

  const createWebhook = async () => {
    if (!currentWorkspace?.id || !newWebhook.target_url) return;
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/signals/webhooks`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...newWebhook, workspace_id: currentWorkspace.id }),
    });
    if (res.ok) {
      toast.success("Webhook created");
      setNewWebhook({ target_url: "" });
      load();
    } else {
      toast.error("Failed to create webhook");
    }
  };

  const testWebhook = async (id: string) => {
    const headers = await authHeaders();
    await fetch(`${API_BASE}/signals/webhooks/${id}/test`, {
      method: "POST",
      headers,
      credentials: "include",
    });
    toast.success("Webhook test queued");
  };

  const createToken = async () => {
    if (!newTokenName || !currentWorkspace?.id) return;
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api-tokens`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: newTokenName, workspace_id: currentWorkspace.id, scopes: ["read:signals"] }),
    });
    if (res.ok) {
      const json = await res.json();
      setPlainToken(json?.plain ?? null);
      setNewTokenName("");
      load();
      toast.success("Token created");
    } else {
      toast.error("Token create failed");
    }
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Signals</p>
            <h1 className="text-2xl font-semibold">Signal Marketplace</h1>
          </div>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Latest Signals</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-3">
            {signals.slice(0, 6).map((s) => (
              <div key={s.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{s.symbol}</span>
                  <Badge variant="outline">{s.action}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  conf {s.confidence} • regime {s.regime || "?"} • {s.strategy_name || "strategy"}
                </div>
              </div>
            ))}
            {signals.length === 0 && <p className="text-sm text-muted-foreground">No signals yet.</p>}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhooks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Webhook URL"
                  value={newWebhook.target_url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, target_url: e.target.value })}
                />
                <Button onClick={createWebhook}>Add</Button>
              </div>
              <div className="space-y-2">
                {webhooks.map((w) => (
                  <div key={w.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{w.target_url}</div>
                      <div className="text-xs text-muted-foreground">{w.enabled ? "Enabled" : "Disabled"}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => testWebhook(w.id)}>
                      <Send className="w-4 h-4 mr-1" /> Test
                    </Button>
                  </div>
                ))}
                {webhooks.length === 0 && <p className="text-sm text-muted-foreground">No webhooks configured.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Tokens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Token label"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                />
                <Button onClick={createToken}>Create</Button>
              </div>
              {plainToken && (
                <div className="flex items-center justify-between bg-muted/40 p-2 rounded">
                  <span className="text-xs font-mono break-all">{plainToken}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(plainToken);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {tokens.map((t) => (
                  <div key={t.id} className="border rounded-lg p-3">
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">Scopes: {t.scopes?.join(", ")}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">hash: {t.token_hash}</div>
                  </div>
                ))}
                {tokens.length === 0 && <p className="text-sm text-muted-foreground">No tokens yet.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};

export default SignalsPage;
