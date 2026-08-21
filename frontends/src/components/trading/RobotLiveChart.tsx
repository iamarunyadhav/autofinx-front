import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { CandleData } from "@/hooks/useRobotCandleFeed";

export interface ChartMarker {
  time: number; // unix seconds
  side: "BUY" | "SELL";
  text?: string;
}

interface RobotLiveChartProps {
  candles: CandleData[];
  entryPrice?: number | null;
  stopPrice?: number | null;
  takeProfitPrice?: number | null;
  side?: "BUY" | "SELL" | null;
  markers?: ChartMarker[];
  /** Live unrealized PnL overlay shown on top of the chart. */
  pnl?: { side: "BUY" | "SELL"; pct: number; value: number } | null;
  height?: number;
  /**
   * Additional dotted price lines beyond the entry/stop/take-profit set above —
   * e.g. a ratio bot's anchor price or pending buy/sell trigger level while flat.
   * Keyed so callers can add/remove/update lines independently of each other.
   */
  extraLines?: Array<{ key: string; price: number | null | undefined; color: string; title: string }>;
}

function normalizeBars(candles: CandleData[]): CandlestickData<Time>[] {
  const byTime = new Map<number, CandlestickData<Time>>();

  for (const candle of candles) {
    const time = Number(candle.time);
    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);

    if (![time, open, high, low, close].every(Number.isFinite) || time <= 0 || open <= 0 || close <= 0) {
      continue;
    }

    const normalizedHigh = Math.max(open, high, low, close);
    const normalizedLow = Math.min(open, high, low, close);
    if (normalizedLow <= 0) continue;

    byTime.set(time, {
      time: time as UTCTimestamp,
      open,
      high: normalizedHigh,
      low: normalizedLow,
      close,
    });
  }

  const sorted = [...byTime.values()].sort((a, b) => Number(a.time) - Number(b.time));
  if (sorted.length < 8) return sorted;

  const closes = sorted.map((bar) => bar.close).sort((a, b) => a - b);
  const median = closes[Math.floor(closes.length / 2)] || 0;
  if (median <= 0) return sorted;

  return sorted.filter((bar) => {
    const rangePct = ((bar.high - bar.low) / median) * 100;
    const closeDeviationPct = (Math.abs(bar.close - median) / median) * 100;

    return rangePct <= 12 && closeDeviationPct <= 35;
  });
}

/**
 * Dark-theme candlestick chart for the Robot Trade page. Renders the live feed
 * plus entry / trailing-stop / take-profit price lines that track the position.
 */
export function RobotLiveChart({
  candles,
  entryPrice,
  stopPrice,
  takeProfitPrice,
  side,
  markers,
  pnl,
  height = 360,
  extraLines,
}: RobotLiveChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const linesRef = useRef<Record<string, IPriceLine | null>>({ entry: null, stop: null, tp: null });
  const extraLinesRef = useRef<Record<string, IPriceLine>>({});
  const lastViewportKeyRef = useRef<string | null>(null);

  // Create the chart once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: {
        borderColor: "rgba(148,163,184,0.15)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 8,
        fixLeftEdge: true,
        rightBarStaysOnScroll: true,
        shiftVisibleRangeOnNewBar: true,
      },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => chart.applyOptions({ width: container.clientWidth });
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      lastViewportKeyRef.current = null;
      linesRef.current = { entry: null, stop: null, tp: null };
      extraLinesRef.current = {};
    };
  }, [height]);

  // Push candle data.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (candles.length === 0) {
      series.setData([]);
      lastViewportKeyRef.current = null;
      return;
    }
    const bars = normalizeBars(candles);
    series.setData(bars);
    const firstTime = Number(bars.at(0)?.time ?? 0);
    const lastTime = Number(bars.at(-1)?.time ?? 0);
    const viewportKey = `${firstTime}:${lastTime}:${bars.length}`;
    const timeScale = chartRef.current?.timeScale();

    if (!timeScale || bars.length === 0) return;

    if (lastViewportKeyRef.current === null) {
      timeScale.fitContent();
    }

    lastViewportKeyRef.current = viewportKey;
    timeScale.scrollToPosition(8, false);
  }, [candles]);

  // Sync the entry / stop / take-profit price lines.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const sync = (
      key: "entry" | "stop" | "tp",
      price: number | null | undefined,
      color: string,
      title: string,
    ) => {
      const existing = linesRef.current[key];
      if (price && price > 0) {
        const opts = {
          price,
          color,
          lineWidth: 2 as const,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title,
        };
        if (existing) {
          existing.applyOptions(opts);
        } else {
          linesRef.current[key] = series.createPriceLine(opts);
        }
      } else if (existing) {
        series.removePriceLine(existing);
        linesRef.current[key] = null;
      }
    };

    sync("entry", entryPrice, "#3b82f6", side ? `Entry (${side})` : "Entry");
    sync("stop", stopPrice, "#f43f5e", "Stop");
    sync("tp", takeProfitPrice, "#22c55e", "Take profit");
  }, [entryPrice, stopPrice, takeProfitPrice, side]);

  // Sync any extra (e.g. ratio-bot anchor/trigger) price lines, keyed independently.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const next = extraLines ?? [];
    const nextKeys = new Set(next.map((line) => line.key));
    for (const key of Object.keys(extraLinesRef.current)) {
      if (!nextKeys.has(key)) {
        series.removePriceLine(extraLinesRef.current[key]);
        delete extraLinesRef.current[key];
      }
    }

    for (const line of next) {
      const existing = extraLinesRef.current[line.key];
      if (line.price && line.price > 0) {
        const opts = {
          price: line.price,
          color: line.color,
          lineWidth: 1 as const,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: line.title,
        };
        if (existing) {
          existing.applyOptions(opts);
        } else {
          extraLinesRef.current[line.key] = series.createPriceLine(opts);
        }
      } else if (existing) {
        series.removePriceLine(existing);
        delete extraLinesRef.current[line.key];
      }
    }
  }, [extraLines]);

  // Buy / sell entry markers.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const mapped: SeriesMarker<Time>[] = (markers ?? []).map((m) => ({
      time: m.time as UTCTimestamp,
      position: m.side === "BUY" ? "belowBar" : "aboveBar",
      color: m.side === "BUY" ? "#10b981" : "#f43f5e",
      shape: m.side === "BUY" ? "arrowUp" : "arrowDown",
      text: m.text ?? m.side,
    }));
    series.setMarkers(mapped);
  }, [markers]);

  const pnlUp = (pnl?.pct ?? 0) >= 0;

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      {pnl && (
        <div
          className={`pointer-events-none absolute left-3 top-3 rounded-lg px-3 py-1.5 text-sm font-semibold backdrop-blur ${
            pnlUp ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
          }`}
        >
          {pnl.side === "BUY" ? "LONG" : "SHORT"} {pnlUp ? "+" : ""}
          {pnl.pct.toFixed(2)}% ({pnlUp ? "+" : ""}
          {pnl.value.toFixed(2)})
        </div>
      )}
    </div>
  );
}
