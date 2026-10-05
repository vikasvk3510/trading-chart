import type { ChartColors, Interval, ThemeName } from './types';

export type ChartPaletteName = 'Light' | 'Black' | 'Green';

export type ChartPalette = {
  theme: ThemeName;
  colors: ChartColors;
};

export const CHART_PALETTES: Record<ChartPaletteName, ChartPalette> = {
  Light: { theme: 'light', colors: { up: '#26a65b', down: '#e5484d' } },
  Black: { theme: 'dark', colors: { up: '#20b26c', down: '#ef454a', background: '#000000' } },
  Green: {
    theme: 'dark',
    colors: { up: '#7CFFB2', down: '#ff6b6b', background: '#0d3b24', grid: '#1f5c3d' },
  },
};

/** Indicators on the chart unless `indicators` is passed. Volume and SMA stay on. */
export const DEFAULT_INDICATORS: readonly string[] = ['VOL', 'SMA'];

/** Timeframes the chart shows unless `intervals` is passed. `1s` stays hidden. */
export const CHART_INTERVALS: readonly Interval[] = [
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
