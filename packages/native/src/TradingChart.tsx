import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import {
  CHART_INTERVALS,
  CHART_PALETTES,
  DEFAULT_COLORS,
  DEFAULT_INDICATORS,
  decodeMessage,
  encodeMessage,
  isChartMessage,
  resolvePalette,
  type Candle,
  type ChartColors,
  type ChartPaletteName,
  type ChartType,
  type DepthBook,
  type HostToChartMessage,
  type Interval,
  type ScaleMode,
  type ChartFeed,
  type ThemeName,
} from 'tradingcandle-core';
import { chartHtml } from './chartHtml';
import { useChartFeed, type FeedStatus } from './useChartFeed';

export type { Candle, Interval };

export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type TradingChartProps = {
  symbol?: string;
  exchangeLabel?: string;
  marketType?: string;
  interval?: Interval;
  /** Timeframe buttons to show. Leave out `1s` until the host feeds real 1-second bars. */
  intervals?: Interval[];
  data?: Candle[];
  depth?: DepthBook;
  /**
   * Where candles come from when `data` is left out.
   * `'bybit'` is the default. Pass `{ provider: 'custom', socketUrl }` for your own socket.
   * `wss://` is a raw WebSocket. `https://host/socket.io/` is Socket.IO v4.
   * If `data` is passed, the chart stays controlled and does not open a socket.
   */
  feed?: ChartFeed;
  /** Last traded price from the built-in feed. */
  onPrice?: (price: number) => void;
  /** Built-in feed connection state. */
  onConnectionChange?: (status: FeedStatus) => void;
  indicators?: string[];
  theme?: ThemeName;
  /** Built-in Light, Black, or Green chart colors. `theme` and `colors` override it. */
  palette?: ChartPaletteName;
  colors?: ChartColors;
  /**
   * Chart background. Same colors React Native accepts: `'red'`, `'#0d3b24'`, `'rgb(0, 0, 0)'`.
   * Wins over `colors.background`.
   */
  backgroundColor?: string;
  chartType?: ChartType;
  scale?: ScaleMode;
  showToolbar?: boolean;
  showTimeframeBar?: boolean;
  showVolume?: boolean;
  safeAreaInsets?: SafeAreaInsets;
  style?: StyleProp<ViewStyle>;
  /**
   * Overrides the built-in loader. When left out, the loader covers the chart until
   * candles for the current symbol and interval are on screen.
   */
  loading?: boolean;
  /** Custom loader. Defaults to a spinner on the theme background. */
  renderLoader?: () => ReactNode;
  /**
   * `inline` keeps the one WebView mounted and only reports `onFullscreen`; the host
   * grows the container. `modal` moves the chart into a Modal, which boots a second page.
   */
  fullscreenMode?: 'inline' | 'modal';
  onReady?: () => void;
  /** Called when the chart goes from no candles to candles on screen, or back. */
  onRendered?: (hasCandles: boolean) => void;
  onChartTypeChange?: (chartType: ChartType) => void;
  onIntervalChange?: (interval: Interval) => void;
  onLoadMore?: (oldestTime: number) => void;
  onCrosshairMove?: (candle: Candle | null) => void;
  onScreenshot?: (dataUrl: string) => void;
  onFullscreen?: (enabled: boolean) => void;
  onError?: (message: string) => void;
};

export type TradingChartHandle = {
  updateCandle: (candle: Candle) => void;
  setData: (data: Candle[]) => void;
  takeScreenshot: () => Promise<string>;
  setIndicators: (indicators: string[]) => void;
  clearDrawings: () => void;
  scrollToLatest: () => void;
  /** Reloads the chart page and replays the current symbol, candles, depth, and settings. */
  reload: () => void;
};

type WebRef = WebView;

/** Messages that the ready snapshot already replays, so they are not queued before ready. */
function chartTheme(current: TradingChartProps): ThemeName {
  return current.theme ?? (current.palette ? CHART_PALETTES[current.palette].theme : 'light');
}

function chartIntervals(current: TradingChartProps): Interval[] {
  return current.intervals?.length ? current.intervals : [...CHART_INTERVALS];
}

function chartIndicators(current: TradingChartProps): string[] {
  return current.indicators?.length ? current.indicators : [...DEFAULT_INDICATORS];
}

function resolvedColors(current: TradingChartProps): ChartColors {
  const preset = current.palette ? CHART_PALETTES[current.palette].colors : undefined;
  return {
    ...DEFAULT_COLORS,
    ...preset,
    ...current.colors,
    ...(current.backgroundColor ? { background: current.backgroundColor } : {}),
  };
}

/**
 * The boot options are written into the HTML. A WebView `key` remounts the page on
 * Android without re-running injectedJavaScriptBeforeContentLoaded, which dropped
 * backgroundColor and left the white default.
 */
/** Keep the color inside the stylesheet, so a theme rule cannot paint over it. */
function cssColor(value: string | undefined): string | null {
  if (!value) return null;
  const color = value.trim();
  if (/^(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/i.test(color)) {
    return color;
  }
  return null;
}

function chartDocument(current: TradingChartProps): string {
  const theme = chartTheme(current);
  const colors = resolvedColors(current);
  const background = cssColor(colors.background);
  const backgroundStyle = background
    ? `<style id="twc-page-bg">html,body,#app,.twc,.twc[data-theme="light"],.twc[data-theme="dark"]{background:${background} !important;--twc-bg:${background} !important}</style>`
    : '';
  const init = {
    symbol: current.symbol,
    exchangeLabel: current.exchangeLabel,
    marketType: current.marketType,
    interval: current.interval,
    intervals: chartIntervals(current),
    indicators: chartIndicators(current),
    theme,
    colors,
    chartType: current.chartType,
    scale: current.scale,
    showToolbar: current.showToolbar,
    showTimeframeBar: current.showTimeframeBar,
    showVolume: current.showVolume,
  };
  const payload = JSON.stringify(init).replace(/</g, '\\u003c');
  const boot = `${backgroundStyle}<script>window.__twChartInit=${payload};</script>`;
  return chartHtml.replace('</head>', `${boot}</head>`);
}

const SNAPSHOT_TYPES = new Set<HostToChartMessage['type']>([
  'setData',
  'updateCandle',
  'setDepth',
  'setInterval',
  'setIntervals',
  'setIndicators',
  'setTheme',
  'setSymbol',
  'setChartType',
  'setScale',
  'setColors',
  'setSafeArea',
]);

export const TradingChart = forwardRef<TradingChartHandle, TradingChartProps>(function TradingChart(
  props,
  ref,
) {
  const webRef = useRef<WebRef>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const readyRef = useRef(false);
  const queueRef = useRef<HostToChartMessage[]>([]);
  const shotRef = useRef<((dataUrl: string) => void) | null>(null);
  const dataRef = useRef<Candle[]>(props.data ?? []);
  const liveRef = useRef<Candle | null>(null);
  const indicatorsRef = useRef<string[]>(chartIndicators(props));
  const chartTypeRef = useRef<ChartType>(props.chartType ?? 'candle');
  const intervalRef = useRef<Interval>(props.interval ?? '30m');
  const depthRef = useRef<DepthBook>({ bids: [], asks: [] });
  const [fullscreen, setFullscreen] = useState(false);
  const { width, height } = useWindowDimensions();

  const theme = chartTheme(props);
  const colors = resolvedColors(props);
  const palette = resolvePalette(theme, colors);
  const background = palette.background;
  const dataKey = `${props.symbol ?? ''}|${props.interval ?? ''}`;
  const dataKeyRef = useRef(dataKey);
  dataKeyRef.current = dataKey;
  const [rendered, setRendered] = useState<{ key: string; hasData: boolean }>({
    key: '',
    hasData: false,
  });
  const showLoader = props.loading ?? !(rendered.key === dataKey && rendered.hasData);

  const pushNow = (message: HostToChartMessage) => {
    webRef.current?.postMessage(encodeMessage(message));
  };

  const post = (message: HostToChartMessage) => {
    if (!readyRef.current || !webRef.current) {
      if (!SNAPSHOT_TYPES.has(message.type)) queueRef.current.push(message);
      return;
    }
    pushNow(message);
  };

  const managed = props.data === undefined;
  const feed = useChartFeed(
    managed,
    props.feed ?? 'bybit',
    props.symbol ?? 'BTCUSDT',
    props.interval ?? '30m',
    {
      onCandle: (candle) => {
        liveRef.current = candle;
        post({ type: 'updateCandle', candle });
        propsRef.current.onPrice?.(candle.close);
      },
      onStatus: (status) => propsRef.current.onConnectionChange?.(status),
      onError: (message) => propsRef.current.onError?.(message),
    },
  );
  const loadMoreRef = useRef(feed.loadMore);
  loadMoreRef.current = feed.loadMore;
  const shownDepth = props.depth ?? (managed ? feed.depth : undefined);
  depthRef.current = shownDepth ?? { bids: [], asks: [] };

  const reload = () => {
    readyRef.current = false;
    setRendered({ key: '', hasData: false });
    webRef.current?.reload();
  };

  useImperativeHandle(
    ref,
    () => ({
      setData: (data) => {
        dataRef.current = data;
        liveRef.current = null;
        post({ type: 'setData', data });
      },
      updateCandle: (candle) => {
        liveRef.current = candle;
        post({ type: 'updateCandle', candle });
      },
      setIndicators: (indicators) => {
        indicatorsRef.current = indicators;
        post({ type: 'setIndicators', indicators });
      },
      clearDrawings: () => post({ type: 'clearDrawings' }),
      scrollToLatest: () => post({ type: 'scrollToLatest' }),
      reload,
      takeScreenshot: () =>
        new Promise((resolve) => {
          shotRef.current = resolve;
          post({ type: 'takeScreenshot' });
          setTimeout(() => {
            if (shotRef.current) {
              shotRef.current = null;
              resolve('');
            }
          }, 4000);
        }),
    }),
    [],
  );

  const sendSnapshot = () => {
    const current = propsRef.current;
    const messages: HostToChartMessage[] = [
      { type: 'setTheme', theme: chartTheme(current) },
      {
        type: 'setSymbol',
        symbol: current.symbol ?? 'BTCUSDT',
        exchangeLabel: current.exchangeLabel ?? '',
        marketType: current.marketType ?? 'Spot',
      },
      { type: 'setInterval', interval: intervalRef.current },
      { type: 'setIndicators', indicators: chartIndicators(current) },
      { type: 'setColors', colors: resolvedColors(current) },
      { type: 'setChartType', chartType: chartTypeRef.current },
      { type: 'setScale', scale: current.scale ?? 'auto' },
      { type: 'setData', data: dataRef.current },
      { type: 'setDepth', bids: depthRef.current.bids, asks: depthRef.current.asks },
    ];
    messages.splice(2, 0, { type: 'setIntervals', intervals: chartIntervals(current) });
    const live = liveRef.current;
    const last = dataRef.current[dataRef.current.length - 1];
    if (live && (!last || live.time >= last.time)) {
      messages.push({ type: 'updateCandle', candle: live });
    }
    if (current.safeAreaInsets) {
      messages.push({ type: 'setSafeArea', ...current.safeAreaInsets });
    }
    for (const message of messages) pushNow(message);
    const queued = queueRef.current.splice(0);
    for (const message of queued) pushNow(message);
  };

  useEffect(() => {
    liveRef.current = null;
  }, [props.symbol, props.interval]);

  useEffect(() => {
    if (props.data !== undefined) {
      dataRef.current = props.data;
      liveRef.current = null;
      post({ type: 'setData', data: props.data });
      return;
    }
    const next = feed.candles.slice();
    const live = liveRef.current;
    const last = next[next.length - 1];
    if (live && last && live.time === last.time) next[next.length - 1] = live;
    else if (live && (!last || live.time > last.time)) next.push(live);
    dataRef.current = next;
    post({ type: 'setData', data: next });
  }, [props.data, feed.candles]);

  useEffect(() => {
    post({ type: 'setDepth', bids: depthRef.current.bids, asks: depthRef.current.asks });
  }, [props.depth, feed.depth, managed]);

  useEffect(() => {
    if (!props.interval) return;
    intervalRef.current = props.interval;
    post({ type: 'setInterval', interval: props.interval });
  }, [props.interval]);

  useEffect(() => {
    post({ type: 'setIntervals', intervals: chartIntervals(props) });
  }, [props.intervals?.join('|')]);

  useEffect(() => {
    const indicators = chartIndicators(props);
    indicatorsRef.current = indicators;
    post({ type: 'setIndicators', indicators });
  }, [props.indicators?.join('|')]);

  useEffect(() => {
    post({ type: 'setTheme', theme: chartTheme(props) });
  }, [props.theme, props.palette]);

  useEffect(() => {
    if (props.symbol) {
      post({
        type: 'setSymbol',
        symbol: props.symbol,
        exchangeLabel: props.exchangeLabel,
        marketType: props.marketType,
      });
    }
  }, [props.symbol, props.exchangeLabel, props.marketType]);

  useEffect(() => {
    if (!props.chartType) return;
    chartTypeRef.current = props.chartType;
    post({ type: 'setChartType', chartType: props.chartType });
  }, [props.chartType]);

  useEffect(() => {
    if (props.scale) post({ type: 'setScale', scale: props.scale });
  }, [props.scale]);

  useEffect(() => {
    post({ type: 'setColors', colors: resolvedColors(props) });
  }, [
    props.colors?.up,
    props.colors?.down,
    props.colors?.background,
    props.colors?.text,
    props.colors?.grid,
    props.backgroundColor,
    props.palette,
  ]);

  useEffect(() => {
    if (props.safeAreaInsets) post({ type: 'setSafeArea', ...props.safeAreaInsets });
  }, [
    props.safeAreaInsets?.top,
    props.safeAreaInsets?.right,
    props.safeAreaInsets?.bottom,
    props.safeAreaInsets?.left,
  ]);

  useEffect(() => {
    if (!readyRef.current) return;
    webRef.current?.injectJavaScript('window.dispatchEvent(new Event("resize")); true;');
  }, [width, height, fullscreen]);

  const exitFullscreen = () => {
    setFullscreen(false);
    propsRef.current.onFullscreen?.(false);
    post({ type: 'setFullscreen', enabled: false });
  };

  useEffect(() => {
    if (!fullscreen || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      exitFullscreen();
      return true;
    });
    return () => subscription.remove();
  }, [fullscreen]);

  const documentHtml = useMemo(
    () => chartDocument(propsRef.current),
    [background, theme, props.palette, props.showToolbar, props.showTimeframeBar, props.showVolume],
  );

  const onMessage = (event: WebViewMessageEvent) => {
    const message = decodeMessage(event.nativeEvent.data);
    if (!message || !isChartMessage(message)) return;
    const current = propsRef.current;
    switch (message.type) {
      case 'ready':
        readyRef.current = true;
        sendSnapshot();
        current.onReady?.();
        break;
      case 'dataState':
        setRendered({ key: dataKeyRef.current, hasData: message.hasData });
        current.onRendered?.(message.hasData);
        break;
      case 'chartTypeChange':
        chartTypeRef.current = message.chartType;
        current.onChartTypeChange?.(message.chartType);
        break;
      case 'intervalChange':
        intervalRef.current = message.interval;
        current.onIntervalChange?.(message.interval);
        break;
      case 'loadMore':
        if (current.data === undefined) loadMoreRef.current(message.oldestTime);
        else current.onLoadMore?.(message.oldestTime);
        break;
      case 'crosshair':
        current.onCrosshairMove?.(message.candle);
        break;
      case 'screenshot':
        current.onScreenshot?.(message.dataUrl);
        shotRef.current?.(message.dataUrl);
        shotRef.current = null;
        break;
      case 'fullscreen':
        setFullscreen(message.enabled);
        current.onFullscreen?.(message.enabled);
        break;
      case 'error':
        current.onError?.(message.message);
        break;
      default:
        break;
    }
  };

  const webStyle = [styles.web, Platform.OS === 'ios' && styles.iosComposite, { backgroundColor: background }];
  const web = (
    <WebView
      key={background}
      ref={webRef}
      cacheEnabled={false}
      source={{ html: documentHtml, baseUrl: 'https://localhost' }}
      originWhitelist={['*']}
      onMessage={onMessage}
      onLoadStart={() => {
        readyRef.current = false;
      }}
      onError={(event) => propsRef.current.onError?.(event.nativeEvent.description || 'Chart failed to load')}
      onHttpError={(event) =>
        propsRef.current.onError?.(`Chart failed to load (${event.nativeEvent.statusCode})`)
      }
      onContentProcessDidTerminate={reload}
      onRenderProcessGone={reload}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      setBuiltInZoomControls={false}
      setDisplayZoomControls={false}
      androidLayerType="hardware"
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      allowsInlineMediaPlayback
      style={webStyle}
      containerStyle={webStyle}
    />
  );

  const loader = showLoader ? (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.loader, { backgroundColor: background }]}>
      {props.renderLoader ? props.renderLoader() : <ActivityIndicator color={palette.muted} />}
    </View>
  ) : null;

  const inModal = fullscreen && props.fullscreenMode === 'modal';

  return (
    <View style={[styles.fill, { backgroundColor: background }, props.style]}>
      {inModal ? null : web}
      {inModal ? null : loader}
      {props.fullscreenMode === 'modal' ? (
        <Modal
          visible={fullscreen}
          animationType="fade"
          onRequestClose={exitFullscreen}
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        >
          <View
            style={[
              styles.modal,
              {
                backgroundColor: background,
                paddingTop: props.safeAreaInsets?.top ?? 0,
                paddingBottom: props.safeAreaInsets?.bottom ?? 0,
              },
            ]}
          >
            {inModal ? web : null}
            {inModal ? loader : null}
          </View>
        </Modal>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 320 },
  web: { flex: 1 },
  iosComposite: { opacity: 0.99 },
  modal: { flex: 1 },
  loader: { alignItems: 'center', justifyContent: 'center' },
});
