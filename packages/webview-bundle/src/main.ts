import { DEFAULT_COLORS, decodeMessage, encodeMessage, isHostMessage } from 'tradingcandle-core';
import { createTradingChart, type TradingChartApi } from 'tradingcandle-web/engine';
import type { BridgeMessage, ChartToHostMessage, HostToChartMessage } from 'tradingcandle-core';

type HostWindow = Window & {
  ReactNativeWebView?: { postMessage: (message: string) => void };
  webkit?: { messageHandlers?: { chart?: { postMessage: (message: string) => void } } };
  ChartBridge?: { postMessage: (message: string) => void };
  __twChartReceive?: (raw: string) => void;
};

const hostWindow = window as HostWindow;

function post(message: ChartToHostMessage): void {
  const raw = encodeMessage(message);
  if (hostWindow.ReactNativeWebView?.postMessage) {
    hostWindow.ReactNativeWebView.postMessage(raw);
    return;
  }
  if (hostWindow.webkit?.messageHandlers?.chart?.postMessage) {
    hostWindow.webkit.messageHandlers.chart.postMessage(raw);
    return;
  }
  if (hostWindow.ChartBridge?.postMessage) {
    hostWindow.ChartBridge.postMessage(raw);
    return;
  }
  window.parent.postMessage(raw, '*');
}

const root = document.getElementById('app');
if (!root) {
  throw new Error('Chart root is missing');
}

const api: TradingChartApi = createTradingChart(root, {
  symbol: 'BTCUSDT',
  exchangeLabel: '',
  marketType: 'Spot',
  interval: '30m',
  data: [],
  indicators: ['VOL', 'SMA'],
  theme: 'dark',
  colors: DEFAULT_COLORS,
  chartType: 'candle',
  scale: 'auto',
  showToolbar: true,
  showTimeframeBar: true,
  showVolume: true,
  embedded: true,
  smaPeriod: 9,
  volumeSmaPeriod: 9,
  onIntervalChange: (interval) => post({ type: 'intervalChange', interval }),
  onLoadMore: (oldestTime) => post({ type: 'loadMore', oldestTime }),
  onCrosshairMove: (candle) => post({ type: 'crosshair', candle }),
  onScreenshot: (dataUrl) => post({ type: 'screenshot', dataUrl }),
  onFullscreen: (enabled) => post({ type: 'fullscreen', enabled }),
  onError: (message) => post({ type: 'error', message }),
});

function apply(message: HostToChartMessage): void {
  switch (message.type) {
    case 'setData':
      api.setData(message.data);
      break;
    case 'updateCandle':
      api.updateCandle(message.candle);
      break;
    case 'setInterval':
      api.setInterval(message.interval);
      break;
    case 'setIndicators':
      api.setIndicators(message.indicators);
      break;
    case 'setTheme':
      api.setTheme(message.theme);
      break;
    case 'setSymbol':
      api.setSymbol(message.symbol, message.exchangeLabel, message.marketType);
      break;
    case 'setChartType':
      api.setChartType(message.chartType);
      break;
    case 'setDepth':
      api.setDepth({ bids: message.bids, asks: message.asks });
      break;
    case 'setScale':
      api.setScale(message.scale);
      break;
    case 'setColors':
      api.setColors(message.colors);
      break;
    case 'takeScreenshot':
      api.takeScreenshot();
      break;
    case 'clearDrawings':
      api.clearDrawings();
      break;
    case 'scrollToLatest':
      api.scrollToLatest();
      break;
    case 'scrollToTimestamp':
      api.scrollToTimestamp(message.time);
      break;
    case 'setRange':
      api.setRange(message.rangeMs);
      break;
    case 'setLocked':
      api.setLocked(message.locked);
      break;
    case 'setFullscreen':
      api.setFullscreen(message.enabled);
      break;
    case 'setSafeArea':
      api.setSafeArea(message);
      break;
    default:
      break;
  }
}

function receive(raw: string): void {
  const message: BridgeMessage | null = decodeMessage(raw);
  if (!message || !isHostMessage(message)) return;
  apply(message);
}

hostWindow.__twChartReceive = receive;

window.addEventListener('message', (event: MessageEvent) => {
  if (typeof event.data === 'string') receive(event.data);
});
document.addEventListener('message', ((event: Event) => {
  const data = (event as MessageEvent).data;
  if (typeof data === 'string') receive(data);
}) as EventListener);

window.addEventListener('resize', () => api.resize());
post({ type: 'ready' });
