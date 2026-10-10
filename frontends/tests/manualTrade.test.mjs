import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';

const load = async (rel) => {
  const code = ts.transpileModule(readFileSync(new URL(rel, import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
};
const m = await load('../src/lib/manualTrade.ts');

test('SL trigger is PRICE movement %: entry 80,000 and 1% => 79,200 long / 80,800 short', () => {
  assert.equal(m.localTrigger('long', 80000, 1, 'sl'), 79200);
  assert.equal(m.localTrigger('short', 80000, 1, 'sl'), 80800);
});

test('TP trigger is on the profit side', () => {
  assert.equal(m.localTrigger('long', 80000, 2, 'tp'), 81600);
  assert.equal(m.localTrigger('short', 80000, 2, 'tp'), 78400);
});

test('local estimate: notional, quantity and gross loss at the stop', () => {
  const e = m.localEstimate({ symbol: 'BTCUSDT', direction: 'long', stake: 100, leverage: 10, slPct: 1, tpPct: null }, 80000);
  assert.equal(e.notional, 1000);
  assert.equal(e.quantity, 1000 / 80000);
  assert.equal(e.slTrigger, 79200);
  assert.equal(e.tpTrigger, null);
  assert.ok(Math.abs(e.grossLossAtSl - 10) < 1e-9);          // 1% of 1000 notional
  assert.ok(Math.abs(e.marginLossPct - 10) < 1e-9);          // 10% of 100 margin
});

test('no estimate without a price or without a stop-loss (the stop is mandatory)', () => {
  const base = { symbol: 'BTCUSDT', direction: 'long', stake: 100, leverage: 10, slPct: 1, tpPct: null };
  assert.equal(m.localEstimate(base, null), null);
  assert.equal(m.localEstimate({ ...base, slPct: null }, 80000), null);
  assert.equal(m.localEstimate({ ...base, slPct: 0 }, 80000), null);
});

test('the open request has NO timeframe, duration or expiry: the chart timeframe cannot affect an order', () => {
  const form = { symbol: 'BTCUSDT', direction: 'short', stake: 50, leverage: 3, slPct: 1.5, tpPct: 3 };
  const body = m.buildOpenRequest(form, { idempotencyKey: 'abc-123', referencePrice: 80000, integrationId: null });
  const keys = Object.keys(body);
  for (const forbidden of ['timeframe', 'chart_timeframe', 'expiry_seconds', 'duration', 'expires_at', 'interval']) assert.ok(!keys.includes(forbidden), forbidden);
  assert.equal(body.confirm, true);
  assert.equal(body.idempotency_key, 'abc-123');
  assert.equal(body.sl_pct, 1.5);
  assert.equal(body.tp_pct, 3);
  // identical regardless of any chart state
  assert.deepEqual(body, m.buildOpenRequest({ ...form }, { idempotencyKey: 'abc-123', referencePrice: 80000, integrationId: null }));
  assert.ok(!Object.keys(m.buildPreviewRequest(form)).includes('timeframe'));
});

test('chart timeframes offered are exactly 5m/15m/1h/4h', () => {
  assert.deepEqual([...m.CHART_TIMEFRAMES], ['5m', '15m', '1h', '4h']);
});

test('backend error "code: message" is parsed', () => {
  assert.deepEqual(m.parseApiError('price_moved: Mark price moved 0.5%'), { code: 'price_moved', text: 'Mark price moved 0.5%' });
  assert.deepEqual(m.parseApiError('Failed to fetch'), { code: 'error', text: 'Failed to fetch' });
});

test('protection is only called verified when the backend says PROTECTED and the position is OPEN_PROTECTED', () => {
  const base = { protection_status: 'PROTECTED', status: 'OPEN_PROTECTED', is_terminal: false };
  assert.equal(m.protectionLabel(base).tone, 'ok');
  assert.equal(m.protectionLabel({ ...base, protection_status: 'PENDING', status: 'PROTECTION_PENDING' }).tone, 'warn');
  assert.equal(m.protectionLabel({ ...base, protection_status: 'LOST' }).tone, 'bad');
  assert.equal(m.protectionLabel({ ...base, protection_status: 'FAILED', status: 'EMERGENCY_EXIT' }).tone, 'bad');
  assert.equal(m.protectionLabel({ ...base, protection_status: 'UNKNOWN', status: 'EXCHANGE_STATE_UNKNOWN' }).tone, 'warn');
  assert.notEqual(m.protectionLabel({ ...base, status: 'CLOSE_FAILED' }).tone, 'ok');
});

test('formatters never invent numbers', () => {
  assert.equal(m.fmtPrice(null), '-');
  assert.equal(m.fmtPnl(undefined), '-');
  assert.equal(m.fmtPnl(5.037), '+5.04');
  assert.equal(m.fmtPnl(-0.004), '-0.004000');
  assert.equal(m.fmtAge(3700), '1h 1m');
});
