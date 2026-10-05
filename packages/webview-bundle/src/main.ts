import {
  DEFAULT_COLORS,
  decodeMessage,
  encodeMessage,
  isHostMessage,
  resolvePalette,
} from 'tradingcandle-core';
import { createTradingChart, type TradingChartApi } from 'tradingcandle-web/engine';
import type {
  BridgeMessage,
  ChartColors,
  ChartToHostMessage,
  ChartType,
  HostToChartMessage,
  Interval,
  ScaleMode,
  ThemeName,
} from 'tradingcandle-core';

/** Set by the host before the page script runs so the first frame matches the app. */
type InitialOptions = {
  symbol?: string;
  exchangeLabel?: string;
  marketType?: string;
  interval?: Interval;
  intervals?: Interval[];
  indicators?: string[];
  theme?: ThemeName;
  colors?: Partial<ChartColors>;
  chartType?: ChartType;
  scale?: ScaleMode;
  showToolbar?: boolean;
  showTimeframeBar?: boolean;
  showVolume?: boolean;
};

type HostWindow = Window & {
  ReactNativeWebView?: { postMessage: (message: string) => void };
  webkit?: { messageHandlers?: { chart?: { postMessage: (message: string) => void } } };
  ChartBridge?: { postMessage: (message: string) => void };
  __twChartReceive?: (raw: string) => void;
  __twChartInit?: InitialOptions;
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

window.addEventListener('error', (event) => {
  post({ type: 'error', message: event.message || 'Chart script error' });
});

const init: InitialOptions = hostWindow.__twChartInit ?? {};
const theme: ThemeName = init.theme ?? 'light';
let pageTheme: ThemeName = theme;
let pageColors: ChartColors = { ...DEFAULT_COLORS, ...init.colors };

function paintPage(): void {
  const background = resolvePalette(pageTheme, pageColors).background;
  document.documentElement.style.background = background;
  document.body.style.background = background;
}
paintPage();

const root = document.getElementById('app');
if (!root) {
  throw new Error('Chart root is missing');
}

const api: TradingChartApi = createTradingChart(root, {
  symbol: init.symbol ?? 'BTCUSDT',
  exchangeLabel: init.exchangeLabel ?? '',
  marketType: init.marketType ?? 'Spot',
  interval: init.interval ?? '30m',
  intervals: init.intervals,
  data: [],
  indicators: init.indicators ?? ['VOL', 'SMA'],
  theme,
  colors: pageColors,
  chartType: init.chartType ?? 'candle',
  scale: init.scale ?? 'auto',
  showToolbar: init.showToolbar ?? true,
  showTimeframeBar: init.showTimeframeBar ?? true,
  showVolume: init.showVolume ?? true,
  embedded: true,
  smaPeriod: 9,
  volumeSmaPeriod: 9,
  onIntervalChange: (interval) => post({ type: 'intervalChange', interval }),
  onLoadMore: (oldestTime) => post({ type: 'loadMore', oldestTime }),
  onCrosshairMove: (candle) => post({ type: 'crosshair', candle }),
  onScreenshot: (dataUrl) => post({ type: 'screenshot', dataUrl }),
  onFullscreen: (enabled) => post({ type: 'fullscreen', enabled }),
  onError: (message) => post({ type: 'error', message }),
  onDataState: (hasData, count) => post({ type: 'dataState', hasData, count }),
  onChartTypeChange: (chartType) => post({ type: 'chartTypeChange', chartType }),
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
    case 'setIntervals':
      api.setIntervals(message.intervals);
      break;
    case 'setIndicators':
      api.setIndicators(message.indicators);
      break;
    case 'setTheme':
      api.setTheme(message.theme);
      pageTheme = message.theme;
      paintPage();
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
      pageColors = message.colors;
      paintPage();
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
  try {
    apply(message);
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
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
