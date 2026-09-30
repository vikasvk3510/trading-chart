# Use tradingcandle-react-native

Install the published package. The chart draws inside your app. It does not open Bybit by itself. You pass candles in.

```bash
npm install tradingcandle-react-native react-native-webview
```

On iOS, run `pod install` inside the `ios` folder, then rebuild the app once. Android also needs one native rebuild after `react-native-webview` is added for the first time.

## Candle format

`data` is an array of candles, oldest first. `time` is the bar open time in milliseconds.

```ts
{
  time: 1759228200000,
  open: 2686.14,
  high: 2689.51,
  low: 2684.8,
  close: 2685.79,
  volume: 120.45
}
```

`interval` is separate from the candle: `1s`, `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`, `1w`, `1M`.

## Show a chart

Give the parent a height. Replace the whole `data` array only when the history changes, such as the first load or a pair switch.

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { TradingChart, type TradingChartHandle } from 'tradingcandle-react-native';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function fromBybit(rows: string[][] | undefined): Candle[] {
  return (rows ?? [])
    .filter(row => row.length >= 6)
    .map(row => ({
      time: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }))
    .filter(candle => Number.isFinite(candle.time))
    .sort((a, b) => a.time - b.time);
}

export function EthChart() {
  const chartRef = useRef<TradingChartHandle>(null);
  const [candles, setCandles] = useState<Candle[]>([]);

  useEffect(() => {
    const url =
      'https://api.bybit.com/v5/market/kline?category=spot&symbol=ETHUSDT&interval=30&limit=500';
    void fetch(url)
      .then(response => response.json())
      .then(body => setCandles(fromBybit(body.result?.list)));
  }, []);

  return (
    <View style={{ height: 640 }}>
      <TradingChart
        ref={chartRef}
        symbol="ETHUSDT"
        exchangeLabel=""
        marketType="Spot"
        interval="30m"
        data={candles}
        theme="dark"
        colors={{ up: '#26a65b', down: '#e5484d' }}
        indicators={['VOL', 'SMA']}
        showToolbar
        showTimeframeBar
        showVolume
      />
    </View>
  );
}
```

Bybit returns each row as `[start, open, high, low, close, volume, turnover]`, newest first. `fromBybit` above turns those strings into numbers and sorts them oldest first.

## Update the live candle

Call `updateCandle` on each tick. Do not replace `data` on every price.

```tsx
chartRef.current?.updateCandle({
  time: candle.time,
  open: candle.open,
  high: candle.high,
  low: candle.low,
  close: candle.close,
  volume: candle.volume,
});
```

The same `time` updates the last bar. A newer `time` starts the next bar.

Use `chartRef.current?.setData(candles)` when you load a new pair, such as switching from ETHUSDT to BTCUSDT. Set `key` on `TradingChart` to the pair name so the chart remounts.

## Depth

```tsx
<TradingChart
  chartType="depth"
  depth={{
    bids: [{ price: 2667.69, size: 12.4 }],
    asks: [{ price: 2668.01, size: 8.1 }],
  }}
/>
```

Bids are highest price first. Asks are lowest price first.
