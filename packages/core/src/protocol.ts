import type { Candle, ChartColors, ChartType, DepthLevel, Interval, ScaleMode, ThemeName } from './types';

export type HostToChartMessage =
  | { type: 'setData'; data: Candle[] }
  | { type: 'updateCandle'; candle: Candle }
  | { type: 'setInterval'; interval: Interval }
  | { type: 'setIndicators'; indicators: string[] }
  | { type: 'setTheme'; theme: ThemeName }
  | {
      type: 'setSymbol';
      symbol: string;
      exchangeLabel?: string;
      marketType?: string;
    }
  | { type: 'setChartType'; chartType: ChartType }
  | { type: 'setDepth'; bids: DepthLevel[]; asks: DepthLevel[] }
  | { type: 'setScale'; scale: ScaleMode }
  | { type: 'setColors'; colors: ChartColors }
  | { type: 'takeScreenshot' }
  | { type: 'clearDrawings' }
  | { type: 'scrollToLatest' }
  | { type: 'scrollToTimestamp'; time: number }
  | { type: 'setRange'; rangeMs: number }
  | { type: 'setLocked'; locked: boolean }
  | { type: 'setFullscreen'; enabled: boolean }
  | { type: 'setSafeArea'; top: number; right: number; bottom: number; left: number };

export type ChartToHostMessage =
  | { type: 'ready' }
  | { type: 'intervalChange'; interval: Interval }
  | { type: 'loadMore'; oldestTime: number }
  | { type: 'crosshair'; candle: Candle | null }
  | { type: 'screenshot'; dataUrl: string }
  | { type: 'fullscreen'; enabled: boolean }
  | { type: 'error'; message: string };

export type BridgeMessage = HostToChartMessage | ChartToHostMessage;

const HOST_TYPES = new Set<HostToChartMessage['type']>([
  'setData',
  'updateCandle',
  'setInterval',
  'setIndicators',
  'setTheme',
  'setSymbol',
  'setChartType',
  'setDepth',
  'setScale',
  'setColors',
  'takeScreenshot',
  'clearDrawings',
  'scrollToLatest',
  'scrollToTimestamp',
  'setRange',
  'setLocked',
  'setFullscreen',
  'setSafeArea',
]);

const CHART_TYPES = new Set<ChartToHostMessage['type']>([
  'ready',
  'intervalChange',
  'loadMore',
  'crosshair',
  'screenshot',
  'fullscreen',
  'error',
]);

export function encodeMessage(message: BridgeMessage): string {
  return JSON.stringify(message);
}

export function decodeMessage(raw: string): BridgeMessage | null {
  if (!raw || typeof raw !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) return null;
  const type = (parsed as { type: unknown }).type;
  if (typeof type !== 'string') return null;
  if (!HOST_TYPES.has(type as HostToChartMessage['type']) && !CHART_TYPES.has(type as ChartToHostMessage['type'])) {
    return null;
  }
  return parsed as BridgeMessage;
}

export function isHostMessage(message: BridgeMessage): message is HostToChartMessage {
  return HOST_TYPES.has(message.type as HostToChartMessage['type']);
}

export function isChartMessage(message: BridgeMessage): message is ChartToHostMessage {
  return CHART_TYPES.has(message.type as ChartToHostMessage['type']);
}
