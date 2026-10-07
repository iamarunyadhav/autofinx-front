import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { LabChart as LabChartData } from "@/lib/strategyLab";

const UP = "#10b981";
const DOWN = "#f43f5e";
const FLAT = "#94a3b8";

/** Candle open times in seconds, ascending and de-duplicated (lightweight-charts rejects anything else). */
function toBars(candles: LabChartData["candles"]): CandlestickData<UTCTimestamp>[] {
  const seen = new Map<number, CandlestickData<UTCTimestamp>>();
  for (const c of candles ?? []) {
    if (!Array.isArray(c) || c.length < 5) continue;
    const [ms, open, high, low, close] = c.map(Number);
    if (![ms, open, high, low, close].every(Number.isFinite)) continue;
    const time = Math.floor(ms / 1000) as UTCTimestamp;
    seen.set(time, { time, open, high, low, close });
  }
  return [...seen.values()].sort((a, b) => a.time - b.time);
}

/** Open time of the bar containing `sec` (markers must sit on an existing bar); null when outside the window. */
function snap(times: number[], sec: number): number | null {
  if (times.length === 0 || sec < times[0]) return null;
  const step = times.length > 1 ? times[times.length - 1] - times[times.length - 2] : 0;
  if (sec > times[times.length - 1] + step) return null;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= sec) lo = mid; else hi = mid - 1;
  }
  return times[lo];
}

interface LabChartProps {
  chart: LabChartData;
  height?: number;
}

/**
 * Quick-test chart: the chart.json candles with entry / exit markers. Same
 * create-once / ResizeObserver / remove() lifecycle and palette as RobotLiveChart.
 */
export function LabChart({ chart, height = 420 }: LabChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [showEntries, setShowEntries] = useState(true);
  const [showExits, setShowExits] = useState(true);

  const bars = useMemo(() => toBars(chart.candles), [chart.candles]);
  const markers = useMemo(() => {
    const times = bars.map((b) => b.time as number);
    const out: SeriesMarker<Time>[] = [];
    for (const t of chart.trades ?? []) {
      if (showEntries) {
        const at = snap(times, Math.floor(Number(t.entry_time) / 1000));
        if (at !== null) {
          const buy = t.side === "BUY";
          out.push({ time: at as UTCTimestamp, position: buy ? "belowBar" : "aboveBar", color: buy ? UP : DOWN, shape: buy ? "arrowUp" : "arrowDown", text: buy ? "B" : "S" });
        }
      }
      if (showExits) {
        const at = snap(times, Math.floor(Number(t.exit_time) / 1000));
        if (at !== null) {
          const net = Number(t.net_pct);
          out.push({ time: at as UTCTimestamp, position: "inBar", color: net > 0 ? UP : net < 0 ? DOWN : FLAT, shape: "circle" });
        }
      }
    }
    return out.sort((a, b) => (a.time as number) - (b.time as number));
  }, [bars, chart.trades, showEntries, showExits]);

  // Create the chart once per data set.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const instance = createChart(container, {
      width: container.clientWidth,
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#94a3b8", fontSize: 11 },
      grid: { vertLines: { color: "rgba(148,163,184,0.08)" }, horzLines: { color: "rgba(148,163,184,0.08)" } },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: { borderColor: "rgba(148,163,184,0.15)", timeVisible: true, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: { mode: CrosshairMode.Normal },
    });
    const series = instance.addCandlestickSeries({
      upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN,
    });
    series.setData(bars);
    instance.timeScale().fitContent();
    chartRef.current = instance;
    seriesRef.current = series;

    const observer = new ResizeObserver(() => instance.applyOptions({ width: container.clientWidth }));
    observer.observe(container);
    return () => {
      observer.disconnect();
      instance.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [bars, height]);

  useEffect(() => {
    seriesRef.current?.setMarkers(markers);
  }, [markers, bars]);

  const tradeCount = chart.trades?.length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-mono font-semibold">{chart.symbol}</span>
          <span className="text-muted-foreground"> · {chart.timeframe} · {bars.length.toLocaleString()} bars · {tradeCount.toLocaleString()} trades</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="sl-chart-entries" checked={showEntries} onCheckedChange={setShowEntries} />
            <Label htmlFor="sl-chart-entries" className="text-xs">Entries</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="sl-chart-exits" checked={showExits} onCheckedChange={setShowExits} />
            <Label htmlFor="sl-chart-exits" className="text-xs">Exits</Label>
          </div>
        </div>
      </div>
      <div ref={containerRef} className="w-full min-w-0" style={{ height }} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        <span><span style={{ color: UP }}>▲</span> BUY entry (below bar)</span>
        <span><span style={{ color: DOWN }}>▼</span> SELL entry (above bar)</span>
        <span><span style={{ color: UP }}>●</span> exit, net &gt; 0</span>
        <span><span style={{ color: DOWN }}>●</span> exit, net &lt; 0</span>
        <span><span style={{ color: FLAT }}>●</span> exit, net = 0</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Development data from the quick-test window (the last bars only). Markers sit on the bar that contains the entry or exit time.
      </p>
    </div>
  );
}
