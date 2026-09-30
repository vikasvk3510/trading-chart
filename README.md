# Bybit-style trading chart

A chart library for React, React Native, and native WebView hosts. The candles, volume, crosshair, and drawings are drawn by [KLineChart](https://github.com/klinecharts/KLineChart) (Apache-2.0). The timeframes, left toolbar, legend, and bottom bar are this project's UI, laid out like a Bybit spot chart.

TradingView Advanced Charts is not used, and the TradingView mark is not drawn.

Copy-paste React Native setup is in [USAGE.md](./USAGE.md).

## Packages

| Package | Use |
| --- | --- |
| `@talkwallet/chart-core` | Candle type, Bybit/Binance converters, bridge messages |
| `@talkwallet/chart-web` | React component for the browser and Next.js |
| `tradingcandle-react-native` | React Native component. One inline HTML file, no network to boot the chart |

## Install

```bash
npm install @talkwallet/chart-core @talkwallet/chart-web
# React Native
npm install tradingcandle-react-native react-native-webview
```

Peer dependencies: `react` and `react-dom` for web. `react`, `react-native`, and `react-native-webview` for native.

## Web

```tsx
import { useEffect, useState } from 'react';
import { fromBybit, bybitKlineUrl, type Candle } from '@talkwallet/chart-core';
import { TradingChart } from '@talkwallet/chart-web';

export function Chart() {
  const [data, setData] = useState<Candle[]>([]);
  useEffect(() => {
    const url = bybitKlineUrl('BTCUSDT', '30m', 500);
    if (!url) return;
    void fetch(url)
      .then((response) => response.json())
      .then((body) => setData(fromBybit(body.result?.list)));
  }, []);

  return (
    <div style={{ height: 640 }}>
      <TradingChart
        symbol="BTCUSDT"
        exchangeLabel="Bybit"
        marketType="Spot"
        interval="30m"
        data={data}
        indicators={['VOL', 'SMA']}
        theme="dark"
        colors={{ up: '#26a65b', down: '#e5484d' }}
        showToolbar
        showTimeframeBar
        showVolume
        onIntervalChange={() => {}}
        onLoadMore={() => {}}
        onCrosshairMove={() => {}}
      />
    </div>
  );
}
```

The parent must give the chart a height. Importing `@talkwallet/chart-web` does not touch `window` or `document`. KLineChart loads after mount, so the component is safe to import from a Next.js server component tree as long as you render it on the client.

Live bars should go through the ref, so the chart updates the last candle instead of reloading history:

```tsx
chartRef.current?.updateCandle(candle);
```

## Props

| Prop | Type | Default |
| --- | --- | --- |
| `symbol` | `string` | `BTCUSDT` |
| `exchangeLabel` | `string` | `Bybit` |
| `marketType` | `string` | `Spot` |
| `interval` | `1s \| 1m \| 5m \| 15m \| 30m \| 1h \| 4h \| 1d \| 1w \| 1M` | `30m` |
| `data` | `Candle[]` | `[]` |
| `indicators` | `string[]` | `['VOL', 'SMA']` |
| `theme` | `dark \| light` | `dark` |
| `colors` | `{ up, down }` | `#26a65b` / `#e5484d` |
| `showToolbar` | `boolean` | `true` |
| `showTimeframeBar` | `boolean` | `true` |
| `showVolume` | `boolean` | `true` |
| `onIntervalChange` | `(interval) => void` | |
| `onLoadMore` | `(oldestTime) => void` | |
| `onCrosshairMove` | `(candle \| null) => void` | |

Native also accepts `safeAreaInsets`.

## Ref

| Method | Behavior |
| --- | --- |
| `setData(list)` | Replace history. Prepended bars keep the current scroll position |
| `updateCandle(candle)` | Replace the bar with the same open time, or append a newer one |
| `takeScreenshot()` | PNG data URL. On the web toolbar button this also downloads a file |
| `setIndicators(list)` | `VOL`, `SMA`, `EMA`, `BOLL`, `MACD`, `RSI`, `KDJ` |
| `clearDrawings()` | Remove drawings |
| `scrollToLatest()` | Scroll to the last bar |

`takeScreenshot` returns a string on the web and a `Promise<string>` on React Native.

## Candle format

```ts
type Candle = {
  time: number; // open time, milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
};
```

```ts
fromBybit(rows); // [start, open, high, low, close, volume, turnover] strings, newest first
fromBinance(rows);
mergeCandle(list, next);
sma(values, 9);
```

`fromBybit` sorts oldest first. Bybit's REST kline endpoint has no `1s` interval. The demos build 1-second bars from `publicTrade`.

## Bridge

React Native and a Kotlin or Swift WebView use the same JSON messages.

Host to chart:

`setData`, `updateCandle`, `setInterval`, `setIndicators`, `setTheme`, `setSymbol`, `setChartType`, `setScale`, `setColors`, `takeScreenshot`, `clearDrawings`, `scrollToLatest`, `scrollToTimestamp`, `setRange`, `setLocked`, `setFullscreen`, `setSafeArea`

Chart to host:

`ready`, `intervalChange`, `loadMore`, `crosshair`, `screenshot`, `fullscreen`, `error`

```ts
import { encodeMessage, decodeMessage } from '@talkwallet/chart-core';
```

The page posts with, in order: `window.ReactNativeWebView.postMessage`, `webkit.messageHandlers.chart.postMessage`, `ChartBridge.postMessage`, then `window.parent.postMessage`. The host delivers a message by calling `window.__twChartReceive(json)`. React Native also delivers through the `message` event inside the page.

### Android

```kotlin
webView.settings.javaScriptEnabled = true
webView.addJavascriptInterface(object {
    @JavascriptInterface
    fun postMessage(json: String) {
        // chart -> app. json is a ChartToHostMessage
    }
}, "ChartBridge")
webView.loadDataWithBaseURL("https://localhost", html, "text/html", "utf-8", null)

fun send(json: String) {
    val quoted = org.json.JSONObject.quote(json)
    webView.evaluateJavascript("window.__twChartReceive($quoted)", null)
}
```

`html` is the file `chart.html` shipped in `tradingcandle-react-native`, or the `chartHtml` string export.

### iOS

```swift
let controller = WKUserContentController()
controller.add(self, name: "chart")
let config = WKWebViewConfiguration()
config.userContentController = controller
let webView = WKWebView(frame: .zero, configuration: config)
webView.loadHTMLString(html, baseURL: URL(string: "https://localhost"))

func send(json: String) {
    let quoted = json.unicodeScalars.map { $0.escaped(asASCII: false) }
    webView.evaluateJavaScript("window.__twChartReceive(\(jsonStringAsJsLiteral))")
}

func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    // message.body is the chart -> app JSON string
}
```

Pass the JSON through a JavaScript string literal, not raw interpolation, so quotes in the payload stay valid.

Touch: one finger pans, pinch zooms, and a press shows the crosshair. KLineChart owns those gestures. The WebView has `scrollEnabled` off so the page itself does not steal the pinch. Fullscreen asks the React Native host to present a modal. Android's hardware back exits that modal. Padding from `safeAreaInsets` is applied inside the page. A window resize, including orientation change, calls `chart.resize()` and keeps the loaded candles.

## Run the demos

From this repo:

```bash
pnpm install
pnpm --filter @talkwallet/chart-core test
pnpm --filter @talkwallet/chart-web build
pnpm --filter web-demo dev
```

Open the Vite URL. The demo loads Bybit spot klines and subscribes to `wss://stream.bybit.com/v5/public/spot`.

```bash
pnpm --filter @talkwallet/chart-webview build
pnpm --filter tradingcandle-react-native build
pnpm --filter rn-demo start
```

Then open iOS or Android from Expo.

## What is close, not identical

- Brush uses KLineChart's built-in freehand overlay.
- Emoji places one character. There is no sticker library.
- Pattern is a five-point XABCD polyline, not the full pattern catalog.
- Measure is a two-point overlay with price change, percent, and bar count.
- The 1s button has no Bybit REST interval. Aggregate trades, as the demos do.
- Icons are original. The TradingView watermark is not copied.

`SMA` on the price pane is KLineChart's `MA` indicator (a simple moving average). KLineChart's indicator named `SMA` is a different smoothed formula, so this library does not use that one for the SMA button. Volume SMA 9 is the `VOL` indicator with period 9.

## Scripts

```bash
pnpm build
pnpm test
pnpm lint
```

Publishing steps are in [PUBLISHING.md](PUBLISHING.md).

## License

Apache-2.0. KLineChart is also Apache-2.0. See [LICENSE](LICENSE).
