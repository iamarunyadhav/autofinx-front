import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/hooks/binanceCandleWs.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { binanceKlineStreamUrl, parseBinanceKlineMessage, upsertCandle } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('futures candles use the routed market endpoint; spot remains separate', () => {
  assert.equal(binanceKlineStreamUrl('BTCUSDT', '1m', 'futures'), 'wss://fstream.binance.com/market/ws/btcusdt@kline_1m');
  assert.equal(binanceKlineStreamUrl('BTCUSDT', '1m', 'spot'), 'wss://stream.binance.com:9443/ws/btcusdt@kline_1m');
});

test('forming candle prices update before close without changing closed history', () => {
  const raw = (close, closed) => JSON.stringify({ E: 120050, k: { t: 120000, o: '100', h: '105', l: '99', c: String(close), v: '10', x: closed } });
  const history = { time: 60, open: 99, high: 101, low: 98, close: 100, volume: 10, isClosed: true };
  const initial = parseBinanceKlineMessage(raw(101, false));
  const revised = parseBinanceKlineMessage(raw(104, false));
  let chart = upsertCandle([history], initial.candle);
  chart = upsertCandle(chart, revised.candle);
  assert.equal(chart.length, 2);
  assert.equal(chart[1].close, 104);
  assert.equal(chart[1].isClosed, false);
  assert.deepEqual(chart[0], history);
  chart = upsertCandle(chart, parseBinanceKlineMessage(raw(103, true)).candle);
  assert.equal(chart[1].isClosed, true);
  assert.equal(chart[1].close, 103);
});
