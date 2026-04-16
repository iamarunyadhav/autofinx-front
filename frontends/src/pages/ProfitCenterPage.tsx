import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/hooks/useWorkspace";
import { authHeaders } from "@/lib/auth";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const ProfitCenterPage = () => {
  const { currentWorkspace } = useWorkspace();
  const [arbs, setArbs] = useState<any[]>([]);
  const [yieldPositions, setYieldPositions] = useState<any[]>([]);
  const [defiPositions, setDefiPositions] = useState<any[]>([]);
  const [spread, setSpread] = useState(0.2);

  const loadArb = async () => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/profit/arbitrage/opportunities?workspace_id=${currentWorkspace?.id ?? ""}`, { headers, credentials: "include" });
    if (res.ok) setArbs(await res.json());
  };
  const loadYield = async () => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/profit/yield/positions?workspace_id=${currentWorkspace?.id ?? ""}`, { headers, credentials: "include" });
    if (res.ok) setYieldPositions(await res.json());
  };
  const loadDefi = async () => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/profit/defi/positions?workspace_id=${currentWorkspace?.id ?? ""}`, { headers, credentials: "include" });
    if (res.ok) setDefiPositions(await res.json());
  };

  useEffect(() => {
    loadArb(); loadYield(); loadDefi();
  }, [currentWorkspace?.id]);

  const runArb = async () => {
    if (!currentWorkspace?.id) return;
    const headers = await authHeaders();
    const tickers = {
      BTCUSDT: { binance: 43000, coinbase: 43200 },
      ETHUSDT: { binance: 2300, coinbase: 2325 },
    };
    const res = await fetch(`${API_BASE}/profit/arbitrage/run-once`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ workspace_id: currentWorkspace.id, tickers, threshold_pct: spread }),
    });
    if (res.ok) {
      toast.success("Arbitrage scan simulated");
      loadArb();
    } else {
      toast.error("Arb scan failed");
    }
  };

  const addYield = async () => {
    if (!currentWorkspace?.id) return;
    const headers = await authHeaders();
    await fetch(`${API_BASE}/profit/yield/subscribe`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ workspace_id: currentWorkspace.id, asset: "USDT", apr_bps: 800 }),
    });
    toast.success("Yield accrual simulated");
    loadYield();
  };

  const addDefi = async () => {
    if (!currentWorkspace?.id) return;
    const headers = await authHeaders();
    await fetch(`${API_BASE}/profit/defi/simulate`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ workspace_id: currentWorkspace.id, protocol: "sim", asset: "USDC", apy_bps: 500 }),
    });
    toast.success("DeFi position simulated");
    loadDefi();
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Profit</p>
            <h1 className="text-2xl font-semibold">Profit Center</h1>
          </div>
          <Button variant="outline" onClick={() => { loadArb(); loadYield(); loadDefi(); }}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <Tabs defaultValue="arbitrage">
          <TabsList>
            <TabsTrigger value="arbitrage">Arbitrage</TabsTrigger>
            <TabsTrigger value="yield">Yield/Staking</TabsTrigger>
            <TabsTrigger value="defi">DeFi</TabsTrigger>
          </TabsList>

          <TabsContent value="arbitrage" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Controls</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm">Spread threshold (%)</label>
                  <Input type="number" value={spread} onChange={(e) => setSpread(Number(e.target.value))} />
                </div>
                <div className="flex items-end">
                  <Button onClick={runArb}>Run Once (paper)</Button>
                </div>
              </CardContent>
            </Card>
            <div className="grid md:grid-cols-3 gap-3">
              {arbs.map((op) => (
                <Card key={op.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">{op.symbol}</CardTitle>
                    <Badge variant="outline">{op.spread_pct}%</Badge>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Buy {op.buy_venue} → Sell {op.sell_venue}
                  </CardContent>
                </Card>
              ))}
              {arbs.length === 0 && <p className="text-sm text-muted-foreground">No opportunities yet.</p>}
            </div>
          </TabsContent>

          <TabsContent value="yield" className="space-y-3">
            <Card>
              <CardHeader><CardTitle>Yield Simulation</CardTitle></CardHeader>
              <CardContent className="flex gap-2">
                <Button onClick={addYield}>Accrue Yield (demo)</Button>
              </CardContent>
            </Card>
            <div className="grid md:grid-cols-3 gap-3">
              {yieldPositions.map((p) => (
                <Card key={p.id}>
                  <CardHeader><CardTitle>{p.asset}</CardTitle></CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Amount {p.amount} • APR {p.apr_bps} bps
                  </CardContent>
                </Card>
              ))}
              {yieldPositions.length === 0 && <p className="text-sm text-muted-foreground">No yield positions.</p>}
            </div>
          </TabsContent>

          <TabsContent value="defi" className="space-y-3">
            <Card>
              <CardHeader><CardTitle>DeFi Simulation</CardTitle></CardHeader>
              <CardContent className="flex gap-2">
                <Button onClick={addDefi}>Simulate Position</Button>
              </CardContent>
            </Card>
            <div className="grid md:grid-cols-3 gap-3">
              {defiPositions.map((p) => (
                <Card key={p.id}>
                  <CardHeader><CardTitle>{p.protocol}</CardTitle></CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {p.asset} • APY {p.apy_bps} bps • Amount {p.amount}
                  </CardContent>
                </Card>
              ))}
              {defiPositions.length === 0 && <p className="text-sm text-muted-foreground">No DeFi positions.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default ProfitCenterPage;
