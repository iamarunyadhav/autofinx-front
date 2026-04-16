import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useConnections } from '@/hooks/useConnections';
import {
  useLiveBots,
  useCreateLiveBot,
  useStartBot,
  usePauseBot,
  useStopBot,
  useEmergencyStopBot,
  useClosePositionNow,
  useBotMonitor,
  useAssetRegistry,
  useLiveMarketPrice,
  useAiRecommendations,
  useApplyAiRecommendation,
  type LiveBot,
} from '@/hooks/useLiveBots';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTradingSettings, useUpdateTradingSettings } from '@/hooks/useTradingMode';

type AssetClass = 'CRYPTO' | 'METALS';
type MetalType = 'GOLD' | 'SILVER' | 'BRONZE';

export default function LiveBotsPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { data: connections = [] } = useConnections(workspaceId);
  const { data: registry } = useAssetRegistry();
  const tradingSettingsQuery = useTradingSettings(workspaceId);
  const tradingSettings = tradingSettingsQuery.data;
  const updateTradingSettings = useUpdateTradingSettings(workspaceId);

  const [assetClass, setAssetClass] = useState<AssetClass>('CRYPTO');
  const [metalType, setMetalType] = useState<MetalType>('GOLD');
  const { data: bots = [] } = useLiveBots(workspaceId, {
    assetClass,
    metalType: assetClass === 'METALS' ? metalType : undefined,
  });
  const [selectedBotId, setSelectedBotId] = useState<string | undefined>(undefined);
  const monitor = useBotMonitor(selectedBotId);
  const aiRecommendations = useAiRecommendations(selectedBotId);

  const createBot = useCreateLiveBot(workspaceId);
  const startBot = useStartBot(workspaceId);
  const pauseBot = usePauseBot(workspaceId);
  const stopBot = useStopBot(workspaceId);
  const emergencyStop = useEmergencyStopBot(workspaceId);
  const closePosition = useClosePositionNow(workspaceId);
  const applyAiRecommendation = useApplyAiRecommendation(workspaceId);

  const [name, setName] = useState('BTC Momentum');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [intervalSec, setIntervalSec] = useState('3600');
  const [connectionId, setConnectionId] = useState<string>('none');
  const [isLive, setIsLive] = useState(true);
  const [quoteCurrency, setQuoteCurrency] = useState<'USD' | 'LKR' | 'USDT'>('USDT');
  const [allocationMode, setAllocationMode] = useState<'FIXED' | 'PERCENT_WALLET' | 'STRATEGY'>('FIXED');
  const [allocationPercent, setAllocationPercent] = useState('10');
  const [allocationAmount, setAllocationAmount] = useState('100');
  const [allocationCurrency, setAllocationCurrency] = useState<'USD' | 'LKR' | 'USDT'>('USD');
  const [paramsJson, setParamsJson] = useState(
    JSON.stringify(
      {
        buy_drop_pct: 0.8,
        buy_drop_value: 0,
        sell_rise_pct: 0.8,
        sell_rise_value: 0,
        max_slippage_pct: 0.4,
        ttl_ms: 7000,
        fill_timeout_ms: 3000,
        max_retries: 2,
        order_notional: 30,
        max_spread_pct: 0.6,
        min_profit_after_fees_pct: 0.25,
        ai_enforce_approval: false,
      },
      null,
      2
    )
  );

  useEffect(() => {
    if (tradingSettings?.bot_default_interval_seconds) {
      setIntervalSec(String(tradingSettings.bot_default_interval_seconds));
    }
  }, [tradingSettings?.bot_default_interval_seconds]);

  const cryptoSymbols = useMemo(() => Object.keys(registry?.crypto?.symbols || { BTCUSDT: true }), [registry]);
  const selectedMetalAsset = useMemo(
    () => registry?.metals?.symbols?.[metalType]?.asset_code || (metalType === 'GOLD' ? 'XAUUSD' : metalType === 'SILVER' ? 'XAGUSD' : 'XCUUSD'),
    [registry, metalType]
  );
  const selectedAssetCode = assetClass === 'METALS' ? selectedMetalAsset : symbol;
  const selectedProvider = assetClass === 'METALS' ? 'metal_broker' : 'binance';
  const autoTradingEnabled = tradingSettings?.auto_trading_enabled ?? true;
  const defaultBotCycleSeconds = Number(tradingSettings?.bot_default_interval_seconds ?? 3600);

  const priceQuery = useLiveMarketPrice({
    asset_class: assetClass,
    asset_code: selectedAssetCode,
    provider: selectedProvider,
    quote: assetClass === 'METALS' ? 'LKR' : quoteCurrency,
  });

  const activeConnections = useMemo(
    () =>
      connections.filter((c: any) => {
        const provider = (c.provider || c.exchange || '').toLowerCase();
        if (!(c.is_active ?? c.is_enabled)) return false;
        return assetClass === 'METALS' ? provider === 'metal_broker' || provider === 'metals' : provider === 'binance';
      }),
    [connections, assetClass]
  );

  const persistTradingState = (
    nextMode: 'paper' | 'live' = tradingSettings?.trading_mode ?? 'paper',
    provider = selectedProvider,
    integrationId = tradingSettings?.preferred_integration_id ?? 'auto',
    autoTrading = autoTradingEnabled
  ) => {
    if (!workspaceId) return;

    updateTradingSettings.mutate({
      trading_mode: nextMode,
      live_enabled: nextMode === 'live',
      venue_environment: nextMode === 'live' ? 'live' : 'sandbox',
      preferred_provider: provider,
      preferred_integration_id: integrationId === 'auto' ? null : integrationId,
      auto_trading_enabled: autoTrading,
      bot_default_interval_seconds: defaultBotCycleSeconds,
    });
  };

  const toggleAutoTrading = (enabled: boolean) => {
    persistTradingState(tradingSettings?.trading_mode ?? 'paper', selectedProvider, tradingSettings?.preferred_integration_id ?? 'auto', enabled);
  };

  const handleCreate = async () => {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(paramsJson || '{}');
    } catch {
      return;
    }

    await createBot.mutateAsync({
      name,
      symbol: selectedAssetCode,
      asset_class: assetClass,
      metal_type: assetClass === 'METALS' ? metalType : undefined,
      asset_code: selectedAssetCode,
      quote_currency: assetClass === 'METALS' ? (quoteCurrency === 'USDT' ? 'USD' : quoteCurrency) : 'USDT',
      provider: selectedProvider,
      interval_sec: Number(intervalSec),
      connection_id: connectionId === 'none' ? undefined : connectionId,
      is_live: isLive,
      exchange: selectedProvider,
      strategy_type: assetClass === 'METALS' ? 'rebalance_flip' : 'threshold',
      strategy_params: parsed,
      allocation_mode: allocationMode,
      allocation_percent: Number(allocationPercent),
      trade_allocation_amount: Number(allocationAmount),
      trade_allocation_currency: allocationCurrency,
    });
  };

  const statusTone = (status: LiveBot['status']) => {
    if (status === 'RUNNING') return 'bg-green-500/10 text-green-600 border-green-500/30';
    if (status === 'PAUSED') return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
  };
  const startDisabled = !autoTradingEnabled;

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Auto trade bot</div>
              <h1 className="text-3xl font-bold tracking-tight">Auto Bot Control</h1>
              <p className="mt-1 max-w-3xl text-muted-foreground">
                Scheduler-driven buy/sell automation with signal filters, AI support, slippage guard, loss stops, and one master ON/OFF switch.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={autoTradingEnabled ? 'border-emerald-500/40 text-emerald-600' : 'border-amber-500/40 text-amber-600'}>
                Auto trading {autoTradingEnabled ? 'ON' : 'OFF'}
              </Badge>
              <Badge variant="outline">{tradingSettings?.trading_mode?.toUpperCase?.() || 'PAPER'}</Badge>
              <Badge variant="outline">{tradingSettings?.preferred_provider?.toUpperCase?.() || selectedProvider.toUpperCase()}</Badge>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-slate-800 bg-slate-950 text-slate-50 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  Auto Trading Master Switch
                  <Switch checked={autoTradingEnabled} onCheckedChange={toggleAutoTrading} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <p>
                  When this is OFF, the scheduler will not open new bot trades. Existing bot positions remain visible for monitoring and manual control.
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Cycle</div>
                    <div className="mt-1 text-lg font-semibold">{defaultBotCycleSeconds} sec</div>
                    <div className="text-xs text-slate-400">3600 sec = hourly analysis cycle.</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Signal source</div>
                    <div className="mt-1 text-lg font-semibold">Indicators + AI</div>
                    <div className="text-xs text-slate-400">Signals still go through risk and execution guards.</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Stops</div>
                    <div className="mt-1 text-lg font-semibold">SL / TP / Trailing</div>
                    <div className="text-xs text-slate-400">Stop rules are enforced in the bot params and exit stack.</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-950 text-slate-50">
              <CardHeader>
                <CardTitle>How it works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-300">
                <ol className="space-y-2 pl-4 list-decimal">
                  <li>Connect Binance and keep the workspace in the correct mode.</li>
                  <li>Create a bot with an hourly cycle if you want slow, conservative analysis.</li>
                  <li>Turn Auto Trading ON only after risk limits and stop rules are set.</li>
                  <li>Start the bot. Scheduler runs in the background and only trades when rules pass.</li>
                  <li>Monitor logs and use Pause/Stop/Emergency Stop whenever needed.</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-slate-800 bg-slate-950 text-slate-50">
          <CardContent className="pt-6 space-y-4">
            <Tabs value={assetClass} onValueChange={(v) => setAssetClass(v as AssetClass)}>
              <TabsList>
                <TabsTrigger value="CRYPTO">Crypto</TabsTrigger>
                <TabsTrigger value="METALS">Metals</TabsTrigger>
              </TabsList>
            </Tabs>

            {assetClass === 'METALS' && (
              <Tabs value={metalType} onValueChange={(v) => setMetalType(v as MetalType)}>
                <TabsList>
                  <TabsTrigger value="GOLD">Gold</TabsTrigger>
                  <TabsTrigger value="SILVER">Silver</TabsTrigger>
                  <TabsTrigger value="BRONZE">Bronze</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{selectedAssetCode}</Badge>
              <Badge variant="outline">{selectedProvider.toUpperCase()}</Badge>
              {assetClass === 'METALS' ? (
                <>
                  <Badge variant="secondary">USD {(priceQuery.data?.usd?.mid || 0).toFixed(4)}</Badge>
                  <Badge variant="secondary">LKR {(priceQuery.data?.lkr?.mid || 0).toFixed(2)}</Badge>
                  <Badge variant="outline">FX USD/LKR {(priceQuery.data?.fx_used_usd_lkr || 0).toFixed(4)}</Badge>
                  <Badge variant="outline">Spread {(priceQuery.data?.spread_pct || 0).toFixed(4)}%</Badge>
                </>
              ) : (
                <Badge variant="secondary">
                  Price {Number(priceQuery.data?.price || priceQuery.data?.mid || 0).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-slate-800 bg-slate-950 text-slate-50 lg:col-span-1">
            <CardHeader>
              <CardTitle>Create Auto Bot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {assetClass === 'CRYPTO' ? (
                <div className="space-y-1">
                  <Label>Asset</Label>
                  <Select value={symbol} onValueChange={setSymbol}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cryptoSymbols.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Metal Asset</Label>
                  <Input value={selectedMetalAsset} readOnly />
                </div>
              )}
              <div className="space-y-1">
                <Label>Quote Currency</Label>
                <Select value={quoteCurrency} onValueChange={(v) => setQuoteCurrency(v as 'USD' | 'LKR' | 'USDT')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="LKR">LKR</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Cycle interval (sec)</Label>
                <Input type="number" min={1} value={intervalSec} onChange={(e) => setIntervalSec(e.target.value)} />
                <div className="text-xs text-slate-400">Use 3600 for one analysis cycle per hour.</div>
              </div>
              <div className="space-y-1">
                <Label>Connection</Label>
                <Select value={connectionId} onValueChange={setConnectionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional provider connection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No saved connection</SelectItem>
                    {activeConnections.map((connection: any) => (
                      <SelectItem key={connection.id} value={connection.id}>
                        {connection.name} ({(connection.provider || connection.exchange || selectedProvider).toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between border rounded-md px-3 py-2">
                <Label>Live Mode</Label>
                <Switch checked={isLive} onCheckedChange={setIsLive} />
              </div>
              <div className="space-y-1">
                <Label>Allocation Mode</Label>
                <Select value={allocationMode} onValueChange={(v) => setAllocationMode(v as 'FIXED' | 'PERCENT_WALLET' | 'STRATEGY')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed Amount</SelectItem>
                    <SelectItem value="PERCENT_WALLET">% Wallet</SelectItem>
                    <SelectItem value="STRATEGY">Strategy Notional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Allocation Amount</Label>
                  <Input type="number" min={0} step="any" value={allocationAmount} onChange={(e) => setAllocationAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Allocation %</Label>
                  <Input type="number" min={0} max={100} step="any" value={allocationPercent} onChange={(e) => setAllocationPercent(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Allocation Currency</Label>
                <Select value={allocationCurrency} onValueChange={(v) => setAllocationCurrency(v as 'USD' | 'LKR' | 'USDT')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="LKR">LKR</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Strategy Params (JSON)</Label>
                <Textarea rows={10} value={paramsJson} onChange={(e) => setParamsJson(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createBot.isPending || !workspaceId}>
                {createBot.isPending ? 'Creating...' : 'Create Bot'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-950 text-slate-50 lg:col-span-2">
            <CardHeader>
              <CardTitle>Bots</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {bots.length === 0 && <p className="text-sm text-muted-foreground">No bots yet for selected asset mode.</p>}
              {bots.map((bot) => (
                <div key={bot.id} className="border rounded-md p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{bot.name}</span>
                      <Badge variant="outline" className={statusTone(bot.status)}>
                        {bot.status}
                      </Badge>
                      <Badge variant="outline">{bot.asset_code || bot.symbol}</Badge>
                      <Badge variant="secondary">{bot.asset_class || 'CRYPTO'}</Badge>
                      {bot.metal_type && <Badge variant="outline">{bot.metal_type}</Badge>}
                      <Badge variant="outline">Cycle {bot.interval_sec}s</Badge>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setSelectedBotId(bot.id)}>
                      Monitor
                    </Button>
                  </div>
                  {!autoTradingEnabled && (
                    <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                      Auto trading is OFF. Start actions are blocked until you turn the master switch back on.
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => startBot.mutate({ botId: bot.id })} disabled={startDisabled}>
                      Start
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => pauseBot.mutate({ botId: bot.id })}>
                      Pause
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => stopBot.mutate({ botId: bot.id })}>
                      Stop
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => closePosition.mutate({ botId: bot.id })}>
                      Close Position Now
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => emergencyStop.mutate({ botId: bot.id })}>
                      Emergency Stop
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {selectedBotId && (
          <Card>
            <CardHeader>
              <CardTitle>Live Monitor</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <h3 className="font-medium">Price / Signals / Orders</h3>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-80">
                  {JSON.stringify(
                    {
                      price: monitor.data?.price,
                      signals: monitor.data?.signals?.slice?.(0, 20) || [],
                      orders: monitor.data?.orders?.slice?.(0, 20) || [],
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Trades / Logs</h3>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-80">
                  {JSON.stringify(
                    {
                      trades: monitor.data?.trades?.slice?.(0, 20) || [],
                      logs: monitor.data?.logs?.slice?.(0, 20) || [],
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">AI Suggestion</h3>
                <div className="text-xs bg-muted p-3 rounded-md space-y-2">
                  {aiRecommendations.data?.recommendations?.[0] ? (
                    <>
                      <p>
                        <strong>Mode:</strong> {aiRecommendations.data.mode}
                      </p>
                      <p>
                        <strong>Posture:</strong>{' '}
                        {String(aiRecommendations.data.recommendations[0]?.payload_json?.suggestion?.posture || 'n/a')}
                      </p>
                      <p>
                        <strong>Reason:</strong>{' '}
                        {String(aiRecommendations.data.recommendations[0]?.payload_json?.suggestion?.reason || 'n/a')}
                      </p>
                      <pre className="bg-background border rounded p-2 overflow-auto max-h-40">
                        {JSON.stringify(aiRecommendations.data.recommendations[0]?.payload_json?.suggestion?.params || {}, null, 2)}
                      </pre>
                      <Button
                        size="sm"
                        onClick={() =>
                          applyAiRecommendation.mutate({
                            botId: selectedBotId,
                            recommendationId: aiRecommendations.data?.recommendations?.[0]?.id,
                          })
                        }
                        disabled={applyAiRecommendation.isPending}
                      >
                        {applyAiRecommendation.isPending ? 'Applying...' : 'Apply Suggestion'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground">No recommendation yet.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          applyAiRecommendation.mutate({
                            botId: selectedBotId,
                          })
                        }
                        disabled={applyAiRecommendation.isPending}
                      >
                        {applyAiRecommendation.isPending ? 'Generating...' : 'Generate + Apply'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
