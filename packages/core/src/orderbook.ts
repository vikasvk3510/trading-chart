import type { DepthBook, DepthLevel } from './types';

type Side = Map<string, number>;

export type OrderBook = {
  apply: (kind: 'snapshot' | 'delta', bids: unknown, asks: unknown) => void;
  snapshot: () => DepthBook;
};

function applySide(book: Side, rows: unknown, replace: boolean): void {
  if (replace) book.clear();
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const price = String(row[0]);
    const size = Number(row[1]);
    if (!price || !Number.isFinite(size) || size <= 0) book.delete(price);
    else book.set(price, size);
  }
}

function toLevels(book: Side, direction: number): DepthLevel[] {
  return [...book.entries()]
    .map(([price, size]) => ({ price: Number(price), size }))
    .filter((level) => Number.isFinite(level.price) && level.size > 0)
    .sort((a, b) => (a.price - b.price) * direction);
}

export function createOrderBook(): OrderBook {
  const bids: Side = new Map();
  const asks: Side = new Map();
  return {
    apply(kind, bidRows, askRows) {
      const replace = kind === 'snapshot';
      applySide(bids, bidRows, replace);
      applySide(asks, askRows, replace);
    },
    snapshot() {
      return { bids: toLevels(bids, -1), asks: toLevels(asks, 1) };
    },
  };
}

export function bybitOrderbookTopic(symbol: string, depth: 1 | 50 | 200 = 50): string {
  return `orderbook.${depth}.${symbol}`;
}

export function parseBybitOrderbookMessage(raw: string): {
  topic?: string;
  kind: 'snapshot' | 'delta';
  bids: unknown;
  asks: unknown;
} | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const message = parsed as { topic?: unknown; type?: unknown; data?: unknown };
  if (typeof message.topic !== 'string' || !message.topic.startsWith('orderbook.')) return null;
  if (!message.data || typeof message.data !== 'object') return null;
  const data = message.data as { b?: unknown; a?: unknown };
  return {
    topic: message.topic,
    kind: message.type === 'delta' ? 'delta' : 'snapshot',
    bids: data.b,
    asks: data.a,
  };
}
