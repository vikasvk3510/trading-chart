import {
  DEFAULT_COLORS,
  formatNumber,
  formatSigned,
  legendIntervalLabel,
  legendStats,
  type Candle,
  type ChartType,
  type DepthBook,
  type Interval,
  type MagnetMode,
  type ScaleMode,
} from 'tradingcandle-core';
import {
  dispose,
  init,
  type Chart,
  type Crosshair,
  type KLineData,
  type OverlayMode,
  type Period,
} from 'klinecharts';
import { paintDepthChart } from './depthView';
import { registerCustomOverlays } from './overlays';
import { renderShell } from './shell';
import { chartStyles, screenshotBackground } from './theme';
import type { TradingChartApi, TradingChartOptions } from './types';

type IndicatorSpec = {
  klineName: string;
  paneId: string;
  stack: boolean;
  calcParams?: number[];
};

const OVERLAY_NAME: Partial<Record<string, string>> = {
  trendLine: 'segment',
  channel: 'priceChannelLine',
  fib: 'fibonacciLine',
  pattern: 'xabcdPattern',
  brush: 'brush',
  ruler: 'measureRuler',
};

const EMOJIS = ['😀', '🚀', '🔥', '💎', '📈', '📉', '⚠️', '✅', '❌', '💰'];

const SCALE_AXIS: Record<ScaleMode, string> = {
  auto: 'normal',
  percentage: 'percentage',
  log: 'logarithm',
};

function periodOf(interval: Interval): Period {
  switch (interval) {
    case '1s':
      return { span: 1, type: 'second' };
    case '1m':
      return { span: 1, type: 'minute' };
    case '5m':
      return { span: 5, type: 'minute' };
    case '15m':
      return { span: 15, type: 'minute' };
    case '30m':
      return { span: 30, type: 'minute' };
    case '1h':
      return { span: 1, type: 'hour' };
    case '4h':
      return { span: 4, type: 'hour' };
    case '1d':
      return { span: 1, type: 'day' };
    case '1w':
      return { span: 1, type: 'week' };
    case '1M':
      return { span: 1, type: 'month' };
    default:
      return { span: 30, type: 'minute' };
  }
}

function toKLine(candle: Candle): KLineData {
  return {
    timestamp: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    turnover: candle.turnover,
  };
}

function fromKLine(data: KLineData): Candle {
  return {
    time: data.timestamp,
    open: data.open,
    high: data.high,
    low: data.low,
    close: data.close,
    volume: data.volume ?? 0,
    turnover: typeof data.turnover === 'number' ? data.turnover : undefined,
  };
}

function fractionDigits(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = Math.abs(value).toString();
  if (text.includes('e') || text.includes('E')) return 8;
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Match Bybit: USDT prices keep their cents (2,662.07), they are not cut to 1 decimal. */
function inferDigits(candles: readonly Candle[]): number {
  const last = candles[candles.length - 1]?.close ?? 0;
  if (!Number.isFinite(last) || last === 0) return 2;
  let digits = last >= 1 ? 2 : last >= 0.0001 ? 4 : 8;
  for (const candle of candles.slice(-40)) {
    digits = Math.max(
      digits,
      fractionDigits(candle.open),
      fractionDigits(candle.high),
      fractionDigits(candle.low),
      fractionDigits(candle.close),
    );
  }
  return Math.min(digits, 8);
}

function indicatorSpec(name: string, smaPeriod: number, volumeSmaPeriod: number): IndicatorSpec | null {
  switch (name.toUpperCase()) {
    case 'SMA':
    case 'MA':
      return { klineName: 'MA', paneId: 'candle_pane', stack: true, calcParams: [smaPeriod] };
    case 'EMA':
      return { klineName: 'EMA', paneId: 'candle_pane', stack: true, calcParams: [smaPeriod] };
    case 'BOLL':
      return { klineName: 'BOLL', paneId: 'candle_pane', stack: true };
    case 'VOL':
      return { klineName: 'VOL', paneId: 'volume_pane', stack: false, calcParams: [volumeSmaPeriod] };
    case 'MACD':
      return { klineName: 'MACD', paneId: 'macd_pane', stack: false };
    case 'RSI':
      return { klineName: 'RSI', paneId: 'rsi_pane', stack: false };
    case 'KDJ':
      return { klineName: 'KDJ', paneId: 'kdj_pane', stack: false };
    default:
      return null;
  }
}

function smaEnding(list: KLineData[], index: number, period: number): number | null {
  if (index < period - 1 || period <= 0) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i += 1) sum += list[i]?.volume ?? 0;
  return sum / period;
}

export function createTradingChart(root: HTMLElement, options: TradingChartOptions): TradingChartApi {
  registerCustomOverlays();
  const ui = renderShell(root);
  const state: TradingChartOptions & {
    candles: Candle[];
    depth: DepthBook;
    tool: string;
    magnet: MagnetMode;
    locked: boolean;
    textDraft: string;
    emoji: string;
    barSpace: number;
    forwardCb: ((data: KLineData[], more?: boolean | { forward?: boolean; backward?: boolean }) => void) | null;
    realtimeCb: ((data: KLineData) => void) | null;
    loadingMore: boolean;
    fullscreen: boolean;
  } = {
    ...options,
    colors: { ...DEFAULT_COLORS, ...options.colors },
    candles: options.data.slice(),
    depth: { bids: [], asks: [] },
    tool: 'crosshair',
    magnet: 'normal',
    locked: false,
    textDraft: 'Note',
    emoji: '😀',
    barSpace: 10,
    forwardCb: null,
    realtimeCb: null,
    loadingMore: false,
    fullscreen: false,
  };

  ui.shell.dataset.theme = state.theme;
  applyChromeVisibility();

  const created = init(ui.canvas, {
    timezone: 'UTC',
    styles: chartStyles(state.theme, state.colors, state.chartType),
    layout: {
      barSpaceLimit: { min: 2, max: 40 },
    },
  });
  if (!created) {
    const message = 'KLineChart failed to initialize';
    options.onError?.(message);
    throw new Error(message);
  }
  const chart: Chart = created;

  chart.setDataLoader({
    getBars: ({ type, callback }) => {
      if (type === 'forward') {
        const oldest = state.candles[0]?.time;
        if (oldest == null || state.loadingMore) {
          callback([], false);
          return;
        }
        state.loadingMore = true;
        state.forwardCb = callback;
        state.onLoadMore?.(oldest);
        window.setTimeout(() => {
          if (state.forwardCb === callback) {
            callback([], false);
            state.forwardCb = null;
            state.loadingMore = false;
          }
        }, 12000);
        return;
      }
      callback(
        state.candles.map(toKLine),
        { forward: state.candles.length > 0, backward: false },
      );
    },
    subscribeBar: ({ callback }) => {
      state.realtimeCb = callback;
      const last = state.candles[state.candles.length - 1];
      if (last) callback(toKLine(last));
    },
    unsubscribeBar: () => {
      state.realtimeCb = null;
    },
  });

  chart.setSymbol({
    ticker: state.symbol,
    pricePrecision: inferDigits(state.candles),
    volumePrecision: 2,
  });
  chart.setPeriod(periodOf(state.interval));
  chart.subscribeAction('onCrosshairChange', (data) => {
    paintLegend(data as Crosshair);
  });
  chart.subscribeAction('onScroll', () => placeVolumeLegend());
  chart.subscribeAction('onVisibleRangeChange', () => placeVolumeLegend());

  syncIndicators();
  applyScale(state.scale);
  markActiveInterval();
  markActiveScale();
  paintLegend(null);
  placeVolumeLegend();

  const clockTimer = window.setInterval(tickClock, 1000);
  tickClock();
  const resizeObserver = new ResizeObserver(() => {
    chart.resize();
    if (state.chartType === 'depth') paintDepthChart(ui.depth, state.depth, state.colors, inferDigits(state.candles));
  });
  resizeObserver.observe(ui.shell);

  ui.shell.addEventListener('click', onShellClick);
  ui.dateInput.addEventListener('change', () => {
    const value = ui.dateInput.value;
    if (!value) return;
    const [date, time] = value.split('T');
    const stamp = Date.parse(`${date}T${time ?? '00:00'}:00Z`);
    if (Number.isFinite(stamp)) chart.scrollToTimestamp(stamp);
    ui.dateInput.hidden = true;
  });
  const onFullscreenChange = () => {
    const enabled = document.fullscreenElement === ui.shell;
    state.fullscreen = enabled;
    state.onFullscreen?.(enabled);
    chart.resize();
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);

  function applyChromeVisibility() {
    const top = ui.shell.querySelector<HTMLElement>('[data-part="timeframe"] .twc-intervals');
    const tools = ui.shell.querySelector<HTMLElement>('[data-part="toolbar"]');
    if (top) top.style.display = state.showTimeframeBar ? '' : 'none';
    if (tools) tools.style.display = state.showToolbar ? '' : 'none';
  }

  function tickClock() {
    const now = new Date();
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    ui.clock.textContent = `${hh}:${mm}:${ss} UTC`;
  }

  function markActiveInterval() {
    ui.shell.querySelectorAll<HTMLButtonElement>('[data-interval]').forEach((button) => {
      button.classList.toggle('is-on', button.dataset.interval === state.interval);
    });
  }

  function markActiveScale() {
    ui.shell.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((button) => {
      button.classList.toggle('is-on', button.dataset.scale === state.scale);
    });
  }

  function markActiveTool() {
    ui.shell.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
      const tool = button.dataset.tool;
      const on =
        tool === state.tool ||
        (tool === 'magnet' && state.magnet !== 'normal') ||
        (tool === 'lock' && state.locked);
      button.classList.toggle('is-on', on);
    });
  }

  function applyScale(scale: ScaleMode) {
    state.scale = scale;
    chart.overrideYAxis({ paneId: 'candle_pane', name: SCALE_AXIS[scale] });
    markActiveScale();
  }

  function applyStyles() {
    chart.setStyles(chartStyles(state.theme, state.colors, state.chartType));
    ui.shell.dataset.theme = state.theme;
  }

  function syncIndicators() {
    const wanted = new Map<string, IndicatorSpec>();
    for (const name of state.indicators) {
      const spec = indicatorSpec(name, state.smaPeriod, state.volumeSmaPeriod);
      if (spec) wanted.set(spec.klineName, spec);
    }
    if (state.showVolume) {
      wanted.set('VOL', {
        klineName: 'VOL',
        paneId: 'volume_pane',
        stack: false,
        calcParams: [state.volumeSmaPeriod],
      });
    }
    for (const indicator of chart.getIndicators()) {
      if (!wanted.has(indicator.name)) chart.removeIndicator({ id: indicator.id });
    }
    const present = new Set(chart.getIndicators().map((indicator) => indicator.name));
    for (const spec of wanted.values()) {
      if (present.has(spec.klineName)) {
        chart.overrideIndicator({
          name: spec.klineName,
          calcParams: spec.calcParams,
          styles: spec.klineName === 'VOL' ? { lines: [{ color: '#5b8ff9', size: 1.5 }] } : undefined,
        });
        continue;
      }
      chart.createIndicator(
        {
          name: spec.klineName,
          paneId: spec.paneId,
          calcParams: spec.calcParams,
          shortName: spec.klineName === 'MA' ? 'SMA' : spec.klineName,
          styles: spec.klineName === 'VOL' ? { lines: [{ color: '#5b8ff9', size: 1.5 }] } : undefined,
        },
        spec.stack,
      );
    }
    window.requestAnimationFrame(placeVolumeLegend);
  }

  function placeVolumeLegend() {
    const show = state.showVolume || state.indicators.some((name) => name.toUpperCase() === 'VOL');
    if (!show) {
      ui.volumeLegend.hidden = true;
      return;
    }
    const pane = chart.getDom('volume_pane', 'main');
    if (!pane) {
      ui.volumeLegend.hidden = true;
      return;
    }
    const paneBox = pane.getBoundingClientRect();
    const stageBox = ui.canvas.parentElement?.getBoundingClientRect();
    if (!stageBox) return;
    ui.volumeLegend.hidden = false;
    ui.volumeLegend.style.top = `${paneBox.top - stageBox.top + 6}px`;
  }

  function paintLegend(cross: Crosshair | null) {
    const list = chart.getDataList();
    const index =
      cross?.kLineData && cross.dataIndex != null ? cross.dataIndex : Math.max(0, list.length - 1);
    const row = list[index];
    if (!row) {
      ui.legend.innerHTML = `<div class="twc-title">${titleText()}</div>`;
      ui.volumeLegend.innerHTML = '';
      state.onCrosshairMove?.(null);
      return;
    }
    const candle = fromKLine(row);
    const stats = legendStats(candle, index > 0 ? list[index - 1]?.close : undefined);
    const digits = inferDigits(state.candles.length ? state.candles : [candle]);
    const tone = stats.change < 0 ? 'twc-down' : stats.change > 0 ? 'twc-up' : '';
    ui.legend.innerHTML = `
      <div class="twc-title">${titleText()}</div>
      <div class="twc-ohlc">
        <span>O <b class="${tone}">${formatNumber(stats.open, digits)}</b></span>
        <span>H <b class="${tone}">${formatNumber(stats.high, digits)}</b></span>
        <span>L <b class="${tone}">${formatNumber(stats.low, digits)}</b></span>
        <span>C <b class="${tone}">${formatNumber(stats.close, digits)}</b></span>
        <b class="${tone}">${formatSigned(stats.change, digits)} (${formatSigned(stats.changePct, 2)}%)</b>
      </div>
    `;
    const volumeSma = smaEnding(list, index, state.volumeSmaPeriod);
    ui.volumeLegend.innerHTML = `Volume <span>SMA ${state.volumeSmaPeriod}</span> <b>${
      volumeSma == null ? '--' : formatNumber(volumeSma, 0)
    }</b>`;
    state.onCrosshairMove?.(cross?.kLineData ? candle : null);
    placeVolumeLegend();
  }

  function titleText(): string {
    const title = `${state.symbol} ${state.marketType} · ${legendIntervalLabel(state.interval)}`;
    const exchange = state.exchangeLabel.trim();
    return exchange ? `${title} · ${exchange}` : title;
  }

  function closePop() {
    ui.pop.hidden = true;
    ui.pop.innerHTML = '';
  }

  function openPop(anchor: HTMLElement, html: string) {
    ui.pop.innerHTML = html;
    ui.pop.hidden = false;
    const anchorBox = anchor.getBoundingClientRect();
    const shellBox = ui.shell.getBoundingClientRect();
    const top = anchorBox.bottom - shellBox.top + 6;
    const left = Math.max(8, Math.min(anchorBox.left - shellBox.left, shellBox.width - 200));
    ui.pop.style.top = `${top}px`;
    ui.pop.style.left = `${left}px`;
  }

  function startOverlay(name: string, extendData?: string) {
    const mode: OverlayMode = state.magnet;
    chart.createOverlay({
      name,
      groupId: 'drawings',
      lock: state.locked,
      mode,
      extendData,
      styles: { line: { color: '#f7a600', size: 1.5 } },
    });
  }

  function onShellClick(event: MouseEvent) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (ui.pop.contains(target)) {
      handlePopClick(target);
      return;
    }
    closePop();
    const intervalBtn = target.closest<HTMLButtonElement>('[data-interval]');
    if (intervalBtn?.dataset.interval) {
      api.setInterval(intervalBtn.dataset.interval as Interval);
      return;
    }
    const scaleBtn = target.closest<HTMLButtonElement>('[data-scale]');
    if (scaleBtn?.dataset.scale) {
      applyScale(scaleBtn.dataset.scale as ScaleMode);
      return;
    }
    const rangeBtn = target.closest<HTMLButtonElement>('[data-range]');
    if (rangeBtn?.dataset.range) {
      api.setRange(Number(rangeBtn.dataset.range));
      return;
    }
    const toolBtn = target.closest<HTMLButtonElement>('[data-tool]');
    if (toolBtn?.dataset.tool) {
      selectTool(toolBtn.dataset.tool, toolBtn);
      return;
    }
    const menu = target.closest<HTMLButtonElement>('[data-menu]');
    if (menu?.dataset.menu) {
      openMenu(menu.dataset.menu, menu);
      return;
    }
    const action = target.closest<HTMLButtonElement>('[data-act]');
    if (action?.dataset.act === 'screenshot') {
      const url = api.takeScreenshot();
      if (!state.embedded) downloadPng(url);
      return;
    }
    if (action?.dataset.act === 'fullscreen') {
      toggleFullscreen();
      return;
    }
    if (action?.dataset.act === 'date') {
      ui.dateInput.hidden = !ui.dateInput.hidden;
      if (!ui.dateInput.hidden) ui.dateInput.focus();
    }
  }

  function handlePopClick(target: Element) {
    const typeBtn = target.closest<HTMLButtonElement>('[data-chart-type]');
    if (typeBtn?.dataset.chartType) {
      api.setChartType(typeBtn.dataset.chartType as ChartType);
      closePop();
      return;
    }
    const indicatorBtn = target.closest<HTMLButtonElement>('[data-indicator]');
    if (indicatorBtn?.dataset.indicator) {
      const name = indicatorBtn.dataset.indicator;
      const next = new Set(state.indicators.map((item) => item.toUpperCase()));
      if (state.showVolume) next.add('VOL');
      if (next.has(name)) next.delete(name);
      else next.add(name);
      if (name === 'VOL') state.showVolume = next.has('VOL');
      api.setIndicators([...next]);
      openMenu('indicators', indicatorBtn);
      return;
    }
    const emojiBtn = target.closest<HTMLButtonElement>('[data-emoji]');
    if (emojiBtn?.dataset.emoji) {
      state.emoji = emojiBtn.dataset.emoji;
      state.tool = 'emoji';
      markActiveTool();
      startOverlay('emojiMark', state.emoji);
      closePop();
      return;
    }
    if (target.closest('[data-act="place-text"]')) {
      const input = ui.pop.querySelector<HTMLInputElement>('input[name="note"]');
      state.textDraft = input?.value || 'Note';
      state.tool = 'text';
      markActiveTool();
      startOverlay('textNote', state.textDraft);
      closePop();
      return;
    }
    if (target.closest('[data-act="apply-settings"]')) {
      const sma = ui.pop.querySelector<HTMLInputElement>('input[name="sma"]');
      const volume = ui.pop.querySelector<HTMLInputElement>('input[name="vol"]');
      const smaPeriod = Number(sma?.value);
      const volumePeriod = Number(volume?.value);
      if (Number.isInteger(smaPeriod) && smaPeriod > 0) state.smaPeriod = smaPeriod;
      if (Number.isInteger(volumePeriod) && volumePeriod > 0) state.volumeSmaPeriod = volumePeriod;
      syncIndicators();
      paintLegend(null);
      closePop();
    }
  }

  function openMenu(menu: string, anchor: HTMLElement) {
    if (menu === 'type') {
      openPop(
        anchor,
        ['candle', 'line', 'area', 'bar', 'depth']
          .map((type) => {
            const label = type === 'bar' ? 'Bars' : type === 'depth' ? 'Depth' : type[0].toUpperCase() + type.slice(1);
            return `<button type="button" data-chart-type="${type}">${label}</button>`;
          })
          .join(''),
      );
      return;
    }
    if (menu === 'indicators') {
      const selected = new Set(state.indicators.map((item) => item.toUpperCase()));
      if (state.showVolume) selected.add('VOL');
      openPop(
        anchor,
        ['VOL', 'SMA', 'EMA', 'BOLL', 'MACD', 'RSI', 'KDJ']
          .map((name) => {
            const on = selected.has(name);
            return `<button type="button" data-indicator="${name}">${on ? '✓' : '○'} ${name}</button>`;
          })
          .join(''),
      );
      return;
    }
    if (menu === 'settings') {
      openPop(
        anchor,
        `<label>Price SMA period<input name="sma" type="number" min="1" value="${state.smaPeriod}" /></label>
         <label>Volume SMA period<input name="vol" type="number" min="1" value="${state.volumeSmaPeriod}" /></label>
         <button type="button" data-act="apply-settings">Apply</button>`,
      );
    }
  }

  function selectTool(tool: string, anchor: HTMLElement) {
    if (tool === 'delete') {
      api.clearDrawings();
      return;
    }
    if (tool === 'lock') {
      api.setLocked(!state.locked);
      return;
    }
    if (tool === 'magnet') {
      state.magnet = state.magnet === 'normal' ? 'weak_magnet' : 'normal';
      chart.overrideOverlay({ mode: state.magnet });
      markActiveTool();
      return;
    }
    if (tool === 'zoom') {
      state.barSpace = Math.min(40, state.barSpace * 1.25);
      chart.setBarSpace(state.barSpace);
      return;
    }
    if (tool === 'text') {
      state.tool = 'text';
      markActiveTool();
      openPop(
        anchor,
        `<label>Text<input name="note" type="text" value="${escapeAttr(state.textDraft)}" /></label>
         <button type="button" data-act="place-text">Place on chart</button>`,
      );
      return;
    }
    if (tool === 'emoji') {
      state.tool = 'emoji';
      markActiveTool();
      openPop(
        anchor,
        `<div class="twc-emoji">${EMOJIS.map((emoji) => `<button type="button" data-emoji="${emoji}">${emoji}</button>`).join('')}</div>`,
      );
      return;
    }
    state.tool = tool;
    markActiveTool();
    if (tool === 'crosshair') return;
    const overlay = OVERLAY_NAME[tool];
    if (overlay) startOverlay(overlay);
  }

  function toggleFullscreen() {
    if (state.embedded) {
      state.fullscreen = !state.fullscreen;
      state.onFullscreen?.(state.fullscreen);
      return;
    }
    if (document.fullscreenElement === ui.shell) {
      void document.exitFullscreen();
      return;
    }
    void ui.shell.requestFullscreen().catch(() => {
      state.onError?.('Fullscreen is not available in this browser');
    });
  }

  function downloadPng(dataUrl: string) {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${state.symbol}-${state.interval}.png`;
    link.click();
  }

  function reloadSymbol() {
    chart.setSymbol({
      ticker: state.symbol,
      pricePrecision: inferDigits(state.candles),
      volumePrecision: 2,
    });
  }

  const api: TradingChartApi = {
    setData(data) {
      const previousFirst = state.candles[0]?.time;
      const prepended =
        previousFirst != null &&
        data.length > state.candles.length &&
        data[0] != null &&
        data[0].time < previousFirst;
      state.candles = data.slice();
      if (prepended && state.forwardCb && previousFirst != null) {
        const older = state.candles.filter((candle) => candle.time < previousFirst).map(toKLine);
        const callback = state.forwardCb;
        state.forwardCb = null;
        state.loadingMore = false;
        callback(older, { forward: true, backward: false });
        paintLegend(null);
        return;
      }
      if (state.forwardCb) {
        state.forwardCb([], false);
        state.forwardCb = null;
        state.loadingMore = false;
      }
      const current = chart.getSymbol();
      const digits = inferDigits(state.candles);
      if (!current || current.ticker !== state.symbol || current.pricePrecision !== digits) reloadSymbol();
      else chart.resetData();
      paintLegend(null);
    },
    updateCandle(candle) {
      const last = state.candles[state.candles.length - 1];
      if (last && candle.time < last.time) return;
      if (last && candle.time === last.time) state.candles[state.candles.length - 1] = candle;
      else state.candles.push(candle);
      const bar = toKLine(candle);
      if (state.realtimeCb) state.realtimeCb(bar);
      else if (!chart.getDataList().length) chart.resetData();
      paintLegend(null);
    },
    setInterval(interval) {
      if (interval === state.interval) return;
      state.interval = interval;
      state.candles = [];
      markActiveInterval();
      chart.setPeriod(periodOf(interval));
      state.onIntervalChange?.(interval);
      paintLegend(null);
    },
    setIndicators(indicators) {
      state.indicators = indicators.slice();
      syncIndicators();
    },
    setShowVolume(show) {
      state.showVolume = show;
      syncIndicators();
    },
    setTheme(theme) {
      state.theme = theme;
      applyStyles();
    },
    setSymbol(symbol, exchangeLabel, marketType) {
      state.symbol = symbol;
      if (exchangeLabel != null) state.exchangeLabel = exchangeLabel;
      if (marketType) state.marketType = marketType;
      reloadSymbol();
      paintLegend(null);
    },
    setChartType(chartType) {
      state.chartType = chartType;
      ui.shell.classList.toggle('is-depth', chartType === 'depth');
      if (chartType === 'depth') paintDepthChart(ui.depth, state.depth, state.colors, inferDigits(state.candles));
      else applyStyles();
    },
    setDepth(book) {
      state.depth = { bids: book.bids.slice(), asks: book.asks.slice() };
      if (state.chartType === 'depth') paintDepthChart(ui.depth, state.depth, state.colors, inferDigits(state.candles));
    },
    setScale(scale) {
      applyScale(scale);
    },
    setColors(colors) {
      state.colors = { ...state.colors, ...colors };
      applyStyles();
    },
    takeScreenshot() {
      const dataUrl = chart.getConvertPictureUrl(true, 'png', screenshotBackground(state.theme));
      state.onScreenshot?.(dataUrl);
      return dataUrl;
    },
    clearDrawings() {
      chart.removeOverlay({ groupId: 'drawings' });
    },
    scrollToLatest() {
      chart.scrollToRealTime();
    },
    scrollToTimestamp(time) {
      chart.scrollToTimestamp(time);
    },
    setRange(rangeMs) {
      const list = chart.getDataList();
      if (list.length === 0) return;
      const last = list[list.length - 1]?.timestamp ?? Date.now();
      const fromTime = last - rangeMs;
      let count = 0;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        count += 1;
        if ((list[i]?.timestamp ?? 0) <= fromTime) break;
      }
      const width = ui.canvas.clientWidth || 800;
      state.barSpace = Math.max(2, Math.min(16, (width * 0.86) / Math.max(count, 10)));
      chart.setBarSpace(state.barSpace);
      chart.scrollToRealTime();
    },
    setLocked(locked) {
      state.locked = locked;
      chart.overrideOverlay({ lock: locked });
      markActiveTool();
    },
    setFullscreen(enabled) {
      state.fullscreen = enabled;
      if (!state.embedded) {
        if (enabled && document.fullscreenElement !== ui.shell) void ui.shell.requestFullscreen();
        if (!enabled && document.fullscreenElement === ui.shell) void document.exitFullscreen();
      }
    },
    setSafeArea(insets) {
      ui.shell.style.paddingTop = `${insets.top}px`;
      ui.shell.style.paddingRight = `${insets.right}px`;
      ui.shell.style.paddingBottom = `${insets.bottom}px`;
      ui.shell.style.paddingLeft = `${insets.left}px`;
      chart.resize();
    },
    resize() {
      chart.resize();
      placeVolumeLegend();
      if (state.chartType === 'depth') paintDepthChart(ui.depth, state.depth, state.colors, inferDigits(state.candles));
    },
    destroy() {
      window.clearInterval(clockTimer);
      resizeObserver.disconnect();
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      ui.shell.removeEventListener('click', onShellClick);
      dispose(chart);
      ui.shell.remove();
    },
  };

  markActiveTool();
  return api;
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}

export type { TradingChartApi, TradingChartOptions };
