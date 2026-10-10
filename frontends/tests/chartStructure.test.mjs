import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/lib/chartStructure.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const s = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

// deterministic pseudo-random walk
function walk(n, seed = 7) {
  let x = seed;
  const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  const bars = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    const open = price;
    price = Math.max(5, price + (rnd() - 0.5) * 4);
    const close = price;
    bars.push({ time: 1_700_000_000 + i * 900, open, close, high: Math.max(open, close) + rnd() * 1.2, low: Math.min(open, close) - rnd() * 1.2, volume: 1 });
  }
  return bars;
}
// zig-zag: each leg is `leg` bars, linear between the given turning points
function zigzag(points, leg = 6) {
  const closes = [];
  for (let i = 1; i < points.length; i++) {
    for (let j = 0; j < leg; j++) closes.push(points[i - 1] + ((points[i] - points[i - 1]) * j) / leg);
  }
  closes.push(points[points.length - 1]);
  return closes.map((c, i) => ({ time: 1_700_000_000 + i * 900, open: c, close: c, high: c + 0.2, low: c - 0.2, volume: 1 }));
}

test('EMA: seeded with the SMA, null before, and tracks a constant', () => {
  const e = s.ema([1, 2, 3, 4, 5], 3);
  assert.deepEqual(e.slice(0, 2), [null, null]);
  assert.equal(e[2], 2);
  assert.ok(Math.abs(e[3] - 3) < 1e-12);
  assert.deepEqual(s.ema(new Array(10).fill(5), 3).slice(2), new Array(8).fill(5));
});

test('swing: strict on both sides, confirmed only k bars later (conf = occ + k)', () => {
  const k = 2;
  const mk = (h) => h.map((x, i) => ({ time: i + 1, open: x, close: x, high: x, low: x - 1, volume: 1 }));
  const sw = s.findSwings(mk([1, 2, 5, 2, 1, 1, 1]), k);
  const hi = sw.filter((x) => x.kind === 'high');
  assert.equal(hi.length, 1);
  assert.equal(hi[0].occ, 2);
  assert.equal(hi[0].conf, 4);
  // an equal high on one side is NOT a swing
  assert.equal(s.findSwings(mk([1, 2, 5, 5, 1, 1, 1]), k).filter((x) => x.kind === 'high').length, 0);
  // too short a series (no k bars after) -> nothing, never a guess about the future
  assert.equal(s.findSwings(mk([1, 2, 5]), k).length, 0);
});

test('swing labels compare with the previous confirmed swing of the same kind', () => {
  const bars = zigzag([10, 20, 14, 26, 18, 32]);
  const sw = s.findSwings(bars, 2);
  const highs = sw.filter((x) => x.kind === 'high').map((x) => x.label);
  const lows = sw.filter((x) => x.kind === 'low').map((x) => x.label);
  assert.deepEqual(highs, [null, 'HH']);
  assert.deepEqual(lows, [null, 'HL']);
});

test('PREFIX INVARIANCE: swings known at bar m are identical whether or not later bars exist', () => {
  const bars = walk(400);
  const full = s.findSwings(bars, 5);
  for (const m of [40, 97, 150, 233, 399]) {
    const prefix = s.findSwings(bars.slice(0, m + 1), 5);
    const expected = full.filter((x) => x.conf <= m);
    assert.deepEqual(prefix, expected, `m=${m}`);
  }
});

test('PREFIX INVARIANCE: zones at bar m do not change when future bars are appended', () => {
  const bars = walk(420, 11);
  for (const m of [120, 260, 419]) {
    assert.deepEqual(s.activeZones(bars.slice(0, m + 1), 5), s.activeZones(bars, 5, m), `m=${m}`);
  }
});

test('PREFIX INVARIANCE: trendlines never use a future confirmation (start fixed, end clipped to the prefix)', () => {
  const bars = walk(500, 3);
  const full = s.trendlines(bars, 5);
  for (const m of [150, 300, 499]) {
    const prefix = s.trendlines(bars.slice(0, m + 1), 5);
    const known = full.filter((x) => x.startIndex <= m);
    assert.equal(prefix.length, known.length, `m=${m}`);
    for (const p of prefix) {
      const f = known.find((x) => x.startIndex === p.startIndex && x.kind === p.kind && x.anchors[0].index === p.anchors[0].index);
      assert.ok(f, 'segment must exist in the full computation');
      assert.equal(p.endIndex, Math.min(f.endIndex, m));
      assert.ok(Math.abs(p.startPrice - f.startPrice) < 1e-9);
      // the line only becomes visible when its 2nd anchor is confirmed
      assert.ok(p.startIndex >= p.anchors[1].index + 5);
    }
  }
});

test('trendlines: support needs a HIGHER low, resistance a LOWER high', () => {
  const up = s.trendlines(zigzag([10, 20, 14, 26, 18, 32, 24, 38, 30]), 2).filter((x) => x.kind === 'support');
  assert.ok(up.length >= 1);
  for (const l of up) assert.ok(l.anchors[1].price > l.anchors[0].price);
  const down = s.trendlines(zigzag([40, 30, 36, 24, 30, 18, 24, 12, 18]), 2).filter((x) => x.kind === 'resistance');
  assert.ok(down.length >= 1);
  for (const l of down) assert.ok(l.anchors[1].price < l.anchors[0].price);
});

test('BOS is CLOSE based: a wick through the level is not a break, a close beyond it is', () => {
  const base = zigzag([10, 20, 14, 26, 18, 32, 24], 6);         // bullish structure, last confirmed high ~32
  const lastHigh = s.findSwings(base, 2).filter((x) => x.kind === 'high').at(-1);
  assert.ok(lastHigh);
  const t0 = base.at(-1).time;
  const wick = [...base, { time: t0 + 900, open: 24, close: lastHigh.price - 1, high: lastHigh.price + 3, low: 23, volume: 1 }];
  assert.equal(s.runStructure(wick, 2).events.filter((e) => e.type === 'BOS' && e.dir === 1 && e.index === wick.length - 1).length, 0);
  const close = [...base, { time: t0 + 900, open: 24, close: lastHigh.price + 2, high: lastHigh.price + 3, low: 23, volume: 1 }];
  const ev = s.runStructure(close, 2).events.filter((e) => e.type === 'BOS' && e.dir === 1 && e.index === close.length - 1);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].level, lastHigh.price);
});

test('PREFIX INVARIANCE: structure events up to bar m are identical with or without later bars', () => {
  const bars = walk(400, 5);
  const full = s.runStructure(bars, 3).events;
  for (const m of [100, 250, 399]) {
    const prefix = s.runStructure(bars.slice(0, m + 1), 3).events;
    assert.deepEqual(prefix, full.filter((e) => e.index <= m), `m=${m}`);
  }
});

test('overlays are only computed when switched on (all off by default)', () => {
  const o = s.computeOverlays(walk(300), s.DEFAULT_OVERLAYS);
  assert.equal(o.ema50, null); assert.equal(o.ema200, null); assert.equal(o.structure, null);
  assert.deepEqual([o.swings.length, o.zones.length, o.lines.length], [0, 0, 0]);
  const on = s.computeOverlays(walk(300), { ema50: true, ema200: true, swings: true, zones: true, trendlines: true, structure: true });
  assert.equal(on.ema200.length, 300);
  assert.ok(on.swings.length > 0);
});

test('zones are ACTIVE only and each has positive width', () => {
  const bars = walk(300, 9);
  const zs = s.activeZones(bars, 5);
  for (const z of zs) {
    assert.equal(z.status, 'ACTIVE');
    assert.ok(z.hi > z.lo);
  }
});
