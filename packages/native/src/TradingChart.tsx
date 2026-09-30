import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
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
  DEFAULT_COLORS,
  decodeMessage,
  encodeMessage,
  isChartMessage,
  type Candle,
  type ChartColors,
  type ChartType,
  type DepthBook,
  type HostToChartMessage,
  type Interval,
  type ScaleMode,
  type ThemeName,
} from 'tradingcandle-core';
import { chartHtml } from './chartHtml';

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
  data?: Candle[];
  depth?: DepthBook;
  indicators?: string[];
  theme?: ThemeName;
  colors?: ChartColors;
  chartType?: ChartType;
  scale?: ScaleMode;
  showToolbar?: boolean;
  showTimeframeBar?: boolean;
  showVolume?: boolean;
  safeAreaInsets?: SafeAreaInsets;
  style?: StyleProp<ViewStyle>;
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
};

type WebRef = WebView;

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
  const [fullscreen, setFullscreen] = useState(false);
  const { width, height } = useWindowDimensions();

  const post = (message: HostToChartMessage) => {
    if (!readyRef.current || !webRef.current) {
      queueRef.current.push(message);
      return;
    }
    webRef.current.postMessage(encodeMessage(message));
  };

  const pushNow = (message: HostToChartMessage) => {
    webRef.current?.postMessage(encodeMessage(message));
  };

  useImperativeHandle(
    ref,
    () => ({
      setData: (data) => post({ type: 'setData', data }),
      updateCandle: (candle) => post({ type: 'updateCandle', candle }),
      setIndicators: (indicators) => post({ type: 'setIndicators', indicators }),
      clearDrawings: () => post({ type: 'clearDrawings' }),
      scrollToLatest: () => post({ type: 'scrollToLatest' }),
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
      { type: 'setTheme', theme: current.theme ?? 'dark' },
      {
        type: 'setSymbol',
        symbol: current.symbol ?? 'BTCUSDT',
        exchangeLabel: current.exchangeLabel ?? '',
        marketType: current.marketType ?? 'Spot',
      },
      { type: 'setInterval', interval: current.interval ?? '30m' },
      { type: 'setIndicators', indicators: current.indicators ?? ['VOL', 'SMA'] },
      { type: 'setColors', colors: { ...DEFAULT_COLORS, ...current.colors } },
      { type: 'setChartType', chartType: current.chartType ?? 'candle' },
      { type: 'setScale', scale: current.scale ?? 'auto' },
      { type: 'setData', data: current.data ?? [] },
      { type: 'setDepth', bids: current.depth?.bids ?? [], asks: current.depth?.asks ?? [] },
    ];
    if (current.safeAreaInsets) {
      messages.push({ type: 'setSafeArea', ...current.safeAreaInsets });
    }
    for (const message of messages) pushNow(message);
    const queued = queueRef.current.splice(0);
    for (const message of queued) pushNow(message);
  };

  useEffect(() => {
    post({ type: 'setData', data: props.data ?? [] });
  }, [props.data]);

  useEffect(() => {
    post({ type: 'setDepth', bids: props.depth?.bids ?? [], asks: props.depth?.asks ?? [] });
  }, [props.depth]);

  useEffect(() => {
    if (props.interval) post({ type: 'setInterval', interval: props.interval });
  }, [props.interval]);

  useEffect(() => {
    if (props.indicators) post({ type: 'setIndicators', indicators: props.indicators });
  }, [props.indicators?.join('|')]);

  useEffect(() => {
    if (props.theme) post({ type: 'setTheme', theme: props.theme });
  }, [props.theme]);

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
    if (props.chartType) post({ type: 'setChartType', chartType: props.chartType });
  }, [props.chartType]);

  useEffect(() => {
    if (props.scale) post({ type: 'setScale', scale: props.scale });
  }, [props.scale]);

  useEffect(() => {
    if (props.colors) post({ type: 'setColors', colors: { ...DEFAULT_COLORS, ...props.colors } });
  }, [props.colors?.up, props.colors?.down]);

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

  useEffect(() => {
    if (!fullscreen || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setFullscreen(false);
      propsRef.current.onFullscreen?.(false);
      post({ type: 'setFullscreen', enabled: false });
      return true;
    });
    return () => subscription.remove();
  }, [fullscreen]);

  const onMessage = (event: WebViewMessageEvent) => {
    const message = decodeMessage(event.nativeEvent.data);
    if (!message || !isChartMessage(message)) return;
    const current = propsRef.current;
    switch (message.type) {
      case 'ready':
        readyRef.current = true;
        sendSnapshot();
        break;
      case 'intervalChange':
        current.onIntervalChange?.(message.interval);
        break;
      case 'loadMore':
        current.onLoadMore?.(message.oldestTime);
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

  const web = (
    <WebView
      key={chartHtml.length}
      ref={webRef}
      cacheEnabled={false}
      source={{ html: chartHtml, baseUrl: 'https://localhost' }}
      originWhitelist={['*']}
      onMessage={onMessage}
      onLoadStart={() => {
        readyRef.current = false;
      }}
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
      style={styles.web}
      containerStyle={styles.web}
    />
  );

  return (
    <View style={[styles.fill, props.style]}>
      {fullscreen ? <View style={styles.fill} /> : web}
      <Modal
        visible={fullscreen}
        animationType="fade"
        onRequestClose={() => {
          setFullscreen(false);
          propsRef.current.onFullscreen?.(false);
          post({ type: 'setFullscreen', enabled: false });
        }}
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      >
        <View
          style={[
            styles.modal,
            {
              paddingTop: props.safeAreaInsets?.top ?? 0,
              paddingBottom: props.safeAreaInsets?.bottom ?? 0,
            },
          ]}
        >
          {fullscreen ? web : null}
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 320, backgroundColor: '#0b0e11' },
  web: { flex: 1, backgroundColor: '#0b0e11' },
  modal: { flex: 1, backgroundColor: '#0b0e11' },
});
