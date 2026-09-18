import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/lib/quickTradeCosts.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { quickTradeCosts, finiteNumber } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const trade = { mode: 'live', side: 'buy', entry_price: 100, quantity: 1, stake_amount: 10,
  signal_payload: { execution_cost: { entry_fee: 0.05, fee_rate: 0.0005, entry_slippage_pct: 1 } } };

test('gross profit can be net loss; entry slippage is not charged twice', () => {
  const result = quickTradeCosts(trade, 100.03, 0.04);
  assert.ok(result.gross > 0); assert.ok(result.net < 0);
  assert.ok(Math.abs(result.net - (0.03 - 0.05 - 100.03 * 0.0005 - 100.03 * 0.0004)) < 1e-9);
  assert.ok(Math.abs(result.stakeAfterCosts - (10 + result.net)) < 1e-9);
  assert.equal(result.fundingUnknown, true);
});
test('shorts, leverage quantity and funding credits use the correct sign', () => {
  const result = quickTradeCosts({ ...trade, side: 'sell', quantity: 10, funding_fee_actual: -2 }, 99, 0);
  assert.equal(result.gross, 10); assert.ok(result.net > result.gross);
});
test('null values never become fake zero costs', () => {
  assert.equal(finiteNumber(null), null); assert.equal(finiteNumber(''), null);
  assert.equal(quickTradeCosts(trade, 101, null).net, null);
  assert.equal(quickTradeCosts({ ...trade, signal_payload: null }, 101, 0).net, null);
});
test('real zero fee and zero slippage remain valid', () => {
  const result = quickTradeCosts({ ...trade, entry_fee_actual: 0,
    signal_payload: { execution_cost: { fee_rate: 0 } }, funding_fee_actual: 0 }, 101, 0);
  assert.equal(result.net, 1); assert.equal(result.entryFeeSource, 'actual');
});
test('paper payout and malformed prices are never treated as futures PnL', () => {
  assert.equal(quickTradeCosts({ ...trade, mode: 'paper' }, 101, 0), null);
  assert.equal(quickTradeCosts(trade, Number.NaN, 0), null);
});
