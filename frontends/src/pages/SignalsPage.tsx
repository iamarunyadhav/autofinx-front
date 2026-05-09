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
  meta?: {
    source?: string;
    score?: number;
    rr?: number;
    risk_reward?: number;
    news_risk?: string;
    newsRisk?: string;
    htf_aligned?: boolean;
    htfAligned?: boolean;
    timeframe?: string;
  };
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
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Signals</p>
            <h1 className="text-2xl font-semibold">Signal Marketplace</h1>
          </div>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Latest Signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {signals.slice(0, 6).map((signal) => {
              const source = signal.meta?.source || "external";
              const rr = signal.meta?.rr ?? signal.meta?.risk_reward;
              const score = signal.meta?.score;
              const news = signal.meta?.news_risk ?? signal.meta?.newsRisk ?? "LOW";
              const htf = signal.meta?.htf_aligned ?? signal.meta?.htfAligned;

              return (
                <div key={signal.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{signal.symbol}</div>
                      <div className="text-xs text-muted-foreground">{signal.strategy_name || "strategy"} • {source}</div>
                    </div>
                    <Badge variant={signal.action === "BUY" ? "default" : signal.action === "SELL" ? "destructive" : "outline"}>
                      {signal.action}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">conf {signal.confidence}</Badge>
                    <Badge variant="outline">score {score ?? "?"}/10</Badge>
                    <Badge variant="outline">RR {rr ?? "?"}</Badge>
                    <Badge variant="outline">news {news}</Badge>
                    <Badge variant="outline">HTF {htf ? "yes" : "no"}</Badge>
                  </div>
                </div>
              );
            })}
            {signals.length === 0 && <p className="text-sm text-muted-foreground">No signals yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signal History</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Symbol</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Conf</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">RR</th>
                  <th className="py-2 pr-3">News</th>
                  <th className="py-2 pr-3">HTF</th>
                  <th className="py-2 pr-3">Strategy</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal) => (
                  <tr key={signal.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {signal.created_at ? new Date(signal.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="py-2 pr-3 font-medium">{signal.symbol}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={signal.action === "BUY" ? "default" : signal.action === "SELL" ? "destructive" : "outline"}>
                        {signal.action}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">{signal.meta?.source || "-"}</td>
                    <td className="py-2 pr-3">{signal.confidence}</td>
                    <td className="py-2 pr-3">{signal.meta?.score ?? "-"}</td>
                    <td className="py-2 pr-3">{signal.meta?.rr ?? signal.meta?.risk_reward ?? "-"}</td>
                    <td className="py-2 pr-3">{signal.meta?.news_risk ?? signal.meta?.newsRisk ?? "-"}</td>
                    <td className="py-2 pr-3">{(signal.meta?.htf_aligned ?? signal.meta?.htfAligned) ? "Yes" : "No"}</td>
                    <td className="py-2 pr-3">{signal.strategy_name || "-"}</td>
                  </tr>
                ))}
                {signals.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-sm text-muted-foreground">No signal history yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
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
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="text-sm font-medium">{webhook.target_url}</div>
                      <div className="text-xs text-muted-foreground">{webhook.enabled ? "Enabled" : "Disabled"}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => testWebhook(webhook.id)}>
                      <Send className="mr-1 h-4 w-4" /> Test
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
                <div className="flex items-center justify-between rounded bg-muted/40 p-2">
                  <span className="break-all font-mono text-xs">{plainToken}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(plainToken);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {tokens.map((token) => (
                  <div key={token.id} className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{token.name}</div>
                    <div className="text-xs text-muted-foreground">Scopes: {token.scopes?.join(", ")}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">hash: {token.token_hash}</div>
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
