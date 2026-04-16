import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useConnections,
  useCreateConnection,
  useUpdateConnection,
  useTestConnection,
} from "@/hooks/useConnections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type SettingsPayload = Record<string, Record<string, any>>;
type FieldType = "text" | "number" | "boolean" | "select" | "textarea";

type Field = {
  key: string;
  label: string;
  type: FieldType;
  description?: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
};

type ConfigGroup = {
  title: string;
  description: string;
  fields: Field[];
  defaults: Record<string, any>;
};

type ProviderKey = "binance" | "metal_broker";
type ProviderDraft = {
  name: string;
  api_key: string;
  api_secret: string;
  passphrase: string;
  is_testnet: boolean;
  is_enabled: boolean;
};

const providerMeta: Record<ProviderKey, { label: string; probeAsset: string }> = {
  binance: { label: "Binance Spot", probeAsset: "BTCUSDT" },
  metal_broker: { label: "Metal Broker", probeAsset: "XAUUSD" },
};

const configSchema: Record<string, ConfigGroup> = {
  trading: {
    title: "Trading Core",
    description: "Paper vs live mode, sizing, fees, and allowed markets.",
    defaults: {
      trading_mode: "paper",
      live_enabled: false,
      venue_environment: "sandbox",
      auto_trading_enabled: true,
      bot_default_interval_seconds: 3600,
      base_currency: "USD",
      allowed_symbols: "BTCUSDT,ETHUSDT,AAPL",
      max_trade_pct: 2,
      max_position_pct: 10,
      max_trades_per_day: 25,
      slippage_bps: 50,
      fee_bps: 10,
      take_profit_pct: 5,
      stop_loss_pct: 2,
      trailing_stop_pct: 1,
    },
    fields: [
      { key: "trading_mode", label: "Trading mode", type: "select", options: [{ label: "Paper", value: "paper" }, { label: "Live", value: "live" }], description: "Paper is safe demo; Live will hit real venues when enabled." },
      { key: "live_enabled", label: "Enable live trading", type: "boolean", description: "Requires exchange connections + 2FA for actions." },
      { key: "venue_environment", label: "Venue environment", type: "select", options: [{ label: "Sandbox/Testnet", value: "sandbox" }, { label: "Live", value: "live" }], description: "Used to align connection testnet/live mode from Settings." },
      { key: "auto_trading_enabled", label: "Enable auto trading", type: "boolean", description: "Master switch for scheduler-driven bot buy/sell decisions." },
      { key: "bot_default_interval_seconds", label: "Default bot cycle (seconds)", type: "number", description: "New auto bots use this cycle interval; 3600 means one analysis cycle per hour." },
      { key: "base_currency", label: "Base currency", type: "text", placeholder: "USD" },
      { key: "allowed_symbols", label: "Allowed symbols (comma separated)", type: "text", placeholder: "BTCUSDT,ETHUSDT" },
      { key: "max_trade_pct", label: "Max trade size (% of equity)", type: "number" },
      { key: "max_position_pct", label: "Max position size (% of equity)", type: "number" },
      { key: "max_trades_per_day", label: "Max trades per day", type: "number" },
      { key: "slippage_bps", label: "Slippage tolerance (bps)", type: "number" },
      { key: "fee_bps", label: "Assumed fees (bps)", type: "number" },
      { key: "take_profit_pct", label: "Take profit (%)", type: "number" },
      { key: "stop_loss_pct", label: "Stop loss (%)", type: "number" },
      { key: "trailing_stop_pct", label: "Trailing stop (%)", type: "number" },
    ],
  },
  risk: {
    title: "Risk & Kill Switch",
    description: "Hard stops before placing orders.",
    defaults: {
      kill_switch: false,
      max_daily_loss: 2500,
      max_drawdown_percent: 20,
      connection_fresh_minutes: 15,
      failed_order_retry_limit: 2,
    },
    fields: [
      { key: "kill_switch", label: "Global kill switch", type: "boolean", description: "Blocks all trading instantly." },
      { key: "max_daily_loss", label: "Max daily loss (absolute)", type: "number" },
      { key: "max_drawdown_percent", label: "Max drawdown (%)", type: "number" },
      { key: "connection_fresh_minutes", label: "Connection freshness (minutes)", type: "number" },
      { key: "failed_order_retry_limit", label: "Failed order retry limit", type: "number" },
    ],
  },
  routing: {
    title: "Smart Routing",
    description: "Venue selection rules for orders.",
    defaults: {
      mode: "best_price",
      allow_split_orders: false,
      max_venues_per_order: 1,
      min_balance_usd: 50,
      enabled: true,
    },
    fields: [
      { key: "mode", label: "Routing mode", type: "select", options: [{ label: "Best price", value: "best_price" }, { label: "Fee aware", value: "fee_aware" }, { label: "Latency aware", value: "latency_aware" }, { label: "Balanced", value: "balanced" }], description: "How to pick venues when multiple are available." },
      { key: "allow_split_orders", label: "Allow split orders", type: "boolean" },
      { key: "max_venues_per_order", label: "Max venues per order", type: "number" },
      { key: "min_balance_usd", label: "Min venue balance (USD) to route", type: "number" },
      { key: "enabled", label: "Routing enabled", type: "boolean" },
    ],
  },
  regime: {
    title: "AI Regime Detection",
    description: "How often to evaluate market regimes.",
    defaults: {
      evaluation_interval_minutes: 5,
      symbols: "BTCUSDT,ETHUSDT,AAPL",
    },
    fields: [
      { key: "evaluation_interval_minutes", label: "Evaluation interval (minutes)", type: "number" },
      { key: "symbols", label: "Symbols to monitor (comma separated)", type: "text" },
    ],
  },
  ai: {
    title: "AI Trading Brain",
    description: "Signal advisor provider selection for OpenAI / Gemini / Claude.",
    defaults: {
      enabled: false,
      provider: "openai",
      timeout_ms: 3500,
      enforce_approval_default: false,
    },
    fields: [
      { key: "enabled", label: "Enable AI advisor", type: "boolean" },
      {
        key: "provider",
        label: "Provider",
        type: "select",
        options: [
          { label: "OpenAI", value: "openai" },
          { label: "Gemini", value: "gemini" },
          { label: "Claude", value: "claude" },
        ],
      },
      { key: "timeout_ms", label: "Timeout (ms)", type: "number" },
      { key: "enforce_approval_default", label: "Default enforce AI approval", type: "boolean" },
    ],
  },
  copy_trading: {
    title: "Copy Trading",
    description: "Controls for follower allocations and safety.",
    defaults: {
      allocation_type: "percent_equity",
      allocation_value: 10,
      max_trade_size: 500,
      max_daily_loss: 1000,
      allowed_symbols: "BTCUSDT,ETHUSDT",
      paused: false,
    },
    fields: [
      { key: "allocation_type", label: "Allocation type", type: "select", options: [{ label: "Percent equity", value: "percent_equity" }, { label: "Fixed size", value: "fixed" }], description: "How follower sizing is calculated." },
      { key: "allocation_value", label: "Allocation value", type: "number" },
      { key: "max_trade_size", label: "Max trade size (quote)", type: "number" },
      { key: "max_daily_loss", label: "Max daily loss (quote)", type: "number" },
      { key: "allowed_symbols", label: "Allowed symbols (comma separated)", type: "text" },
      { key: "paused", label: "Pause copy engine", type: "boolean" },
    ],
  },
  signals: {
    title: "Signals & Webhooks",
    description: "Inbound signal publishing and auth.",
    defaults: {
      webhook_url: "",
      webhook_secret: "",
      dedupe_seconds: 15,
      min_confidence: 0.5,
      enabled: true,
    },
    fields: [
      { key: "webhook_url", label: "Signal webhook URL", type: "text", placeholder: "https://..." },
      { key: "webhook_secret", label: "Webhook secret (use a token)", type: "text", placeholder: "Do not reuse API keys" },
      { key: "dedupe_seconds", label: "Dedupe window (seconds)", type: "number" },
      { key: "min_confidence", label: "Minimum confidence", type: "number" },
      { key: "enabled", label: "Signals enabled", type: "boolean" },
    ],
  },
  security: {
    title: "Security & Approvals",
    description: "2FA and approval requirements for sensitive actions.",
    defaults: {
      enforce_2fa_login: true,
      enforce_2fa_critical: true,
      approvals_required: true,
      audit_retention_days: 90,
    },
    fields: [
      { key: "enforce_2fa_login", label: "Enforce 2FA on login", type: "boolean" },
      { key: "enforce_2fa_critical", label: "Enforce 2FA on critical actions", type: "boolean" },
      { key: "approvals_required", label: "Require approvals for high-risk changes", type: "boolean" },
      { key: "audit_retention_days", label: "Audit retention (days)", type: "number" },
    ],
  },
  billing: {
    title: "Billing & Wallet",
    description: "Gateway modes and wallet limits.",
    defaults: {
      billing_mode: "sandbox",
      gateway_default: "payhere",
      min_topup: 5,
      max_withdraw: 5000,
      withdrawals_require_approval: true,
    },
    fields: [
      { key: "billing_mode", label: "Billing mode", type: "select", options: [{ label: "Sandbox", value: "sandbox" }, { label: "Live", value: "live" }] },
      { key: "gateway_default", label: "Default gateway", type: "text", placeholder: "payhere | stripe | paypal | payoneer" },
      { key: "min_topup", label: "Minimum topup", type: "number" },
      { key: "max_withdraw", label: "Maximum withdraw", type: "number" },
      { key: "withdrawals_require_approval", label: "Withdrawals require approval", type: "boolean" },
    ],
  },
};

const groups = Object.keys(configSchema);

const SettingsCenterPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? (typeof window !== "undefined" ? localStorage.getItem("workspace_id") : null);
  const { data: connections = [] } = useConnections(workspaceId || undefined);
  const createConnection = useCreateConnection();
  const updateConnection = useUpdateConnection();
  const testConnection = useTestConnection();

  const [settings, setSettings] = useState<SettingsPayload>({});
  const [loading, setLoading] = useState(false);
  const [draftKeyValues, setDraftKeyValues] = useState<Record<string, { key: string; value: string }>>({});
  const [providerDrafts, setProviderDrafts] = useState<Record<ProviderKey, ProviderDraft>>({
    binance: {
      name: "Binance Main",
      api_key: "",
      api_secret: "",
      passphrase: "",
      is_testnet: true,
      is_enabled: true,
    },
    metal_broker: {
      name: "Metals Main",
      api_key: "",
      api_secret: "",
      passphrase: "",
      is_testnet: true,
      is_enabled: true,
    },
  });
  const [savingProvider, setSavingProvider] = useState<ProviderKey | null>(null);
  const [testingProvider, setTestingProvider] = useState<ProviderKey | null>(null);

  const api = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

  const appliedSettings = useMemo(() => {
    const merged: SettingsPayload = {};
    for (const group of groups) {
      const defaults = configSchema[group]?.defaults || {};
      merged[group] = { ...defaults, ...(settings[group] || {}) };
    }
    return merged;
  }, [settings]);

  const venueEnvironment = String(appliedSettings?.trading?.venue_environment || "sandbox");
  const providerConnections = useMemo(() => {
    const latestByProvider: Partial<Record<ProviderKey, any>> = {};
    for (const connection of connections as any[]) {
      const provider = String(connection.provider || connection.exchange || "").toLowerCase();
      if (provider !== "binance" && provider !== "metal_broker") continue;
      if (!latestByProvider[provider as ProviderKey]) {
        latestByProvider[provider as ProviderKey] = connection;
        continue;
      }
      const current = latestByProvider[provider as ProviderKey];
      if (new Date(connection.updated_at || connection.created_at || 0).getTime() > new Date(current.updated_at || current.created_at || 0).getTime()) {
        latestByProvider[provider as ProviderKey] = connection;
      }
    }
    return latestByProvider;
  }, [connections]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fetched: SettingsPayload = {};
      for (const g of groups) {
        const workspaceQuery = workspaceId ? `&workspace_id=${workspaceId}` : "";
        const res = await fetch(`${api}/settings?group=${g}${workspaceQuery}`, {
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          fetched[g] = json;
        }
      }
      setSettings(fetched);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [api, workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setProviderDrafts((prev) => {
      const next: Record<ProviderKey, ProviderDraft> = { ...prev };
      (Object.keys(providerMeta) as ProviderKey[]).forEach((provider) => {
        const existing = providerConnections[provider];
        next[provider] = {
          ...prev[provider],
          name: existing?.name || prev[provider].name,
          is_testnet: existing ? Boolean(existing.is_testnet) : venueEnvironment === "sandbox",
          is_enabled: existing ? Boolean(existing.is_enabled ?? existing.is_active ?? true) : prev[provider].is_enabled,
          api_key: "",
          api_secret: "",
          passphrase: "",
        };
      });
      return next;
    });
  }, [providerConnections, venueEnvironment]);

  const save = async () => {
    try {
      const res = await fetch(`${api}/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId ?? null, settings: appliedSettings }),
      });
      if (!res.ok) throw new Error();
      toast.success("Settings saved");
    } catch {
      toast.error("Save failed");
    }
  };

  const updateValue = (group: string, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [group]: { ...(prev[group] || {}), [key]: value },
    }));
  };

  const resetGroup = (group: string) => {
    setSettings((prev) => ({
      ...prev,
      [group]: configSchema[group]?.defaults || {},
    }));
  };

  const setDraft = (group: string, key: "key" | "value", value: string) => {
    setDraftKeyValues((prev) => ({
      ...prev,
      [group]: { ...(prev[group] || { key: "", value: "" }), [key]: value },
    }));
  };

  const addCustomKey = (group: string) => {
    const draft = draftKeyValues[group];
    if (!draft?.key) return;
    updateValue(group, draft.key, draft.value);
    setDraftKeyValues((prev) => ({ ...prev, [group]: { key: "", value: "" } }));
  };

  const updateProviderDraft = (provider: ProviderKey, key: keyof ProviderDraft, value: string | boolean) => {
    setProviderDrafts((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [key]: value,
      },
    }));
  };

  const saveProvider = async (provider: ProviderKey) => {
    if (!workspaceId) {
      toast.error("Workspace not selected");
      return;
    }

    const draft = providerDrafts[provider];
    const existing = providerConnections[provider];
    setSavingProvider(provider);
    try {
      if (existing) {
        await updateConnection.mutateAsync({
          id: existing.id,
          workspaceId,
          name: draft.name,
          is_testnet: draft.is_testnet,
          is_enabled: draft.is_enabled,
          api_key: draft.api_key || undefined,
          api_secret: draft.api_secret || undefined,
          passphrase: draft.passphrase || undefined,
        });
      } else {
        if (!draft.api_key || !draft.api_secret) {
          toast.error(`${providerMeta[provider].label}: API key and secret are required for new connection`);
          return;
        }
        await createConnection.mutateAsync({
          workspace_id: workspaceId,
          name: draft.name,
          provider,
          api_key: draft.api_key,
          api_secret: draft.api_secret,
          passphrase: draft.passphrase || undefined,
          is_testnet: draft.is_testnet,
        });
      }

      setProviderDrafts((prev) => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          api_key: "",
          api_secret: "",
          passphrase: "",
        },
      }));
      toast.success(`${providerMeta[provider].label} credentials saved`);
    } catch (error: any) {
      toast.error(error?.message || `Failed to save ${providerMeta[provider].label}`);
    } finally {
      setSavingProvider(null);
    }
  };

  const testProviderConnection = async (provider: ProviderKey) => {
    const existing = providerConnections[provider];
    if (!existing) {
      toast.error(`No ${providerMeta[provider].label} connection to test`);
      return;
    }
    setTestingProvider(provider);
    try {
      await testConnection.mutateAsync({ connectionId: existing.id });
      toast.success(`${providerMeta[provider].label} test successful`);
    } catch (error: any) {
      toast.error(error?.message || `${providerMeta[provider].label} test failed`);
    } finally {
      setTestingProvider(null);
    }
  };

  const syncEnvironmentToConnections = async () => {
    if (!workspaceId) {
      toast.error("Workspace not selected");
      return;
    }

    const targetIsTestnet = venueEnvironment === "sandbox";
    try {
      for (const provider of Object.keys(providerMeta) as ProviderKey[]) {
        const existing = providerConnections[provider];
        if (!existing) continue;
        await updateConnection.mutateAsync({
          id: existing.id,
          workspaceId,
          is_testnet: targetIsTestnet,
        });
      }
      toast.success(`Connections synced to ${venueEnvironment.toUpperCase()} mode`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to sync environment mode");
    }
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Configuration</p>
            <h1 className="text-2xl font-semibold">Settings Center</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>Reload</Button>
            <Button onClick={save} disabled={loading}>Save</Button>
          </div>
        </div>

        <Card className="border-border/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Execution Environment & Provider Credentials</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Sandbox/Live mode மற்றும் Binance + Metal Broker API credentials இங்கிருந்து manage பண்ணலாம்.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={venueEnvironment === "sandbox" ? "secondary" : "destructive"}>
                {venueEnvironment.toUpperCase()}
              </Badge>
              <Button variant="outline" onClick={syncEnvironmentToConnections}>
                Sync Providers to {venueEnvironment.toUpperCase()}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {(Object.keys(providerMeta) as ProviderKey[]).map((provider) => {
                const draft = providerDrafts[provider];
                const existing = providerConnections[provider];
                return (
                  <Card key={provider} className="border-border/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{providerMeta[provider].label}</CardTitle>
                        <Badge variant={existing ? "default" : "outline"}>
                          {existing ? "Connected" : "Not Connected"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Connection Name</label>
                        <Input
                          value={draft.name}
                          onChange={(e) => updateProviderDraft(provider, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">API Key</label>
                        <Input
                          type="password"
                          placeholder={existing ? "Leave blank to keep existing key" : "Enter API key"}
                          value={draft.api_key}
                          onChange={(e) => updateProviderDraft(provider, "api_key", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">API Secret</label>
                        <Input
                          type="password"
                          placeholder={existing ? "Leave blank to keep existing secret" : "Enter API secret"}
                          value={draft.api_secret}
                          onChange={(e) => updateProviderDraft(provider, "api_secret", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Passphrase (optional)</label>
                        <Input
                          type="password"
                          placeholder="Optional"
                          value={draft.passphrase}
                          onChange={(e) => updateProviderDraft(provider, "passphrase", e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-2">
                        <span className="text-sm">Use Sandbox/Testnet</span>
                        <Switch
                          checked={draft.is_testnet}
                          onCheckedChange={(checked) => updateProviderDraft(provider, "is_testnet", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-2">
                        <span className="text-sm">Connection Enabled</span>
                        <Switch
                          checked={draft.is_enabled}
                          onCheckedChange={(checked) => updateProviderDraft(provider, "is_enabled", checked)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={() => saveProvider(provider)}
                          disabled={savingProvider === provider}
                        >
                          {savingProvider === provider ? "Saving..." : "Save Credentials"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => testProviderConnection(provider)}
                          disabled={!existing || testingProvider === provider}
                        >
                          {testingProvider === provider ? "Testing..." : "Test"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-4">
          {groups.map((group) => {
            const cfg = configSchema[group];
            const values = appliedSettings[group] || {};
            return (
              <Card key={group} className="border-border/70">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="capitalize">{cfg.title}</CardTitle>
                      <Badge variant="outline">{group}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{cfg.description}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => resetGroup(group)}>Reset</Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cfg.fields.map((field) => (
                    <div key={`${group}-${field.key}`} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">{field.label}</label>
                        {field.description && (
                          <span className="text-[11px] text-muted-foreground ml-2">{field.description}</span>
                        )}
                      </div>
                      {field.type === "boolean" ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(values[field.key])}
                            onCheckedChange={(checked) => updateValue(group, field.key, checked)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {Boolean(values[field.key]) ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      ) : field.type === "select" ? (
                        <div className="flex gap-2">
                          <select
                            className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm"
                            value={values[field.key] ?? ""}
                            onChange={(e) => updateValue(group, field.key, e.target.value)}
                          >
                            {(field.options || []).map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      ) : field.type === "textarea" ? (
                        <textarea
                          className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm"
                          rows={3}
                          value={values[field.key] ?? ""}
                          placeholder={field.placeholder}
                          onChange={(e) => updateValue(group, field.key, e.target.value)}
                        />
                      ) : (
                        <Input
                          type={field.type === "number" ? "number" : "text"}
                          value={values[field.key] ?? ""}
                          placeholder={field.placeholder}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (field.type === "number") {
                              updateValue(group, field.key, raw === "" ? "" : Number(raw));
                            } else {
                              updateValue(group, field.key, raw);
                            }
                          }}
                        />
                      )}
                    </div>
                  ))}

                  <div className={cn("pt-2 border-t border-border/60")}>
                    <p className="text-xs text-muted-foreground mb-2">Add custom key</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="key"
                        value={draftKeyValues[group]?.key ?? ""}
                        onChange={(e) => setDraft(group, "key", e.target.value)}
                      />
                      <Input
                        placeholder="value"
                        value={draftKeyValues[group]?.value ?? ""}
                        onChange={(e) => setDraft(group, "value", e.target.value)}
                      />
                      <Button variant="outline" onClick={() => addCustomKey(group)}>Add</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
};

export default SettingsCenterPage;
