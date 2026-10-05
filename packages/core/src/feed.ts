import { fromBybit } from './candles';
import type { Candle, DepthBook, Interval } from './types';

/** Bybit public market data. This is the chart default. */
export type BybitChartFeed = {
  provider: 'bybit';
  category?: 'spot' | 'linear';
  /** Replaces the Bybit WebSocket. Still speaks the Bybit subscribe protocol. */
  socketUrl?: string;
  /** Replaces the Bybit kline REST host. */
  historyUrl?: string;
};

/**
 * Your own candle socket.
 * `wss://` is a raw WebSocket. `https://…/socket.io/` uses Socket.IO v4 over WebSocket.
 */
export type CustomChartFeed = {
  provider: 'custom';
  socketUrl: string;
  /** HTTPS history endpoint. `symbol`, `interval`, `limit`, and `end` are added as query params. */
  historyUrl?: string;
  /** Socket.IO event that carries candles. Raw sockets parse every JSON message. */
  event?: string;
  /** Sent after connect. `{symbol}` and `{interval}` inside strings are replaced. */
  subscribe?: { event: string; payload?: unknown };
};

export type ChartFeed = 'bybit' | BybitChartFeed | CustomChartFeed;

export type FeedUpdate = {
  candles?: Candle[];
  candle?: Candle;
  depth?: DepthBook;
};

export function resolveFeed(feed: ChartFeed | undefined): BybitChartFeed | CustomChartFeed {
  if (feed == null || feed === 'bybit') return { provider: 'bybit' };
  return feed;
}

export function toWebSocketUrl(input: string): { url: string; socketIo: boolean } {
  const trimmed = input.trim();
  if (/^wss?:\/\//i.test(trimmed)) return { url: trimmed, socketIo: false };
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Socket URL must start with ws, wss, http, or https');
  }
  const ws = trimmed.replace(/^http/i, 'ws');
  if (!/socket\.io/i.test(ws)) return { url: ws, socketIo: false };
  const url = new URL(ws);
  url.searchParams.set('EIO', '4');
  url.searchParams.set('transport', 'websocket');
  return { url: url.toString(), socketIo: true };
}

export function historyRequestUrl(
  base: string,
  symbol: string,
  interval: Interval,
  limit: number,
  end?: number,
): string {
  const url = new URL(base);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('limit', String(limit));
  if (end != null) url.searchParams.set('end', String(end));
  return url.toString();
}

export function fillFeedTemplate(value: unknown, symbol: string, interval: Interval): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{symbol\}/g, symbol).replace(/\{interval\}/g, interval);
  }
  if (Array.isArray(value)) return value.map((item) => fillFeedTemplate(item, symbol, interval));
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) next[key] = fillFeedTemplate(item, symbol, interval);
    return next;
  }
  return value;
}

export function encodeSocketIoEvent(event: string, payload: unknown): string {
  return `42${JSON.stringify([event, payload])}`;
}

export function decodeSocketIo(packet: string):
  | { type: 'open' }
  | { type: 'ping' }
  | { type: 'connect' }
  | { type: 'event'; event: string; data: unknown }
  | { type: 'ignore' } {
  if (packet.startsWith('0')) return { type: 'open' };
  if (packet === '2') return { type: 'ping' };
  if (packet.startsWith('40')) return { type: 'connect' };
  if (packet.startsWith('42')) {
    try {
      const body = JSON.parse(packet.slice(2)) as unknown;
      if (Array.isArray(body) && typeof body[0] === 'string') {
        return { type: 'event', event: body[0], data: body[1] };
      }
    } catch {
      return { type: 'ignore' };
    }
  }
  return { type: 'ignore' };
}

function isCandle(value: unknown): value is Candle {
  if (!value || typeof value !== 'object') return false;
  const row = value as Candle;
  return [row.time, row.open, row.high, row.low, row.close].every((item) => typeof item === 'number' && Number.isFinite(item));
}

function candleFromRow(row: unknown): Candle | null {
  if (isCandle(row)) return { ...row, volume: typeof row.volume === 'number' ? row.volume : 0 };
  if (!Array.isArray(row) || row.length < 6) return null;
  const [time, open, high, low, close, volume, turnover] = row;
  const candle: Candle = {
    time: Number(time),
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volume: Number(volume),
  };
  if (turnover != null) candle.turnover = Number(turnover);
  return [candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) ? candle : null;
}

function depthFrom(value: unknown): DepthBook | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const book = value as { bids?: unknown; asks?: unknown };
  const side = (rows: unknown) =>
    Array.isArray(rows)
      ? rows
          .map((row) => {
            if (Array.isArray(row)) return { price: Number(row[0]), size: Number(row[1]) };
            if (row && typeof row === 'object' && 'price' in row && 'size' in row) {
              const level = row as { price: unknown; size: unknown };
              return { price: Number(level.price), size: Number(level.size) };
            }
            return null;
          })
          .filter((level): level is { price: number; size: number } => !!level && level.size > 0)
      : [];
  if (!Array.isArray(book.bids) && !Array.isArray(book.asks)) return undefined;
  return { bids: side(book.bids), asks: side(book.asks) };
}

/** Accepts Bybit kline JSON, a candle array, or one candle object. */
export function parseHistoryBody(body: unknown): Candle[] {
  if (Array.isArray(body)) {
    return body.map(candleFromRow).filter((candle): candle is Candle => !!candle).sort((a, b) => a.time - b.time);
  }
  if (!body || typeof body !== 'object') return [];
  const record = body as {
    result?: { list?: string[][] };
    data?: unknown;
    candles?: unknown;
    list?: unknown;
  };
  if (Array.isArray(record.result?.list)) return fromBybit(record.result.list);
  for (const key of ['candles', 'data', 'list'] as const) {
    const value = record[key];
    if (Array.isArray(value)) {
      const candles = value.map(candleFromRow).filter((candle): candle is Candle => !!candle);
      if (candles.length) return candles.sort((a, b) => a.time - b.time);
    }
  }
  const one = candleFromRow(body);
  return one ? [one] : [];
}

/** Turns one socket payload into candles and, when present, a depth book. */
export function parseFeedData(data: unknown): FeedUpdate | null {
  if (typeof data === 'string') {
    try {
      return parseFeedData(JSON.parse(data));
    } catch {
      return null;
    }
  }
  const candles = parseHistoryBody(data);
  const depth = depthFrom(data);
  if (!candles.length && !depth) return null;
  if (candles.length === 1 && !Array.isArray(data) && !(data && typeof data === 'object' && ('data' in data || 'candles' in data || 'list' in data || 'result' in data))) {
    return { candle: candles[0], depth };
  }
  return { candles: candles.length ? candles : undefined, depth };
}
