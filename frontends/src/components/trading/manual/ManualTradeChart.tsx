import { useEffect, useMemo, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { computeOverlays, type Bar, type OverlayToggles } from "@/lib/chartStructure";

export interface ChartLine {
  price: number | null | undefined;
  title: string;
  color: string;
  dashed?: boolean;
  width?: 1 | 2;
}

interface Props {
  candles: Bar[];
  toggles: OverlayToggles;
  /** Price lines with right-axis labels: entry (blue), SL (red), TP (green), mark, estimated liquidation. */
  lines: ChartLine[];
  height?: number;
}

function normalize(candles: Bar[]): Bar[] {
  const byTime = new Map<number, Bar>();
  for (const c of candles) {
    if (c.time > 0 && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0) byTime.set(c.time, c);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/**
 * Candlestick chart for Manual SL/TP built on the repo's existing chart library (lightweight-charts).
 * Overlays (EMA, swings, zones, trendlines, BOS/CHoCH) are VISUAL AIDS computed by the pure functions in
 * lib/chartStructure.ts; this component never places or changes a trade. The chart timeframe is purely a display
 * choice made by the parent and is not part of any order.
 */
export function ManualTradeChart({ candles, toggles, lines, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const overlaySeriesRef = useRef<ISeriesApi<"Line" | "Baseline">[]>([]);
  const prevBarsRef = useRef<Bar[]>([]);

  const bars = useMemo(() => normalize(candles), [candles]);
  const overlays = useMemo(() => computeOverlays(bars, toggles), [bars, toggles]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#94a3b8", fontSize: 11 },
      grid: { vertLines: { color: "rgba(148,163,184,0.08)" }, horzLines: { color: "rgba(148,163,184,0.08)" } },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: { borderColor: "rgba(148,163,184,0.15)", timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 8 },
      crosshair: { mode: CrosshairMode.Normal },
    });
    const series = chart.addCandlestickSeries({
      upColor: "#10b981", downColor: "#f43f5e", borderUpColor: "#10b981", borderDownColor: "#f43f5e", wickUpColor: "#10b981", wickDownColor: "#f43f5e",
    });
    chartRef.current = chart;
    candleRef.current = series;
    const observer = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      priceLinesRef.current = [];
      overlaySeriesRef.current = [];
      prevBarsRef.current = [];
    };
  }, [height]);

  // Candle data: patch the last bar on a live tick, otherwise replace.
  useEffect(() => {
    const series = candleRef.current;
    if (!series) return;
    const prev = prevBarsRef.current;
    const toPoint = (b: Bar) => ({ time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close });
    if (bars.length === 0) {
      series.setData([]);
    } else if (prev.length > 0 && (bars.length === prev.length || bars.length === prev.length + 1) && bars[0].time === prev[0].time) {
      series.update(toPoint(bars[bars.length - 1]));
    } else {
      series.setData(bars.map(toPoint));
      chartRef.current?.timeScale().fitContent();
    }
    prevBarsRef.current = bars;
  }, [bars]);

  // Overlays: rebuilt whenever bars/toggles change (cheap: a handful of series).
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleRef.current;
    if (!chart || !candleSeries) return;
    for (const s of overlaySeriesRef.current) chart.removeSeries(s);
    overlaySeriesRef.current = [];
    const timeAt = (i: number) => bars[Math.max(0, Math.min(bars.length - 1, i))].time as UTCTimestamp;
    const plain = { lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false } as const;

    const addEma = (values: (number | null)[] | null, color: string) => {
      if (!values) return;
      const line = chart.addLineSeries({ ...plain, color, lineWidth: 1 });
      line.setData(values.flatMap((v, i) => (v == null ? [] : [{ time: timeAt(i), value: v }])));
      overlaySeriesRef.current.push(line);
    };
    addEma(overlays.ema50, "#38bdf8");
    addEma(overlays.ema200, "#f59e0b");

    const last = bars.length - 1;
    const lastClose = last >= 0 ? bars[last].close : 0;
    [...overlays.zones]
      .sort((a, b) => Math.abs((a.lo + a.hi) / 2 - lastClose) - Math.abs((b.lo + b.hi) / 2 - lastClose))
      .slice(0, 8)
      .forEach((z) => {
        const res = z.kind === "RESISTANCE";
        const band = chart.addBaselineSeries({
          ...plain,
          baseValue: { type: "price", price: z.lo },
          topLineColor: "rgba(0,0,0,0)",
          topFillColor1: res ? "rgba(244,63,94,0.22)" : "rgba(16,185,129,0.22)",
          topFillColor2: res ? "rgba(244,63,94,0.10)" : "rgba(16,185,129,0.10)",
          bottomLineColor: "rgba(0,0,0,0)",
          bottomFillColor1: "rgba(0,0,0,0)",
          bottomFillColor2: "rgba(0,0,0,0)",
        });
        const t0 = timeAt(z.swingIndex);
        const t1 = timeAt(last);
        band.setData(t0 === t1 ? [{ time: t0, value: z.hi }] : [{ time: t0, value: z.hi }, { time: t1, value: z.hi }]);
        overlaySeriesRef.current.push(band);
      });

    for (const seg of overlays.lines) {
      const t0 = timeAt(seg.startIndex);
      const t1 = timeAt(seg.endIndex);
      if (t0 >= t1) continue;
      const line = chart.addLineSeries({
        ...plain,
        color: seg.kind === "support" ? "#34d399" : "#fb7185",
        lineWidth: seg.active ? 2 : 1,
        lineStyle: seg.active ? LineStyle.Solid : LineStyle.Dashed,
      });
      line.setData([{ time: t0, value: seg.startPrice }, { time: t1, value: seg.endPrice }]);
      overlaySeriesRef.current.push(line);
    }

    const markers: SeriesMarker<Time>[] = [];
    if (toggles.swings) {
      for (const s of overlays.swings) {
        markers.push({
          time: timeAt(s.occ),
          position: s.kind === "high" ? "aboveBar" : "belowBar",
          shape: "circle",
          color: s.kind === "high" ? "#fb7185" : "#34d399",
          text: s.label ?? "",
        });
      }
    }
    if (toggles.trendlines) {
      for (const seg of overlays.lines) {
        for (const a of seg.anchors) {
          markers.push({ time: timeAt(a.index), position: seg.kind === "support" ? "belowBar" : "aboveBar", shape: "square", color: seg.kind === "support" ? "#34d399" : "#fb7185", text: "" });
        }
      }
    }
    if (overlays.structure) {
      for (const e of overlays.structure.events) {
        if (e.type === "CHOCH" && !e.confirmed) continue;
        markers.push({
          time: timeAt(e.index),
          position: e.dir > 0 ? "belowBar" : "aboveBar",
          shape: e.dir > 0 ? "arrowUp" : "arrowDown",
          color: e.type === "BOS" ? "#60a5fa" : "#fbbf24",
          text: e.type === "BOS" ? "BOS" : "CHoCH",
        });
      }
    }
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    candleSeries.setMarkers(markers);
  }, [overlays, bars, toggles.swings, toggles.trendlines]);

  // Position / plan price lines with right-axis labels.
  useEffect(() => {
    const series = candleRef.current;
    if (!series) return;
    for (const l of priceLinesRef.current) series.removePriceLine(l);
    priceLinesRef.current = [];
    for (const l of lines) {
      if (l.price == null || !(l.price > 0)) continue;
      priceLinesRef.current.push(
        series.createPriceLine({
          price: l.price,
          color: l.color,
          lineWidth: l.width ?? 2,
          lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
          axisLabelVisible: true,
          title: l.title,
        }),
      );
    }
  }, [lines]);

  return <div ref={containerRef} className="w-full" style={{ height }} data-testid="manual-trade-chart" />;
}
