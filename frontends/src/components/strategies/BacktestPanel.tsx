import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { callEdgeFunction } from '@/lib/api';
import type { Database } from '@/integrations/supabase/types';

type StrategyInstance = Database['public']['Tables']['strategy_instances']['Row'];

interface BacktestPanelProps {
  instance: StrategyInstance;
  onClose: () => void;
}

interface BacktestSummary {
  initialCapital: number;
  endingEquity: number;
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
}

interface BacktestResponse {
  result: {
    summary: BacktestSummary;
    meta?: {
      candles?: number;
      warmup_candles?: number;
      candle_timeframe?: string;
    };
  };
}

export function BacktestPanel({ instance, onClose }: BacktestPanelProps) {
  const [lookback, setLookback] = useState('1M');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BacktestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ candles: number; warmup: number; candleTimeframe: string } | null>(null);

  const lookbackToLimit = (value: string) => {
    switch (value) {
      case '1W':
        return 24 * 7;
      case '3M':
        return 24 * 90;
      case '6M':
        return 24 * 180;
      case '1Y':
        return 24 * 365;
      case '1M':
      default:
        return 24 * 30;
    }
  };

  const runBacktest = async () => {
    setIsRunning(true);
    setProgress(15);
    setResult(null);
    setError(null);
    setMeta(null);

    try {
      const data = await callEdgeFunction<BacktestResponse>('strategy', {
        action: 'run_backtest',
        instance_id: instance.id,
        symbol,
        candle_timeframe: '1h',
        limit: lookbackToLimit(lookback),
      });

      setProgress(100);
      setResult(data.result.summary);
      setMeta({
        candles: data.result.meta?.candles ?? 0,
        warmup: data.result.meta?.warmup_candles ?? 0,
        candleTimeframe: data.result.meta?.candle_timeframe ?? '1h',
      });
    } catch (runError) {
      setProgress(0);
      setError(runError instanceof Error ? runError.message : 'Backtest failed.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="bg-card border-border w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Backtest Strategy
          </SheetTitle>
        </SheetHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-6"
        >
          <div className="text-sm text-muted-foreground">
            Testing: <span className="text-foreground font-medium">{instance.name}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTCUSDT">BTCUSDT</SelectItem>
                  <SelectItem value="ETHUSDT">ETHUSDT</SelectItem>
                  <SelectItem value="SOLUSDT">SOLUSDT</SelectItem>
                  <SelectItem value="AAPL">AAPL</SelectItem>
                  <SelectItem value="TSLA">TSLA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lookback</Label>
              <Select value={lookback} onValueChange={setLookback}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1W">1 Week</SelectItem>
                  <SelectItem value="1M">1 Month</SelectItem>
                  <SelectItem value="3M">3 Months</SelectItem>
                  <SelectItem value="6M">6 Months</SelectItem>
                  <SelectItem value="1Y">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={runBacktest}
            disabled={isRunning}
            className="w-full gap-2 bg-primary hover:bg-primary/90"
          >
            <Play className="h-4 w-4" />
            {isRunning ? 'Running Backtest...' : 'Run Backtest'}
          </Button>

          {isRunning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Running real candle replay...</span>
                <span className="text-primary font-mono">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </motion.div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Results</h3>
                <Badge variant="outline" className="text-xs">
                  {symbol} | {lookback}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-background border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Return</span>
                      {result.totalReturn >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-[hsl(var(--profit))]" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-[hsl(var(--loss))]" />
                      )}
                    </div>
                    <div className={`text-2xl font-bold font-mono mt-1 ${
                      result.totalReturn >= 0 ? 'text-[hsl(var(--profit))]' : 'text-[hsl(var(--loss))]'
                    }`}>
                      {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-background border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Win Rate</span>
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-2xl font-bold font-mono mt-1">
                      {result.winRate.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-background border-border">
                  <CardContent className="p-4">
                    <span className="text-sm text-muted-foreground">Total Trades</span>
                    <div className="text-xl font-bold font-mono mt-1">
                      {result.totalTrades}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-background border-border">
                  <CardContent className="p-4">
                    <span className="text-sm text-muted-foreground">Max Drawdown</span>
                    <div className="text-xl font-bold font-mono mt-1 text-[hsl(var(--loss))]">
                      -{result.maxDrawdown.toFixed(2)}%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-background border-border">
                  <CardContent className="p-4">
                    <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
                    <div className="text-xl font-bold font-mono mt-1">
                      {result.sharpeRatio.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-background border-border">
                  <CardContent className="p-4">
                    <span className="text-sm text-muted-foreground">Profit Factor</span>
                    <div className={`text-xl font-bold font-mono mt-1 ${
                      result.profitFactor >= 1 ? 'text-[hsl(var(--profit))]' : 'text-[hsl(var(--loss))]'
                    }`}>
                      {result.profitFactor.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {meta && (
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-background border-border">
                    <CardContent className="p-4">
                      <span className="text-sm text-muted-foreground">Ending Equity</span>
                      <div className="text-xl font-bold font-mono mt-1">
                        ${result.endingEquity.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-background border-border">
                    <CardContent className="p-4">
                      <span className="text-sm text-muted-foreground">Replay Data</span>
                      <div className="text-sm font-mono mt-1">
                        {meta.candles} candles @ {meta.candleTimeframe}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Warmup: {meta.warmup}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="text-xs text-muted-foreground text-center pt-2">
                Uses stored market candles only. Synthetic candle generation is excluded from this flow.
              </div>
            </motion.div>
          )}
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
