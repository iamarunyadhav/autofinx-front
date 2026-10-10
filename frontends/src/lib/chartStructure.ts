/**
 * Causal chart-structure overlays for Quick Trade Manual SL/TP. VISUAL AIDS ONLY: nothing in
 * this file places, edits or closes a trade, and no trading code imports it.
 *
 * Ported (read-only, semantics preserved) from the verified causal engine
 * `external-predictive-engine/experiment_f/core/structure.py`:
 *  - A swing (fractal) pivot at bar j with parameter k is OCCURRENCE j and CONFIRMATION j + k: it does
 *    not exist for any decision made before the close of bar j + k. Strict inequality on both sides.
 *  - Labels compare a confirmed swing with the previous confirmed swing of the SAME kind (HH/LH/EH, HL/LL/EL).
 *  - BOS is CLOSE-based (a wick through the level is not a break); a close beyond the level against the
 *    trend is a CHoCH candidate, CONFIRMED after CHOCH_CONFIRM_CLOSES consecutive closes beyond it.
 *  - Zones are born at the swing's CONFIRMATION bar with half-width 0.25 x ATR14 at that bar and are broken
 *    by the first close beyond the far edge.
 * Every output about bar t uses bars <= t only (prefix invariance is unit-tested in
 * tests/chartStructure.test.mjs). EXTENSION POINT: the owner's TradingView "stepped bands" are NOT implemented
 * (formulas unknown). Add them as another pure function returning `LineSegment[]` and register it in
 * `computeOverlays` below; the chart component only renders what `computeOverlays` returns.
 */

export interface Bar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export const SWING_K = 5;
export const ZONE_HALF_ATR = 0.25;
export const CHOCH_CONFIRM_CLOSES = 3;
export const ZONE_MAX_AGE_BARS = 300;

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period < 1 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  const a = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * a + prev * (1 - a);
    out[i] = prev;
  }
  return out;
}

/** Wilder ATR; entry t uses bars <= t only. */
export function atr(bars: Bar[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length <= period) return out;
  const tr: number[] = bars.map((b, i) => (i === 0
    ? b.high - b.low
    : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close))));
  let prev = 0;
  for (let i = 1; i <= period; i++) prev += tr[i];
  prev /= period;
  out[period] = prev;
  for (let i = period + 1; i < bars.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export type SwingLabel = "HH" | "LH" | "EH" | "HL" | "LL" | "EL";

export interface Swing {
  kind: "high" | "low";
  occ: number; // bar index of the extreme
  conf: number; // bar index at whose close it becomes known (occ + k)
  price: number;
  label: SwingLabel | null; // null for the first swing of a kind
}

/** All fractal swings, ordered by confirmation index (highs first on ties). */
export function findSwings(bars: Bar[], k = SWING_K): Swing[] {
  const n = bars.length;
  const found: Swing[] = [];
  for (let j = k; j < n - k; j++) {
    let isHigh = true;
    let isLow = true;
    for (let d = 1; d <= k; d++) {
      if (!(bars[j].high > bars[j - d].high) || !(bars[j].high > bars[j + d].high)) isHigh = false;
      if (!(bars[j].low < bars[j - d].low) || !(bars[j].low < bars[j + d].low)) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) found.push({ kind: "high", occ: j, conf: j + k, price: bars[j].high, label: null });
    if (isLow) found.push({ kind: "low", occ: j, conf: j + k, price: bars[j].low, label: null });
  }
  found.sort((a, b) => a.conf - b.conf || (a.kind === b.kind ? 0 : a.kind === "high" ? -1 : 1));
  for (const kind of ["high", "low"] as const) {
    let prev: Swing | null = null;
    for (const s of found) {
      if (s.kind !== kind) continue;
      if (prev) {
        const d = Math.sign(s.price - prev.price);
        s.label = kind === "high" ? (d > 0 ? "HH" : d < 0 ? "LH" : "EH") : (d > 0 ? "HL" : d < 0 ? "LL" : "EL");
      }
      prev = s;
    }
  }
  return found;
}

export type Trend = "BULLISH" | "BEARISH" | "SIDEWAYS" | "UNCERTAIN";

export interface StructureEvent {
  index: number;
  time: number;
  type: "BOS" | "CHOCH";
  dir: 1 | -1;
  level: number;
  confirmed: boolean; // BOS is always close-confirmed; CHoCH true after CHOCH_CONFIRM_CLOSES closes
}

export interface StructureResult {
  trend: Trend; // as of the LAST bar
  events: StructureEvent[];
}

/** Port of structure.run(): close-based BOS and CHoCH, causal. */
export function runStructure(bars: Bar[], k = SWING_K): StructureResult {
  const swings = findSwings(bars, k);
  const events: StructureEvent[] = [];
  let ptr = 0;
  let H = NaN;
  let L = NaN;
  let hBroken = false;
  let lBroken = false;
  const hLabels: (SwingLabel | null)[] = [];
  const lLabels: (SwingLabel | null)[] = [];
  let chDir = 0;
  let chLevel = NaN;
  let chCount = 0;
  let actDir = 0;
  let actSince = -1;
  let raw: Trend = "UNCERTAIN";
  let trend: Trend = "UNCERTAIN";

  for (let t = 0; t < bars.length; t++) {
    while (ptr < swings.length && swings[ptr].conf <= t) {
      const s = swings[ptr];
      if (s.kind === "high") {
        H = s.price;
        hBroken = false;
        hLabels.push(s.label);
      } else {
        L = s.price;
        lBroken = false;
        lLabels.push(s.label);
      }
      if (actDir !== 0 && s.conf > actSince) actDir = 0;
      ptr += 1;
    }
    const nh = hLabels.length;
    const nl = lLabels.length;
    if (nh >= 2 && nl >= 2) {
      const lh = hLabels[nh - 1];
      const ll = lLabels[nl - 1];
      raw = lh === "HH" && ll === "HL" ? "BULLISH" : lh === "LH" && ll === "LL" ? "BEARISH" : "SIDEWAYS";
    } else {
      raw = "UNCERTAIN";
    }
    const b = bars[t];
    if (!(b.close > 0) || !(b.high > 0) || !(b.low > 0)) {
      chDir = 0;
      chCount = 0;
      trend = raw;
      continue;
    }
    const ct = b.close;
    if (chDir !== 0) {
      if ((chDir > 0 && ct > chLevel) || (chDir < 0 && ct < chLevel)) {
        chCount += 1;
        if (chCount >= CHOCH_CONFIRM_CLOSES) {
          events.push({ index: t, time: b.time, type: "CHOCH", dir: chDir as 1 | -1, level: chLevel, confirmed: true });
          actDir = chDir;
          actSince = t;
          chDir = 0;
          chCount = 0;
        }
      } else {
        chDir = 0;
        chCount = 0;
      }
    }
    if (!Number.isNaN(H) && !hBroken && ct > H) {
      hBroken = true;
      if (raw === "BULLISH") {
        events.push({ index: t, time: b.time, type: "BOS", dir: 1, level: H, confirmed: true });
      } else if (raw === "BEARISH" && chDir === 0) {
        chDir = 1;
        chLevel = H;
        chCount = 1;
        events.push({ index: t, time: b.time, type: "CHOCH", dir: 1, level: H, confirmed: false });
      }
    }
    if (!Number.isNaN(L) && !lBroken && ct < L) {
      lBroken = true;
      if (raw === "BEARISH") {
        events.push({ index: t, time: b.time, type: "BOS", dir: -1, level: L, confirmed: true });
      } else if (raw === "BULLISH" && chDir === 0) {
        chDir = -1;
        chLevel = L;
        chCount = 1;
        events.push({ index: t, time: b.time, type: "CHOCH", dir: -1, level: L, confirmed: false });
      }
    }
    const opposed = (raw === "BULLISH" && actDir < 0) || (raw === "BEARISH" && actDir > 0);
    trend = actDir !== 0 && opposed ? "UNCERTAIN" : raw;
  }
  return { trend, events };
}

export interface Zone {
  kind: "SUPPORT" | "RESISTANCE";
  lo: number;
  hi: number;
  bornIndex: number; // confirmation bar
  swingIndex: number; // occurrence bar
  status: "ACTIVE" | "BROKEN" | "EXPIRED";
  merged: number;
}

/** Zones known at the close of bar `t` (default: last bar), merged when overlapping and same kind. ACTIVE only. */
export function activeZones(bars: Bar[], k = SWING_K, t = bars.length - 1, maxAge = ZONE_MAX_AGE_BARS): Zone[] {
  const swings = findSwings(bars.slice(0, t + 1), k);
  const a = atr(bars.slice(0, t + 1));
  const zones: Zone[] = [];
  for (const s of swings) {
    const born = s.conf;
    const av = a[born];
    if (av == null || !(av > 0)) continue;
    const w = ZONE_HALF_ATR * av;
    const lo = s.price - w;
    const hi = s.price + w;
    let status: Zone["status"] = "ACTIVE";
    const end = Math.min(t, born + maxAge);
    for (let i = born + 1; i <= end; i++) {
      const c = bars[i].close;
      if ((s.kind === "high" && c > hi) || (s.kind === "low" && c < lo)) {
        status = "BROKEN";
        break;
      }
    }
    if (status === "ACTIVE" && t > born + maxAge) status = "EXPIRED";
    if (status !== "ACTIVE") continue;
    zones.push({ kind: s.kind === "high" ? "RESISTANCE" : "SUPPORT", lo, hi, bornIndex: born, swingIndex: s.occ, status, merged: 1 });
  }
  const out: Zone[] = [];
  for (const kind of ["RESISTANCE", "SUPPORT"] as const) {
    const sorted = zones.filter((z) => z.kind === kind).sort((p, q) => p.lo - q.lo);
    let cur: Zone | null = null;
    for (const z of sorted) {
      if (cur && z.lo <= cur.hi) {
        cur.hi = Math.max(cur.hi, z.hi);
        cur.merged += 1;
        cur.bornIndex = Math.min(cur.bornIndex, z.bornIndex);
        cur.swingIndex = Math.min(cur.swingIndex, z.swingIndex);
      } else {
        if (cur) out.push(cur);
        cur = { ...z };
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

export interface LineSegment {
  kind: "support" | "resistance";
  startIndex: number; // first bar at which the line is KNOWN (confirmation of its 2nd anchor)
  endIndex: number; // last bar it is drawn to (break, replacement, or last bar)
  startPrice: number;
  endPrice: number;
  anchors: { index: number; price: number }[]; // the two swing points (drawn as markers)
  active: boolean;
}

/**
 * Causal trendlines: rising SUPPORT through two consecutive confirmed swing lows that make a HIGHER low,
 * falling RESISTANCE through two consecutive confirmed swing highs that make a LOWER high. A line becomes
 * visible only at the confirmation bar of its second anchor, ends when a close breaks it or the next swing of
 * that kind is confirmed (which defines the next line), and is extended to the last bar while it lives.
 * No bar after `t` influences anything drawn at or before `t`.
 */
export function trendlines(bars: Bar[], k = SWING_K): LineSegment[] {
  const swings = findSwings(bars, k);
  const out: LineSegment[] = [];
  const last = bars.length - 1;
  for (const kind of ["low", "high"] as const) {
    const ks = swings.filter((s) => s.kind === kind);
    for (let i = 1; i < ks.length; i++) {
      const a = ks[i - 1];
      const b = ks[i];
      const valid = kind === "low" ? b.price > a.price : b.price < a.price;
      if (!valid || b.occ === a.occ) continue;
      const slope = (b.price - a.price) / (b.occ - a.occ);
      const at = (idx: number) => a.price + slope * (idx - a.occ);
      const replacedAt = i + 1 < ks.length ? ks[i + 1].conf : Infinity;
      let end = Math.min(last, replacedAt);
      let active = replacedAt === Infinity;
      for (let t = b.conf; t <= end; t++) {
        const c = bars[t].close;
        if ((kind === "low" && c < at(t)) || (kind === "high" && c > at(t))) {
          end = t;
          active = false;
          break;
        }
      }
      if (b.conf > last || end < b.conf) continue;
      out.push({
        kind: kind === "low" ? "support" : "resistance",
        startIndex: b.conf,
        endIndex: end,
        startPrice: at(b.conf),
        endPrice: at(end),
        anchors: [{ index: a.occ, price: a.price }, { index: b.occ, price: b.price }],
        active: active && end === last,
      });
    }
  }
  return out;
}

export interface OverlayToggles {
  ema50: boolean;
  ema200: boolean;
  swings: boolean;
  zones: boolean;
  trendlines: boolean;
  structure: boolean; // BOS / CHoCH markers
}

export const DEFAULT_OVERLAYS: OverlayToggles = {
  ema50: false,
  ema200: false,
  swings: false,
  zones: false,
  trendlines: false,
  structure: false,
};

export interface Overlays {
  ema50: (number | null)[] | null;
  ema200: (number | null)[] | null;
  swings: Swing[];
  zones: Zone[];
  lines: LineSegment[];
  structure: StructureResult | null;
}

/** Only computes what is switched on. Pure; safe to call on every candle update. */
export function computeOverlays(bars: Bar[], on: OverlayToggles, k = SWING_K): Overlays {
  const closes = bars.map((b) => b.close);
  return {
    ema50: on.ema50 ? ema(closes, 50) : null,
    ema200: on.ema200 ? ema(closes, 200) : null,
    swings: on.swings ? findSwings(bars, k) : [],
    zones: on.zones ? activeZones(bars, k) : [],
    lines: on.trendlines ? trendlines(bars, k).slice(-6) : [],
    structure: on.structure ? runStructure(bars, k) : null,
  };
}
