import type { CSSProperties } from 'react';
import type {
  Candle,
  ChartColors,
  ChartType,
  DepthBook,
  Interval,
  ScaleMode,
  ThemeName,
} from '@talkwallet/chart-core';

export type TradingChartOptions = {
  symbol: string;
  exchangeLabel: string;
  marketType: string;
  interval: Interval;
  data: Candle[];
  indicators: string[];
  theme: ThemeName;
  colors: ChartColors;
  chartType: ChartType;
  scale: ScaleMode;
  showToolbar: boolean;
  showTimeframeBar: boolean;
  showVolume: boolean;
  /** True inside React Native / native WebView. Fullscreen is delegated to the host. */
  embedded: boolean;
  smaPeriod: number;
  volumeSmaPeriod: number;
  onIntervalChange?: (interval: Interval) => void;
  onLoadMore?: (oldestTime: number) => void;
  onCrosshairMove?: (candle: Candle | null) => void;
  onScreenshot?: (dataUrl: string) => void;
  onFullscreen?: (enabled: boolean) => void;
  onError?: (message: string) => void;
};

export type TradingChartApi = {
  setData: (data: Candle[]) => void;
  updateCandle: (candle: Candle) => void;
  setInterval: (interval: Interval) => void;
  setIndicators: (indicators: string[]) => void;
  setShowVolume: (show: boolean) => void;
  setTheme: (theme: ThemeName) => void;
  setSymbol: (symbol: string, exchangeLabel?: string, marketType?: string) => void;
  setChartType: (chartType: ChartType) => void;
  setDepth: (book: DepthBook) => void;
  setScale: (scale: ScaleMode) => void;
  setColors: (colors: ChartColors) => void;
  takeScreenshot: () => string;
  clearDrawings: () => void;
  scrollToLatest: () => void;
  scrollToTimestamp: (time: number) => void;
  setRange: (rangeMs: number) => void;
  setLocked: (locked: boolean) => void;
  setFullscreen: (enabled: boolean) => void;
  setSafeArea: (insets: { top: number; right: number; bottom: number; left: number }) => void;
  resize: () => void;
  destroy: () => void;
};

export type TradingChartProps = {
  symbol?: string;
  exchangeLabel?: string;
  marketType?: string;
  interval?: Interval;
  data?: Candle[];
  indicators?: string[];
  theme?: ThemeName;
  colors?: ChartColors;
  chartType?: ChartType;
  scale?: ScaleMode;
  showToolbar?: boolean;
  showTimeframeBar?: boolean;
  showVolume?: boolean;
  smaPeriod?: number;
  volumeSmaPeriod?: number;
  className?: string;
  style?: CSSProperties;
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
  takeScreenshot: () => string;
  setIndicators: (indicators: string[]) => void;
  clearDrawings: () => void;
  scrollToLatest: () => void;
};
