import { useEffect, useRef, useState } from 'react';
import {
  BYBIT_SPOT_WS,
  bucketTrade,
  bybitKlineTopic,
  bybitKlineUrl,
  bybitTradeTopic,
  createUpdateScheduler,
  fromBybit,
  parseBybitSocketPayload,
  type Candle,
  type Interval,
} from 'tradingcandle-core';
import { TradingChart, type TradingChartHandle } from 'tradingcandle-web';

const SYMBOL = 'BTCUSDT';

export function App() {
  const [interval, setIntervalValue] = useState<Interval>('30m');
  const [candles, setCandles] = useState<Candle[]>([]);
  const chartRef = useRef<TradingChartHandle>(null);

  useEffect(() => {
    const url = bybitKlineUrl(SYMBOL, interval, 500);
    if (!url) {
      setCandles([]);
      return;
    }
    let cancel = false;
    void fetch(url)
      .then((response) => response.json())
      .then((body: { result?: { list?: string[][] } }) => {
        if (!cancel) setCandles(fromBybit(body.result?.list));
      })
      .catch(() => {
        if (!cancel) setCandles([]);
      });
    return () => {
      cancel = true;
    };
  }, [interval]);

  useEffect(() => {
    const topic = interval === '1s' ? bybitTradeTopic(SYMBOL) : bybitKlineTopic(SYMBOL, interval);
    if (!topic) return;
    const socket = new WebSocket(BYBIT_SPOT_WS);
    let bucket: Candle | null = null;
    const scheduler = createUpdateScheduler((candle) => {
      chartRef.current?.updateCandle(candle);
    }, 50);
    socket.onopen = () => {
      socket.send(JSON.stringify({ op: 'subscribe', args: [topic] }));
    };
    socket.onmessage = (event) => {
      const payload = parseBybitSocketPayload(String(event.data));
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
    return () => {
      scheduler.cancel();
      socket.close();
    };
  }, [interval]);

  return (
    <div style={{ height: '100%' }}>
      <TradingChart
        ref={chartRef}
        symbol={SYMBOL}
        exchangeLabel="Bybit"
        marketType="Spot"
        interval={interval}
        data={candles}
        indicators={['VOL', 'SMA']}
        theme="dark"
        colors={{ up: '#26a65b', down: '#e5484d' }}
        showToolbar
        showTimeframeBar
        showVolume
        onIntervalChange={setIntervalValue}
        onLoadMore={(oldestTime) => {
          const url = bybitKlineUrl(SYMBOL, interval, 200, oldestTime - 1);
          if (!url) return;
          void fetch(url)
            .then((response) => response.json())
            .then((body: { result?: { list?: string[][] } }) => {
              const older = fromBybit(body.result?.list);
              if (older.length === 0) return;
              setCandles((current) => {
                const seen = new Set(older.map((candle) => candle.time));
                const merged = older.concat(current.filter((candle) => !seen.has(candle.time)));
                merged.sort((a, b) => a.time - b.time);
                return merged;
              });
            })
            .catch(() => undefined);
        }}
      />
    </div>
  );
}
