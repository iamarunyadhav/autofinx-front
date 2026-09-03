import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Customized,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import type { FutureSignal, FutureTradeCandle, FutureTradeDynamicPoint, FutureTradeSettings } from "@/hooks/useFutureTradeBot";

type Props = {
  candles: FutureTradeCandle[];
  runtimePoints: FutureTradeDynamicPoint[];
  settings: FutureTradeSettings;
  symbol?: string | null;
  timeframe: string;
  bestSignal?: FutureSignal | null;
  levels?: Record<string, number | null>;
  overlayHints?: string[];
  chartDebug?: {
    latestTickPrice?: number | null;
    chartUpdatedAt?: string | null;
    lastCandleClose?: number | null;
    isFormingCandle?: boolean;
  };
};

type EnrichedCandle = FutureTradeCandle & {
  index: number;
  timeLabel: string;
  vwap: number;
  emaFast: number;
  emaSlow: number;
  adx: number;
  atr: number;
  orHigh: number | null;
  orLow: number | null;
  delta: number;
  absDelta: number;
  choppy: boolean;
};

type ZoneBand = {
  id: string;
  kind: "supply" | "demand" | "density";
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  label: string;
};

type MarkerPoint = {
  index: number;
  price: number;
  signal: string;
  confidence?: number | null;
};

type BacktestSummary = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPercent: number;
  bestTrade: number;
  worstTrade: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function timeframeMinutes(timeframe: string) {
  const normalized = timeframe.trim().toLowerCase();
  const match = normalized.match(/^(\d+)([mhd])$/);
  if (!match) return 5;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "m") return amount;
  if (unit === "h") return amount * 60;
  return amount * 1440;
}

function ema(values: number[], length: number) {
  if (!values.length) return [];
  const multiplier = 2 / (length + 1);
  const output: number[] = [];
  let prev = values[0];
  output.push(prev);
  for (let i = 1; i < values.length; i += 1) {
    prev = ((values[i] - prev) * multiplier) + prev;
    output.push(prev);
  }
  return output;
}

function rma(values: number[], length: number) {
  if (!values.length) return [];
  const output: number[] = [];
  let prev = values[0];
  output.push(prev);
  for (let i = 1; i < values.length; i += 1) {
    prev = ((prev * (length - 1)) + values[i]) / length;
    output.push(prev);
  }
  return output;
}

function adxSeries(candles: FutureTradeCandle[], length: number) {
  if (!candles.length) return [];
  const plusDm: number[] = [0];
  const minusDm: number[] = [0];
  const tr: number[] = [Math.max(candles[0].high - candles[0].low, 0)];

  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const prev = candles[i - 1];
    const upMove = current.high - prev.high;
    const downMove = prev.low - current.low;
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close),
    ));
  }

  const smTr = rma(tr, length);
  const smPlus = rma(plusDm, length);
  const smMinus = rma(minusDm, length);
  const dx: number[] = smTr.map((value, index) => {
    const plusDi = value !== 0 ? (100 * smPlus[index]) / value : 0;
    const minusDi = value !== 0 ? (100 * smMinus[index]) / value : 0;
    return plusDi + minusDi !== 0 ? (100 * Math.abs(plusDi - minusDi)) / (plusDi + minusDi) : 0;
  });
  return rma(dx, length);
}

function atrSeries(candles: FutureTradeCandle[], length: number) {
  if (!candles.length) return [];
  const values: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const prev = candles[i - 1];
    values.push(Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close),
    ));
  }
  return rma(values, length);
}

function percentile(values: number[], pct: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(clamp((pct / 100) * (sorted.length - 1), 0, sorted.length - 1));
  return sorted[index] ?? 0;
}

function buildChartData(candles: FutureTradeCandle[], timeframe: string) {
  const tfMin = timeframeMinutes(timeframe);
  const prices = candles.map((row) => row.close);
  const emaFast = ema(prices, 34);
  const emaSlow = ema(prices, 89);
  const adx = adxSeries(candles, 14);
  const atr = atrSeries(candles, 14);
  const orBars = Math.max(1, Math.ceil((3 * tfMin) / Math.max(tfMin, 1)));

  let cumPv = 0;
  let cumV = 0;
  let orHigh = Number.NEGATIVE_INFINITY;
  let orLow = Number.POSITIVE_INFINITY;

  const data: EnrichedCandle[] = candles.map((candle, index) => {
    cumPv += ((candle.high + candle.low + candle.close) / 3) * Math.max(candle.volume, 0);
    cumV += Math.max(candle.volume, 0);
    if (index < orBars) {
      orHigh = Math.max(orHigh, candle.high);
      orLow = Math.min(orLow, candle.low);
    }
    const range = Math.max(candle.high - candle.low, Number.EPSILON);
    const delta = candle.volume * ((candle.close - candle.open) / range);
    const absDelta = Math.abs(delta);
    const choppy = ((candle.high - candle.low) / Math.max(candle.close, 1)) * 100 > 7.5 && Math.abs(((candle.close - candle.open) / Math.max(candle.open, 1)) * 100) < 0.35;

    return {
      ...candle,
      index,
      timeLabel: new Date(candle.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      vwap: cumV > 0 ? cumPv / cumV : candle.close,
      emaFast: emaFast[index] ?? candle.close,
      emaSlow: emaSlow[index] ?? candle.close,
      adx: adx[index] ?? 0,
      atr: atr[index] ?? Math.abs(candle.high - candle.low),
      orHigh: index >= orBars - 1 ? orHigh : null,
      orLow: index >= orBars - 1 ? orLow : null,
      delta,
      absDelta,
      choppy,
    };
  });

  return { data, orBars };
}

function findZones(data: EnrichedCandle[]) {
  if (!data.length) return [] as ZoneBand[];
  const latestAtr = data[data.length - 1]?.atr || 0;
  const depth = latestAtr * 0.6;
  const bands: ZoneBand[] = [];

  const buildPivotBand = (left: number, right: number, tag: string) => {
    let supplyIndex = -1;
    let demandIndex = -1;
    for (let i = data.length - right - 1; i >= left; i -= 1) {
      const slice = data.slice(i - left, i + right + 1);
      const current = data[i];
      if (supplyIndex === -1 && slice.every((row) => current.high >= row.high)) {
        supplyIndex = i;
      }
      if (demandIndex === -1 && slice.every((row) => current.low <= row.low)) {
        demandIndex = i;
      }
      if (supplyIndex !== -1 && demandIndex !== -1) break;
    }

    if (supplyIndex !== -1) {
      const high = data[supplyIndex].high;
      bands.push({
        id: `supply-${tag}`,
        kind: "supply",
        x1: supplyIndex,
        x2: data.length - 1,
        y1: high,
        y2: high - depth,
        label: `Supply ${tag}`,
      });
    }

    if (demandIndex !== -1) {
      const low = data[demandIndex].low;
      bands.push({
        id: `demand-${tag}`,
        kind: "demand",
        x1: demandIndex,
        x2: data.length - 1,
        y1: low + depth,
        y2: low,
        label: `Demand ${tag}`,
      });
    }
  };

  buildPivotBand(10, 10, "A");
  buildPivotBand(5, 5, "B");

  return bands;
}

function findDensityBands(data: EnrichedCandle[]) {
  if (!data.length) return [] as ZoneBand[];
  const latestAtr = data[data.length - 1]?.atr || 0;
  const threshold = percentile(data.map((row) => row.absDelta), 92);
  const bands: ZoneBand[] = [];
  const usedMid: number[] = [];

  data.forEach((row) => {
    if (row.absDelta < threshold || latestAtr <= 0) return;
    const mid = row.close;
    if (usedMid.some((value) => Math.abs(value - mid) <= latestAtr * 0.3)) return;
    usedMid.push(mid);
    bands.push({
      id: `density-${row.index}`,
      kind: "density",
      x1: row.index,
      x2: Math.min(data.length - 1, row.index + 24),
      y1: mid + (latestAtr * 0.45),
      y2: mid - (latestAtr * 0.45),
      label: "Density",
    });
  });

  return bands.slice(-6);
}

function buildBubblePoints(data: EnrichedCandle[]) {
  const threshold = percentile(data.map((row) => row.absDelta), 85);
  return data
    .filter((row) => row.absDelta >= Math.max(threshold, 1))
    .map((row) => ({
      index: row.index,
      price: row.delta >= 0 ? row.low : row.high,
      fill: row.delta >= 0 ? "rgba(74, 222, 128, 0.65)" : "rgba(248, 113, 113, 0.65)",
      size: clamp(6 + ((row.absDelta / Math.max(threshold, 1)) * 4), 6, 16),
    }));
}

function buildRuntimeMarkers(runtimePoints: FutureTradeDynamicPoint[], data: EnrichedCandle[]): MarkerPoint[] {
  const byLabel = new Map<string, EnrichedCandle>();
  data.forEach((row) => byLabel.set(row.timeLabel, row));

  return runtimePoints
    .filter((row) => row.signal && row.signal !== "WAIT")
    .slice(-20)
    .map((row) => {
      const time = row.time?.slice(0, 5);
      const candle = byLabel.get(time || "");
      if (!candle) return null;
      const marker: MarkerPoint = {
        index: candle.index,
        price: row.signal === "BUY" ? candle.low : candle.high,
        signal: row.signal,
        confidence: row.confidence,
      };
      return marker;
    })
    .filter((row): row is MarkerPoint => row !== null);
}

function runBacktest(data: EnrichedCandle[], settings: FutureTradeSettings): BacktestSummary {
  let position: { side: "BUY" | "SELL"; entry: number } | null = null;
  const trades: number[] = [];
  const tp = (settings.takeProfitPercent || 0) / 100;
  const sl = (settings.stopLossPercent || 0) / 100;

  for (let i = 1; i < data.length; i += 1) {
    const row = data[i];
    const longSignal = row.close > row.vwap && row.emaFast > row.emaSlow && row.adx >= 18 && !row.choppy && row.orHigh != null && row.close > row.orHigh;
    const shortSignal = row.close < row.vwap && row.emaFast < row.emaSlow && row.adx >= 18 && !row.choppy && row.orLow != null && row.close < row.orLow;

    if (!position) {
      if (longSignal) position = { side: "BUY", entry: row.close };
      else if (shortSignal) position = { side: "SELL", entry: row.close };
      continue;
    }

    const pnl = position.side === "BUY"
      ? ((row.close - position.entry) / position.entry)
      : ((position.entry - row.close) / position.entry);
    const hitTp = pnl >= tp;
    const hitSl = pnl <= -sl;
    const reverse = (position.side === "BUY" && shortSignal) || (position.side === "SELL" && longSignal);

    if (hitTp || hitSl || reverse) {
      trades.push(pnl * 100);
      position = null;
      if (reverse) {
        position = longSignal ? { side: "BUY", entry: row.close } : shortSignal ? { side: "SELL", entry: row.close } : null;
      }
    }
  }

  const wins = trades.filter((value) => value > 0).length;
  const losses = trades.filter((value) => value <= 0).length;
  return {
    trades: trades.length,
    wins,
    losses,
    winRate: trades.length ? (wins / trades.length) * 100 : 0,
    netPercent: trades.reduce((sum, value) => sum + value, 0),
    bestTrade: trades.length ? Math.max(...trades) : 0,
    worstTrade: trades.length ? Math.min(...trades) : 0,
  };
}

function zoneFill(kind: ZoneBand["kind"]) {
  if (kind === "supply") return "rgba(248, 113, 113, 0.12)";
  if (kind === "demand") return "rgba(74, 222, 128, 0.12)";
  return "rgba(148, 163, 184, 0.10)";
}

function zoneStroke(kind: ZoneBand["kind"]) {
  if (kind === "supply") return "rgba(248, 113, 113, 0.32)";
  if (kind === "demand") return "rgba(74, 222, 128, 0.32)";
  return "rgba(148, 163, 184, 0.24)";
}

function CandleRenderer(props: any) {
  const { points, xAxisMap, yAxisMap, offset } = props;
  const xAxis = xAxisMap?.[0];
  const yAxis = yAxisMap?.[0];
  if (!points?.length || !xAxis || !yAxis) return null;

  const bandwidth = Math.max(4, (offset?.width ?? 0) / Math.max(points.length, 1) * 0.55);

  return (
    <g>
      {points.map((entry: EnrichedCandle) => {
        const x = xAxis.scale(entry.index);
        const openY = yAxis.scale(entry.open);
        const closeY = yAxis.scale(entry.close);
        const highY = yAxis.scale(entry.high);
        const lowY = yAxis.scale(entry.low);
        const bullish = entry.close >= entry.open;
        const fill = bullish ? "#22c55e" : "#ef4444";
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(2, Math.abs(openY - closeY));

        return (
          <g key={entry.index}>
            <line x1={x} x2={x} y1={highY} y2={lowY} stroke={fill} strokeWidth={1.2} />
            <rect
              x={x - (bandwidth / 2)}
              y={bodyTop}
              width={bandwidth}
              height={bodyHeight}
              fill={fill}
              fillOpacity={0.8}
              rx={1}
            />
          </g>
        );
      })}
    </g>
  );
}

function BubbleShape(props: any) {
  const { cx, cy, payload } = props;
  return <circle cx={cx} cy={cy} r={payload.size} fill={payload.fill} stroke="none" />;
}

function SignalShape(props: any) {
  const { cx, cy, payload } = props;
  const isBuy = payload.signal === "BUY";
  const fill = isBuy ? "#22c55e" : "#ef4444";
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill={fill} fillOpacity={0.95} />
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize={9} fill="#020617">
        {isBuy ? "B" : "S"}
      </text>
    </g>
  );
}

function ChartTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as EnrichedCandle | undefined;
  if (!row) return null;

  return (
    <div className="rounded-md border bg-background/95 p-3 text-xs shadow-sm">
      <div className="mb-2 font-medium">{row.timeLabel}</div>
      <div>O {row.open.toFixed(4)}</div>
      <div>H {row.high.toFixed(4)}</div>
      <div>L {row.low.toFixed(4)}</div>
      <div>C {row.close.toFixed(4)}</div>
      <div>VWAP {row.vwap.toFixed(4)}</div>
      <div>EMA34 {row.emaFast.toFixed(4)}</div>
      <div>EMA89 {row.emaSlow.toFixed(4)}</div>
      <div>ADX {row.adx.toFixed(2)}</div>
      <div>Delta {row.delta.toFixed(2)}</div>
    </div>
  );
}

export function FutureTradeProChart({ candles, runtimePoints, settings, symbol, timeframe, bestSignal, levels, overlayHints = [], chartDebug }: Props) {
  const chartVersion = `${chartDebug?.chartUpdatedAt ?? ""}|${chartDebug?.latestTickPrice ?? ""}|${chartDebug?.lastCandleClose ?? ""}|${chartDebug?.isFormingCandle ? "forming" : "closed"}`;
  const prepared = useMemo(() => buildChartData(candles, timeframe), [candles, timeframe, chartVersion]);
  const zones = useMemo(() => findZones(prepared.data), [prepared.data]);
  const densities = useMemo(() => findDensityBands(prepared.data), [prepared.data]);
  const bubbles = useMemo(() => buildBubblePoints(prepared.data), [prepared.data]);
  const markers = useMemo(() => buildRuntimeMarkers(runtimePoints, prepared.data), [runtimePoints, prepared.data]);
  const backtest = useMemo(() => runBacktest(prepared.data, settings), [prepared.data, settings]);
  const latest = prepared.data[prepared.data.length - 1];

  if (!prepared.data.length) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Live candle feed not ready yet.</div>;
  }

  const trendUp = (latest?.emaFast ?? 0) > (latest?.emaSlow ?? 0);
  const adxReady = (latest?.adx ?? 0) >= 18;
  const zonesAndDensities = [...zones, ...densities];

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="default">Prime v6.1.7</Badge>
        <Badge variant="outline">{symbol || "Symbol"} - {timeframe}</Badge>
        <Badge variant={trendUp ? "default" : "destructive"}>{trendUp ? "Chart EMA34/89 Up" : "Chart EMA34/89 Down"}</Badge>
        <Badge variant={adxReady ? "default" : "secondary"}>ADX {latest?.adx.toFixed(1)}{adxReady ? " strong" : " weak"}</Badge>
        <Badge variant="secondary">VWAP {latest?.vwap.toFixed(2)}</Badge>
        <Badge variant={chartDebug?.isFormingCandle ? "default" : "secondary"}>
          Forming {chartDebug?.isFormingCandle ? "Yes" : "No"}
        </Badge>
        <Badge variant="outline">Tick {chartDebug?.latestTickPrice != null ? chartDebug.latestTickPrice.toFixed(4) : "-"}</Badge>
        <Badge variant="outline">Close {chartDebug?.lastCandleClose != null ? chartDebug.lastCandleClose.toFixed(4) : latest?.close.toFixed(4)}</Badge>
        <Badge variant="secondary">OR {latest?.orHigh?.toFixed(2) ?? "-"} / {latest?.orLow?.toFixed(2) ?? "-"}</Badge>
        <Badge variant={bestSignal?.signal === "BUY" ? "default" : bestSignal?.signal === "SELL" ? "destructive" : "secondary"}>
          {bestSignal?.signal || "WAIT"} {bestSignal?.confidence != null ? `${(bestSignal.confidence * 100).toFixed(1)}%` : ""}
        </Badge>
        {overlayHints.slice(0, 4).map((item) => (
          <Badge key={item} variant="outline">Imported {item}</Badge>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart key={chartVersion} data={prepared.data} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
            <XAxis
              dataKey="index"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value) => prepared.data[value]?.timeLabel ?? ""}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={72} />
            <Tooltip content={<ChartTooltipContent />} />

            {zonesAndDensities.map((zone) => (
              <ReferenceArea
                key={zone.id}
                x1={zone.x1}
                x2={zone.x2}
                y1={zone.y1}
                y2={zone.y2}
                fill={zoneFill(zone.kind)}
                stroke={zoneStroke(zone.kind)}
                strokeOpacity={1}
                ifOverflow="extendDomain"
              />
            ))}

            <Customized key={`candles-${chartVersion}`} component={<CandleRenderer points={prepared.data} />} />
            <Line dataKey="vwap" stroke="#facc15" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="emaFast" stroke="#14b8a6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line dataKey="emaSlow" stroke="#f97316" strokeWidth={1.5} dot={false} isAnimationActive={false} />

            {latest?.orHigh != null ? <ReferenceLine y={latest.orHigh} stroke="#fb923c" strokeDasharray="5 5" label="OR High" /> : null}
            {latest?.orLow != null ? <ReferenceLine y={latest.orLow} stroke="#fb923c" strokeDasharray="5 5" label="OR Low" /> : null}
            {levels?.entry ? <ReferenceLine y={levels.entry} stroke="#38bdf8" label="Entry" /> : null}
            {levels?.stopLoss ? <ReferenceLine y={levels.stopLoss} stroke="#ef4444" label="Stop" /> : null}
            {levels?.takeProfit ? <ReferenceLine y={levels.takeProfit} stroke="#22c55e" label="Target" /> : null}
            {levels?.trailing ? <ReferenceLine y={levels.trailing} stroke="#a78bfa" label="Trail" /> : null}

            <Scatter data={bubbles} dataKey="price" shape={<BubbleShape />} isAnimationActive={false} />
            <Scatter data={markers} dataKey="price" shape={<SignalShape />} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-2 text-xs md:grid-cols-4">
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="text-muted-foreground">Backtest trades</div>
          <div className="mt-1 text-lg font-semibold">{backtest.trades}</div>
        </div>
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="text-muted-foreground">Win rate</div>
          <div className="mt-1 text-lg font-semibold">{backtest.winRate.toFixed(1)}%</div>
        </div>
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="text-muted-foreground">Net result</div>
          <div className={`mt-1 text-lg font-semibold ${backtest.netPercent >= 0 ? "text-emerald-500" : "text-red-500"}`}>{backtest.netPercent.toFixed(2)}%</div>
        </div>
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="text-muted-foreground">Best / Worst</div>
          <div className="mt-1 text-lg font-semibold">{backtest.bestTrade.toFixed(2)}% / {backtest.worstTrade.toFixed(2)}%</div>
        </div>
      </div>

      <div className="grid gap-2 text-[11px] text-muted-foreground md:grid-cols-3">
        <div className="rounded-md border bg-muted/10 p-3">Trend brain: Session VWAP + EMA34/EMA89 + ADX 14/18 filter.</div>
        <div className="rounded-md border bg-muted/10 p-3">Entry layer: Opening Range breakout, delta bubbles, supply/demand and density context.</div>
        <div className="rounded-md border bg-muted/10 p-3">Risk layer: existing bot TP / SL / trailing + runtime guards + sample backtest.</div>
      </div>
    </div>
  );
}
