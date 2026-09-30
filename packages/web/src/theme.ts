import type { ChartColors, ChartType, ThemeName } from 'tradingcandle-core';
import type { DeepPartial, Styles } from 'klinecharts';

const GRID_DARK = '#1e2329';
const GRID_LIGHT = '#e6e8eb';
const AXIS_DARK = '#848e9c';
const AXIS_LIGHT = '#5d6678';

export function chartStyles(
  theme: ThemeName,
  colors: ChartColors,
  chartType: ChartType,
): DeepPartial<Styles> {
  const dark = theme === 'dark';
  const axis = dark ? AXIS_DARK : AXIS_LIGHT;
  const grid = dark ? GRID_DARK : GRID_LIGHT;
  const lineMode = chartType === 'line';
  const candleType = chartType === 'bar' ? 'ohlc' : chartType === 'area' || lineMode ? 'area' : 'candle_solid';

  return {
    grid: {
      show: true,
      horizontal: { color: grid, style: 'solid', size: 1 },
      vertical: { color: grid, style: 'solid', size: 1 },
    },
    candle: {
      type: candleType,
      bar: {
        compareRule: 'current_open',
        upColor: colors.up,
        downColor: colors.down,
        noChangeColor: axis,
        upBorderColor: colors.up,
        downBorderColor: colors.down,
        noChangeBorderColor: axis,
        upWickColor: colors.up,
        downWickColor: colors.down,
        noChangeWickColor: axis,
      },
      area: {
        lineSize: 2,
        lineColor: colors.up,
        backgroundColor: lineMode
          ? 'transparent'
          : [
              { offset: 0, color: hexAlpha(colors.up, 0.28) },
              { offset: 1, color: hexAlpha(colors.up, 0) },
            ],
        point: {
          show: false,
        },
      },
      priceMark: {
        show: true,
        high: { show: false },
        low: { show: false },
        last: {
          show: true,
          compareRule: 'current_open',
          upColor: colors.up,
          downColor: colors.down,
          noChangeColor: axis,
          line: {
            show: true,
            style: 'dashed',
            dashedValue: [4, 4],
            size: 1,
          },
          text: {
            show: true,
            size: 12,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 4,
            paddingBottom: 4,
            borderRadius: 2,
            color: '#ffffff',
          },
        },
      },
      tooltip: {
        showRule: 'none',
      },
    },
    indicator: {
      ohlc: {
        upColor: colors.up,
        downColor: colors.down,
        noChangeColor: axis,
      },
      tooltip: {
        showRule: 'none',
      },
      lines: [{ color: '#5b8ff9', size: 1.5 }],
    },
    xAxis: {
      axisLine: { color: grid },
      tickLine: { color: grid },
      tickText: { color: axis, size: 11 },
    },
    yAxis: {
      axisLine: { color: grid },
      tickLine: { color: grid },
      tickText: { color: axis, size: 11 },
    },
    separator: {
      color: grid,
      size: 1,
    },
    crosshair: {
      show: true,
      horizontal: {
        show: true,
        line: { color: axis, style: 'dashed', dashedValue: [4, 2], size: 1 },
        text: { color: '#ffffff', backgroundColor: '#363a45', borderColor: '#363a45', size: 12 },
      },
      vertical: {
        show: true,
        line: { color: axis, style: 'dashed', dashedValue: [4, 2], size: 1 },
        text: { color: '#ffffff', backgroundColor: '#363a45', borderColor: '#363a45', size: 12 },
      },
    },
  };
}

export function screenshotBackground(theme: ThemeName): string {
  return theme === 'dark' ? '#0b0e11' : '#ffffff';
}

function hexAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
