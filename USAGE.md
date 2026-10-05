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
        theme="light"
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

## Change pair

Do not set `key` to the pair. A new key reloads the page. Change `symbol` and pass the new `data` (or call `chartRef.current?.setData(candles)`). The chart clears the previous pair's candles and book as soon as `symbol` changes, so the old market never lingers.

## Loader

The chart covers itself with a loader on the theme background until candles for the current `symbol` and `interval` are on screen. It shows again on pair or interval change.

- `renderLoader={() => <YourLottie />}` replaces the spinner.
- `loading={false}` hides it, for example when history came back empty or failed and you show your own retry.
- `onRendered(hasCandles)` and `onReady()` report the same moments if you draw the loader yourself.

The page paints white first (`theme` defaults to `light`). The WebView uses the theme background and `opacity: 0.99`, so it composites inside a ScrollView on iOS.

## Colors

`palette` selects a built-in set of theme and candle colors: `"Light"`, `"Black"`, or `"Green"`. The chart also hides the `1s` button unless you pass `intervals`.

```tsx
<TradingChart palette="Black" />
<TradingChart palette="Green" />
```

`backgroundColor` sets the chart background on its own. It takes the same values as a React Native style: a name, hex, or `rgb()`.

```tsx
<TradingChart backgroundColor="red" />
<TradingChart backgroundColor="#0d3b24" />
```

`colors` takes the candle colors and, optionally, the chart's background, text, and grid. `backgroundColor` wins when both are set.

```tsx
<TradingChart
  theme="dark"
  colors={{
    up: '#20b26c',
    down: '#ef454a',
    background: '#000000', // chart, depth, toolbar, loader, and WebView background
    text: '#e8fff1',       // optional: labels and axis text
    grid: '#1f5c3d',       // optional: grid lines and borders
  }}
/>
```

Leave out `text` and `grid` and the chart picks readable ones from `background`: light text on a dark color, dark text on a light one. Leave out `background` and the `theme` background is used (white for `light`, `#0b0e11` for `dark`). The same colors apply to volume bars and the depth view.

## Reload and errors

`chartRef.current?.reload()` reloads the page and replays the symbol, candles, live bar, depth, interval, indicators, and the user's chart type. If the WebView process is killed, the chart reloads itself. `onError(message)` reports script and load errors.

## Intervals

Leave `1s` out of `intervals` unless you feed real 1-second bars:

```tsx
<TradingChart intervals={['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M']} />
```

## Market data

Leave `data` out and the chart loads Bybit spot candles, trades, and the order book itself. `onPrice` is the last price. `onConnectionChange` is `'connecting'`, `'live'`, or `'offline'`.

```tsx
<TradingChart
  symbol="BTCUSDT"
  interval={interval}
  onIntervalChange={setInterval}
  onPrice={setPrice}
  onConnectionChange={setStatus}
/>
```

`feed="bybit"` is the default. A custom socket replaces it:

```tsx
<TradingChart
  symbol="BTC_USDT"
  interval={interval}
  onIntervalChange={setInterval}
  feed={{
    provider: 'custom',
    socketUrl: 'wss://example.com/candles',
    historyUrl: 'https://example.com/klines',
  }}
/>
```

`https://host/socket.io/` is opened as Socket.IO v4. A `wss://` URL is a raw WebSocket. Set `event` to the Socket.IO event that carries candles, and `subscribe` when the server expects a join message. `{symbol}` and `{interval}` inside that message are filled in. History responses can be a Bybit kline body, `{ data: Candle[] }`, `{ candles: Candle[] }`, or a candle array. Live messages can be one candle or `{ bids, asks }`.

Pass `data` and the chart stays controlled: it does not open a socket. `onLoadMore` is then yours.

## Load older bars

With the built-in feed, scrolling to the left edge loads older bars from `historyUrl` or Bybit. In controlled mode, `onLoadMore(oldestTime)` fires and you pass the merged array, older bars first, as `data` or through `setData`.

## Crosshair

`onCrosshairMove(candle)` fires with the bar under the finger, and with `null` when the crosshair clears. Live ticks do not clear an active crosshair.

## Fullscreen

`fullscreenMode="inline"` (the default) keeps the one WebView mounted and calls `onFullscreen(enabled)`. Grow the chart's container when it is `true`. `fullscreenMode="modal"` moves the chart into a `Modal`, which boots a second page and loses drawings.

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

Bids are highest price first. Asks are lowest price first. Push each order-book update into `depth`. Until the book has levels, depth mode shows "Loading order book…" on the theme background.
