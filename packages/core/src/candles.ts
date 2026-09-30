import type { Candle } from './types';

export type BybitKlineRow = [
  startTime: string,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  turnover: string,
];

export type BinanceKlineRow = [
  openTime: number,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  closeTime: number,
  quoteVolume: string,
  trades: number,
  takerBuyBase: string,
  takerBuyQuote: string,
  ignore: string,
];

function num(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toCandle(
  time: string | number,
  open: string | number,
  high: string | number,
  low: string | number,
  close: string | number,
  volume: string | number,
  turnover?: string | number,
): Candle | null {
  const t = num(time);
  if (t <= 0) return null;
  return {
    time: t,
    open: num(open),
    high: num(high),
    low: num(low),
    close: num(close),
    volume: num(volume),
    turnover: turnover == null ? undefined : num(turnover),
  };
}

/**
 * Convert Bybit v5 kline rows into candles.
 * Bybit returns newest first: `[startTime, open, high, low, close, volume, turnover]`.
 * The result is sorted ascending by open time.
 */
export function fromBybit(raw: ReadonlyArray<ReadonlyArray<string>> | null | undefined): Candle[] {
  if (!raw || raw.length === 0) return [];
  const candles: Candle[] = [];
  for (const row of raw) {
    if (!row || row.length < 6) continue;
    const candle = toCandle(row[0], row[1], row[2], row[3], row[4], row[5], row[6]);
    if (candle) candles.push(candle);
  }
  candles.sort((a, b) => a.time - b.time);
  return candles;
}

/**
 * Convert Binance kline rows. Binance returns oldest first, but the result is
 * still sorted so a reversed payload stays safe.
 */
export function fromBinance(
  raw: ReadonlyArray<ReadonlyArray<string | number>> | null | undefined,
): Candle[] {
  if (!raw || raw.length === 0) return [];
  const candles: Candle[] = [];
  for (const row of raw) {
    if (!row || row.length < 6) continue;
    const candle = toCandle(row[0], row[1], row[2], row[3], row[4], row[5], row[7]);
    if (candle) candles.push(candle);
  }
  candles.sort((a, b) => a.time - b.time);
  return candles;
}

/**
 * Apply a live bar. Replaces the candle with the same open time, or appends
 * when the incoming bar is newer than the last one. Older unknown bars are ignored.
 */
export function mergeCandle(list: readonly Candle[], next: Candle): Candle[] {
  if (!Number.isFinite(next.time)) return list.slice();
  if (list.length === 0) return [next];
  const last = list[list.length - 1];
  if (next.time === last.time) {
    const copy = list.slice();
    copy[copy.length - 1] = next;
    return copy;
  }
  if (next.time > last.time) return list.concat(next);
  const idx = list.findIndex((candle) => candle.time === next.time);
  if (idx < 0) return list.slice();
  const copy = list.slice();
  copy[idx] = next;
  return copy;
}

/** Simple moving average. Leading values before the window fills are null. */
export function sma(values: readonly number[], period: number): Array<number | null> {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('sma period must be a positive integer');
  }
  const out: Array<number | null> = new Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    sum += value;
    if (i >= period) sum -= values[i - period];
    out[i] = i >= period - 1 ? sum / period : null;
  }
  return out;
}

export function lastSma(values: readonly number[], period: number): number | null {
  if (values.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i += 1) sum += values[i];
  return sum / period;
}

export type LegendStats = {
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePct: number;
};

/** Change versus the previous close when present, otherwise versus the bar open. */
export function legendStats(candle: Candle, previousClose?: number): LegendStats {
  const base = previousClose != null && previousClose !== 0 ? previousClose : candle.open;
  const change = previousClose != null ? candle.close - previousClose : candle.close - candle.open;
  const changePct = base !== 0 ? (change / base) * 100 : 0;
  return {
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    change,
    changePct,
  };
}

export function formatNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '--';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSigned(value: number, digits = 1): string {
  const text = formatNumber(Math.abs(value), digits);
  if (value > 0) return `+${text}`;
  if (value < 0) return `-${text}`;
  return text;
}

/**
 * Coalesce live updates so a WebSocket burst paints at most once per window.
 * Uses `setTimeout`, which is available in Node, browsers, and React Native.
 */
export function createUpdateScheduler(
  fn: (candle: Candle) => void,
  waitMs = 50,
): { push: (candle: Candle) => void; flush: () => void; cancel: () => void } {
  let pending: Candle | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return;
    const candle = pending;
    pending = null;
    fn(candle);
  };

  return {
    push(candle: Candle) {
      pending = candle;
      if (timer != null) return;
      timer = setTimeout(() => {
        timer = null;
        if (!pending) return;
        const next = pending;
        pending = null;
        fn(next);
      }, waitMs);
    },
    flush,
    cancel() {
      if (timer != null) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

/** Fold a trade into the current 1s (or other) bucket. */
export function bucketTrade(
  current: Candle | null,
  tradeTimeMs: number,
  price: number,
  size: number,
  intervalMs: number,
): Candle {
  const bucket = Math.floor(tradeTimeMs / intervalMs) * intervalMs;
  if (!current || current.time !== bucket) {
    return {
      time: bucket,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: size,
      turnover: price * size,
    };
  }
  return {
    time: bucket,
    open: current.open,
    high: Math.max(current.high, price),
    low: Math.min(current.low, price),
    close: price,
    volume: current.volume + size,
    turnover: (current.turnover ?? 0) + price * size,
  };
}
