import { BYBIT_INTERVAL, type Candle, type Interval } from './types';

export const BYBIT_KLINE_URL = 'https://api.bybit.com/v5/market/kline';
export const BYBIT_SPOT_WS = 'wss://stream.bybit.com/v5/public/spot';
export const BYBIT_LINEAR_WS = 'wss://stream.bybit.com/v5/public/linear';

export type BybitCategory = 'spot' | 'linear';

export type BybitKlineResponse = {
  retCode?: number;
  retMsg?: string;
  result?: {
    list?: string[][];
  };
};

export function bybitKlineUrl(
  symbol: string,
  interval: Interval,
  limit = 200,
  end?: number,
  category: BybitCategory = 'spot',
): string | null {
  const bybitInterval = BYBIT_INTERVAL[interval];
  if (!bybitInterval) return null;
  const params = new URLSearchParams({
    category,
    symbol,
    interval: bybitInterval,
    limit: String(limit),
  });
  if (end != null) params.set('end', String(end));
  return `${BYBIT_KLINE_URL}?${params.toString()}`;
}

export function bybitKlineTopic(symbol: string, interval: Interval): string | null {
  const bybitInterval = BYBIT_INTERVAL[interval];
  if (!bybitInterval) return null;
  return `kline.${bybitInterval}.${symbol}`;
}

export function bybitTradeTopic(symbol: string): string {
  return `publicTrade.${symbol}`;
}

export type BybitWsKline = {
  start: number | string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  turnover?: string;
};

export function candleFromBybitKline(row: BybitWsKline): Candle {
  return {
    time: Number(row.start),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
    turnover: row.turnover == null ? undefined : Number(row.turnover),
  };
}

export type BybitPublicTrade = {
  T?: number;
  p?: string;
  v?: string;
};

export function parseBybitSocketPayload(raw: string): {
  topic?: string;
  klines: Candle[];
  trades: BybitPublicTrade[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { klines: [], trades: [] };
  }
  if (!parsed || typeof parsed !== 'object') return { klines: [], trades: [] };
  const message = parsed as { topic?: string; data?: unknown };
  const topic = typeof message.topic === 'string' ? message.topic : undefined;
  if (topic?.startsWith('kline.') && Array.isArray(message.data)) {
    const klines = message.data
      .filter((row): row is BybitWsKline => !!row && typeof row === 'object' && 'start' in row)
      .map((row) => candleFromBybitKline(row))
      .filter((candle) => Number.isFinite(candle.time));
    return { topic, klines, trades: [] };
  }
  if (topic?.startsWith('publicTrade.') && Array.isArray(message.data)) {
    const trades = message.data.filter(
      (row): row is BybitPublicTrade => !!row && typeof row === 'object',
    );
    return { topic, klines: [], trades };
  }
  return { topic, klines: [], trades: [] };
}
