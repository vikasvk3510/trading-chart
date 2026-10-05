import { useEffect, useRef, useState } from 'react';
import {
  BYBIT_LINEAR_WS,
  BYBIT_SPOT_WS,
  bucketTrade,
  bybitKlineTopic,
  bybitKlineUrl,
  bybitOrderbookTopic,
  bybitTradeTopic,
  createOrderBook,
  createUpdateScheduler,
  decodeSocketIo,
  encodeSocketIoEvent,
  fillFeedTemplate,
  historyRequestUrl,
  parseBybitOrderbookMessage,
  parseBybitSocketPayload,
  parseFeedData,
  parseHistoryBody,
  resolveFeed,
  toWebSocketUrl,
  type BybitChartFeed,
  type Candle,
  type ChartFeed,
  type CustomChartFeed,
  type DepthBook,
  type FeedUpdate,
  type Interval,
} from 'tradingcandle-core';

export type FeedStatus = 'connecting' | 'live' | 'offline';

const EMPTY_BOOK: DepthBook = { bids: [], asks: [] };
const EMPTY_CANDLES: Candle[] = [];

type Handlers = {
  onCandle: (candle: Candle) => void;
  onStatus?: (status: FeedStatus) => void;
  onError?: (message: string) => void;
};

function bybitHistoryUrl(feed: BybitChartFeed, symbol: string, interval: Interval, limit: number, end?: number) {
  const url = bybitKlineUrl(symbol, interval, limit, end, feed.category ?? 'spot');
  if (!url || !feed.historyUrl) return url;
  const built = new URL(url);
  const custom = new URL(feed.historyUrl);
  custom.search = built.search;
  return custom.toString();
}

async function readHistory(url: string): Promise<Candle[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Candle history failed (${response.status})`);
  return parseHistoryBody(await response.json());
}

function mergeOlder(older: Candle[], current: Candle[]): Candle[] {
  const seen = new Set(older.map((candle) => candle.time));
  return older.concat(current.filter((candle) => !seen.has(candle.time))).sort((a, b) => a.time - b.time);
}

/**
 * Loads candle history and subscribes to live updates.
 * `bybit` is the default. A custom `socketUrl` uses your own feed.
 */
export function useChartFeed(
  active: boolean,
  feed: ChartFeed,
  symbol: string,
  interval: Interval,
  handlers: Handlers,
): { candles: Candle[]; depth: DepthBook; loadMore: (oldestTime: number) => void } {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const requestKey = `${symbol}|${interval}`;
  const feedKey = typeof feed === 'string' ? feed : JSON.stringify(feed);
  const [series, setSeries] = useState<{ key: string; candles: Candle[] }>({ key: '', candles: EMPTY_CANDLES });
  const [bookState, setBookState] = useState<{ key: string; depth: DepthBook }>({ key: '', depth: EMPTY_BOOK });
  const loadMoreRef = useRef<(oldestTime: number) => void>(() => undefined);
  const candles = !active || series.key !== requestKey ? EMPTY_CANDLES : series.candles;
  const depth = !active || bookState.key !== requestKey ? EMPTY_BOOK : bookState.depth;

  useEffect(() => {
    if (!active) return;
    const resolved = resolveFeed(feed);
    let stopped = false;
    let socket: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let publish: ReturnType<typeof setTimeout> | null = null;
    const book = createOrderBook();
    let bucket: Candle | null = null;

    const setStatus = (status: FeedStatus) => handlersRef.current.onStatus?.(status);
    const fail = (message: string) => handlersRef.current.onError?.(message);
    const emit = (candle: Candle) => handlersRef.current.onCandle(candle);

    const scheduleBook = () => {
      if (publish != null) return;
      publish = setTimeout(() => {
        publish = null;
        if (!stopped) setBookState({ key: requestKey, depth: book.snapshot() });
      }, 80);
    };

    const applyUpdate = (update: FeedUpdate | null) => {
      if (!update) return;
      if (update.depth) setBookState({ key: requestKey, depth: update.depth });
      if (update.candle) emit(update.candle);
      if (update.candles?.length) {
        const last = update.candles[update.candles.length - 1];
        if (update.candles.length === 1 && last) emit(last);
        else setSeries({ key: requestKey, candles: update.candles });
      }
    };

    const historyUrl = (limit: number, end?: number) => {
      if (resolved.provider === 'bybit') return bybitHistoryUrl(resolved, symbol, interval, limit, end);
      return resolved.historyUrl ? historyRequestUrl(resolved.historyUrl, symbol, interval, limit, end) : null;
    };

    const load = (limit: number, end?: number) => {
      const url = historyUrl(limit, end);
      if (!url) return Promise.resolve([] as Candle[]);
      return readHistory(url).catch((error: unknown) => {
        fail(error instanceof Error ? error.message : 'Candle history failed');
        return [] as Candle[];
      });
    };

    loadMoreRef.current = (oldestTime) => {
      void load(200, oldestTime - 1).then((older) => {
        if (!stopped && older.length) {
          setSeries((current) => ({
            key: requestKey,
            candles: mergeOlder(older, current.key === requestKey ? current.candles : EMPTY_CANDLES),
          }));
        }
      });
    };

    void load(resolved.provider === 'bybit' ? 500 : 200).then((history) => {
      if (!stopped && history.length) setSeries({ key: requestKey, candles: history });
    });

    const connectBybit = () => {
      const topic = interval === '1s' ? bybitTradeTopic(symbol) : bybitKlineTopic(symbol, interval);
      const socketUrl =
        resolved.provider === 'bybit' && resolved.socketUrl
          ? resolved.socketUrl
          : resolved.provider === 'bybit' && resolved.category === 'linear'
            ? BYBIT_LINEAR_WS
            : BYBIT_SPOT_WS;
      if (!topic) return;
      const depthTopic = bybitOrderbookTopic(symbol, 200);
      const scheduler = createUpdateScheduler(emit, 50);
      const open = () => {
        if (stopped) return;
        setStatus('connecting');
        socket = new WebSocket(socketUrl);
        socket.onopen = () => {
          setStatus('live');
          socket?.send(JSON.stringify({ op: 'subscribe', args: [topic, depthTopic] }));
          if (ping) clearInterval(ping);
          ping = setInterval(() => {
            if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ op: 'ping' }));
          }, 20000);
        };
        socket.onmessage = (event) => {
          const raw = typeof event.data === 'string' ? event.data : '';
          if (raw.includes('"op":"ping"') || raw.includes('"op": "ping"')) {
            if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ op: 'pong' }));
          }
          const order = parseBybitOrderbookMessage(raw);
          if (order) {
            book.apply(order.kind, order.bids, order.asks);
            scheduleBook();
            return;
          }
          const payload = parseBybitSocketPayload(raw);
          if (interval === '1s') {
            for (const trade of payload.trades) {
              const price = Number(trade.p);
              const size = Number(trade.v);
              if (!Number.isFinite(price) || !Number.isFinite(size)) continue;
              bucket = bucketTrade(bucket, trade.T ?? Date.now(), price, size, 1000);
              scheduler.push(bucket);
            }
            return;
          }
          for (const candle of payload.klines) scheduler.push(candle);
        };
        socket.onerror = () => setStatus('offline');
        socket.onclose = () => {
          if (ping) {
            clearInterval(ping);
            ping = null;
          }
          if (stopped) return;
          setStatus('offline');
          reconnect = setTimeout(open, 1500);
        };
      };
      open();
      return () => scheduler.cancel();
    };

    const connectCustom = (custom: CustomChartFeed) => {
      let endpoint: { url: string; socketIo: boolean };
      try {
        endpoint = toWebSocketUrl(custom.socketUrl);
      } catch (error) {
        fail(error instanceof Error ? error.message : 'Socket URL is invalid');
        return;
      }
      const subscribe = () => {
        const request = custom.subscribe ?? {
          event: 'subscribe',
          payload: { symbol: '{symbol}', interval: '{interval}' },
        };
        const payload = fillFeedTemplate(request.payload ?? { symbol, interval }, symbol, interval);
        if (endpoint.socketIo) socket?.send(encodeSocketIoEvent(request.event, payload));
        else socket?.send(JSON.stringify({ event: request.event, payload }));
      };
      const open = () => {
        if (stopped) return;
        setStatus('connecting');
        socket = new WebSocket(endpoint.url);
        socket.onopen = () => {
          if (!endpoint.socketIo) {
            setStatus('live');
            subscribe();
          }
        };
        socket.onmessage = (event) => {
          const raw = typeof event.data === 'string' ? event.data : '';
          if (!endpoint.socketIo) {
            applyUpdate(parseFeedData(raw));
            return;
          }
          const packet = decodeSocketIo(raw);
          if (packet.type === 'open') {
            socket?.send('40');
            return;
          }
          if (packet.type === 'ping') {
            socket?.send('3');
            return;
          }
          if (packet.type === 'connect') {
            setStatus('live');
            subscribe();
            return;
          }
          if (packet.type === 'event' && (!custom.event || packet.event === custom.event)) {
            applyUpdate(parseFeedData(packet.data));
          }
        };
        socket.onerror = () => setStatus('offline');
        socket.onclose = () => {
          if (stopped) return;
          setStatus('offline');
          reconnect = setTimeout(open, 1500);
        };
      };
      open();
    };

    const cancelScheduler = resolved.provider === 'bybit' ? connectBybit() : undefined;
    if (resolved.provider === 'custom') connectCustom(resolved);

    return () => {
      stopped = true;
      cancelScheduler?.();
      if (ping) clearInterval(ping);
      if (publish) clearTimeout(publish);
      if (reconnect) clearTimeout(reconnect);
      socket?.close();
    };
  }, [active, feedKey, symbol, interval]);

  const loadMore = (oldestTime: number) => loadMoreRef.current(oldestTime);
  return { candles, depth, loadMore };
}
