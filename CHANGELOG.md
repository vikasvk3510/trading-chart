# Changelog

## 0.2.0

`@vkpackge/tradingcandle-react-native`

- The chart script ships as a classic `<script>` at the end of `<body>`, not `type="module"`, so it runs in iOS WKWebView.
- The page paints white first. `theme` defaults to `light`. The WebView uses the theme background and `opacity: 0.99`.
- A built-in loader covers the chart until candles are on screen, and again on pair or interval change. New `loading` and `renderLoader` props.
- New `onReady`, `onRendered`, and `onChartTypeChange` callbacks, and `reload()` on the handle. Reload replays the current state.
- Changing `symbol` clears the previous pair's candles and book right away, with no remount.
- New `intervals` prop to hide timeframe buttons, such as `1s`.
- Depth follows the theme, sorts the book, and shows "Loading order book…" instead of a black "Waiting for depth".
- Live ticks no longer clear an active crosshair. `onCrosshairMove` only fires when the hovered bar changes.
- Fullscreen keeps the same WebView by default (`fullscreenMode="inline"`). `modal` is still available.
- The chart reloads itself when the WebView process is killed. Load and script errors reach `onError`.
- `colors` accepts `background`, `text`, and `grid`, so the chart can use any background shade. Text and grid are derived from `background` when left out. Volume bars use `up` and `down`.
- `palette` is `Light`, `Black`, or `Green`. `backgroundColor` accepts the same color strings as React Native.
- Default indicators are `VOL` and `SMA`. The default timeframe bar starts at `1m`.
- Leave `data` out and the chart loads Bybit spot candles and the order book. `feed` can be a custom `socketUrl` (`wss://` or Socket.IO `https://…/socket.io/`) plus an optional `historyUrl`.
- `tradingcandle-core` exports `resolvePalette`, `parseColor`, and `withAlpha`.

## 0.1.0

First public release of the Bybit-style chart packages.

- `tradingcandle-core` candle type, Bybit and Binance converters, SMA, and the WebView message protocol
- `tradingcandle-web` React chart on KLineChart with timeframes, drawings, indicators, and a volume pane
- `tradingcandle-react-native` React Native wrapper that loads one inline HTML file in `react-native-webview`
