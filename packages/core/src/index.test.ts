import { describe, expect, it, vi } from 'vitest';
import {
  bucketTrade,
  bybitKlineTopic,
  bybitOrderbookTopic,
  createOrderBook,
  parseBybitOrderbookMessage,
  bybitKlineUrl,
  createUpdateScheduler,
  decodeMessage,
  encodeMessage,
  fromBinance,
  fromBybit,
  legendStats,
  mergeCandle,
  parseBybitSocketPayload,
  sma,
  type Candle,
} from './index';

const sample: Candle = {
  time: 1_700_000_000_000,
  open: 10,
  high: 12,
  low: 9,
  close: 11,
  volume: 5,
  turnover: 50,
};

describe('fromBybit', () => {
  it('converts string rows and sorts oldest first', () => {
    const candles = fromBybit([
      ['1700000060000', '11', '12', '10', '11.5', '3', '30'],
      ['1700000000000', '10', '12', '9', '11', '5', '50'],
      ['not-a-row'],
    ]);
    expect(candles).toEqual([
      {
        time: 1_700_000_000_000,
        open: 10,
        high: 12,
        low: 9,
        close: 11,
        volume: 5,
        turnover: 50,
      },
      {
        time: 1_700_000_060_000,
        open: 11,
        high: 12,
        low: 10,
        close: 11.5,
        volume: 3,
        turnover: 30,
      },
    ]);
  });

  it('returns an empty list for missing input', () => {
    expect(fromBybit(null)).toEqual([]);
    expect(fromBybit([])).toEqual([]);
  });
});

describe('fromBinance', () => {
  it('reads the standard kline tuple', () => {
    const candles = fromBinance([
      [1_700_000_000_000, '10', '12', '9', '11', '5', 1_700_000_059_999, '55', 3, '1', '2', '0'],
    ]);
    expect(candles[0]).toMatchObject({
      time: 1_700_000_000_000,
      open: 10,
      close: 11,
      volume: 5,
      turnover: 55,
    });
  });
});

describe('mergeCandle', () => {
  it('appends a newer bar and replaces the last bar with the same time', () => {
    const appended = mergeCandle([sample], { ...sample, time: sample.time + 60_000, close: 12 });
    expect(appended).toHaveLength(2);
    expect(appended[1].close).toBe(12);

    const replaced = mergeCandle(appended, { ...appended[1], close: 13, volume: 9 });
    expect(replaced).toHaveLength(2);
    expect(replaced[1].close).toBe(13);
    expect(replaced[1].volume).toBe(9);
  });

  it('ignores an older bar that is not already in the list', () => {
    const next = mergeCandle([sample], { ...sample, time: sample.time - 60_000 });
    expect(next).toEqual([sample]);
  });

  it('starts a list from an empty history', () => {
    expect(mergeCandle([], sample)).toEqual([sample]);
  });
});

describe('sma', () => {
  it('returns null until the window is full', () => {
    expect(sma([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
  });

  it('rejects a non-positive period', () => {
    expect(() => sma([1], 0)).toThrow(/period/);
  });
});

describe('legendStats', () => {
  it('measures change against the previous close', () => {
    const stats = legendStats(sample, 10);
    expect(stats.change).toBe(1);
    expect(stats.changePct).toBeCloseTo(10);
  });
});

describe('createUpdateScheduler', () => {
  it('keeps only the latest candle inside the window', () => {
    vi.useFakeTimers();
    const seen: Candle[] = [];
    const scheduler = createUpdateScheduler((candle) => seen.push(candle), 50);
    scheduler.push({ ...sample, close: 1 });
    scheduler.push({ ...sample, close: 2 });
    vi.advanceTimersByTime(50);
    expect(seen).toEqual([{ ...sample, close: 2 }]);
    scheduler.cancel();
    vi.useRealTimers();
  });
});

describe('bucketTrade', () => {
  it('opens a bucket and then updates high, low, close, and volume', () => {
    const first = bucketTrade(null, 1_500, 10, 1, 1_000);
    expect(first).toMatchObject({ time: 1_000, open: 10, close: 10, volume: 1 });
    const next = bucketTrade(first, 1_800, 12, 2, 1_000);
    expect(next).toMatchObject({ time: 1_000, open: 10, high: 12, low: 10, close: 12, volume: 3 });
    const later = bucketTrade(next, 2_100, 9, 1, 1_000);
    expect(later.time).toBe(2_000);
    expect(later.open).toBe(9);
  });
});

describe('bybit helpers', () => {
  it('builds a spot kline url and omits 1s', () => {
    expect(bybitKlineUrl('BTCUSDT', '30m', 200)).toBe(
      'https://api.bybit.com/v5/market/kline?category=spot&symbol=BTCUSDT&interval=30&limit=200',
    );
    expect(bybitKlineUrl('BTCUSDT', '1s')).toBeNull();
    expect(bybitKlineTopic('BTCUSDT', '30m')).toBe('kline.30.BTCUSDT');
  });

  it('parses kline and trade socket payloads', () => {
    const kline = parseBybitSocketPayload(
      JSON.stringify({
        topic: 'kline.30.BTCUSDT',
        data: [{ start: 1000, open: '1', high: '2', low: '0.5', close: '1.5', volume: '8', turnover: '12' }],
      }),
    );
    expect(kline.klines[0].close).toBe(1.5);
    const trade = parseBybitSocketPayload(
      JSON.stringify({ topic: 'publicTrade.BTCUSDT', data: [{ T: 2000, p: '10', v: '0.1' }] }),
    );
    expect(trade.trades[0].p).toBe('10');
  });
});

describe('order book', () => {
  it('applies a snapshot and then a delta', () => {
    const book = createOrderBook();
    const snapshot = parseBybitOrderbookMessage(
      JSON.stringify({
        topic: 'orderbook.50.ETHUSDT',
        type: 'snapshot',
        data: {
          b: [['2660', '2'], ['2661', '1']],
          a: [['2662', '3'], ['2664', '4']],
        },
      }),
    );
    expect(snapshot?.kind).toBe('snapshot');
    book.apply('snapshot', snapshot?.bids, snapshot?.asks);
    const delta = parseBybitOrderbookMessage(
      JSON.stringify({
        topic: 'orderbook.50.ETHUSDT',
        type: 'delta',
        data: { b: [['2660', '0'], ['2659', '5']], a: [['2662', '1']] },
      }),
    );
    book.apply('delta', delta?.bids, delta?.asks);
    expect(book.snapshot()).toEqual({
      bids: [
        { price: 2661, size: 1 },
        { price: 2659, size: 5 },
      ],
      asks: [
        { price: 2662, size: 1 },
        { price: 2664, size: 4 },
      ],
    });
    expect(bybitOrderbookTopic('ETHUSDT')).toBe('orderbook.50.ETHUSDT');
  });
});

describe('protocol', () => {
  it('round-trips host and chart messages and rejects junk', () => {
    const raw = encodeMessage({ type: 'setInterval', interval: '30m' });
    expect(decodeMessage(raw)).toEqual({ type: 'setInterval', interval: '30m' });
    expect(decodeMessage('{"type":"nope"}')).toBeNull();
    expect(decodeMessage('not-json')).toBeNull();
    expect(decodeMessage(encodeMessage({ type: 'ready' }))).toEqual({ type: 'ready' });
  });
});
