export type Candle = {
  /** Bar open time in milliseconds. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
};

export type Interval =
  | '1s'
  | '1m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '4h'
  | '1d'
  | '1w'
  | '1M';

export type ChartType = 'candle' | 'line' | 'area' | 'bar' | 'depth';

export type DepthLevel = {
  price: number;
  size: number;
};

/** Bids are highest price first. Asks are lowest price first. */
export type DepthBook = {
  bids: DepthLevel[];
  asks: DepthLevel[];
};

export type ThemeName = 'dark' | 'light';

/** `auto` fits the visible range on a linear axis. */
export type ScaleMode = 'auto' | 'percentage' | 'log';

export type RangePreset = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y';

export type MagnetMode = 'normal' | 'weak_magnet' | 'strong_magnet';

export type DrawingTool =
  | 'crosshair'
  | 'trendLine'
  | 'channel'
  | 'fib'
  | 'pattern'
  | 'brush'
  | 'text'
  | 'emoji'
  | 'ruler'
  | 'zoom'
  | 'magnet'
  | 'lock'
  | 'delete';

export type IndicatorName = 'VOL' | 'SMA' | 'EMA' | 'BOLL' | 'MACD' | 'RSI' | 'KDJ';

export type MarketType = 'Spot' | 'Linear' | 'Inverse' | string;

export type ChartColors = {
  up: string;
  down: string;
  /** Page, chart, and depth background. Defaults to the theme background. */
  background?: string;
  /** Labels, legend, and axis text. Derived from `background` when left out. */
  text?: string;
  /** Grid lines, separators, and borders. Derived from `text` when left out. */
  grid?: string;
};

export const DEFAULT_COLORS: ChartColors = {
  up: '#26a65b',
  down: '#e5484d',
};

export const INTERVALS: readonly Interval[] = [
  '1s',
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1d',
  '1w',
  '1M',
];

export const RANGE_PRESETS: readonly RangePreset[] = ['1D', '5D', '1M', '3M', '6M', '1Y'];

/** Duration of one bar. One month is a 30-day approximation used for range math. */
export const INTERVAL_MS: Record<Interval, number> = {
  '1s': 1_000,
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '1w': 7 * 24 * 60 * 60_000,
  '1M': 30 * 24 * 60 * 60_000,
};

/**
 * Bybit v5 kline interval. `null` for 1s because the REST kline endpoint
 * does not accept a 1-second interval.
 */
export const BYBIT_INTERVAL: Record<Interval, string | null> = {
  '1s': null,
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
  '1w': 'W',
  '1M': 'M',
};

export const RANGE_MS: Record<RangePreset, number> = {
  '1D': 24 * 60 * 60 * 1000,
  '5D': 5 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  '3M': 90 * 24 * 60 * 60 * 1000,
  '6M': 182 * 24 * 60 * 60 * 1000,
  '1Y': 365 * 24 * 60 * 60 * 1000,
};

export const MAIN_INDICATORS: readonly IndicatorName[] = ['SMA', 'EMA', 'BOLL'];
export const SUB_INDICATORS: readonly IndicatorName[] = ['VOL', 'MACD', 'RSI', 'KDJ'];

export function isInterval(value: string): value is Interval {
  return (INTERVALS as readonly string[]).includes(value);
}

export function intervalLabel(interval: Interval): string {
  if (interval === '1M') return '1M';
  return interval;
}

/** Short label used in the OHLC legend, matching Bybit (`30` for 30m). */
export function legendIntervalLabel(interval: Interval): string {
  switch (interval) {
    case '1s':
      return '1s';
    case '1m':
      return '1';
    case '5m':
      return '5';
    case '15m':
      return '15';
    case '30m':
      return '30';
    case '1h':
      return '60';
    case '4h':
      return '240';
    case '1d':
      return '1D';
    case '1w':
      return '1W';
    case '1M':
      return '1M';
    default:
      return interval;
  }
}
