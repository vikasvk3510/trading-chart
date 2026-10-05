import { CHART_INTERVALS, RANGE_MS, RANGE_PRESETS, type Interval, type ThemeName } from 'tradingcandle-core';

export const CHART_STYLE_ID = 'twc-chart-styles';

export const CHART_CSS = `
.twc{--twc-bg:#0b0e11;--twc-text:#d1d4dc;--twc-muted:#848e9c;--twc-border:#1e2329;--twc-panel:#161a1e;--twc-up:#26a65b;--twc-down:#e5484d;--twc-shadow:rgba(0,0,0,.35);box-sizing:border-box;display:flex;flex-direction:column;width:100%;height:100%;min-height:280px;background:var(--twc-bg);color:var(--twc-text);font:12px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;position:relative;overflow:hidden;user-select:none}
.twc *,.twc *::before,.twc *::after{box-sizing:border-box}
.twc[data-theme="light"]{--twc-bg:#fff;--twc-text:#131722;--twc-muted:#5d6678;--twc-border:#e0e3eb;--twc-panel:#fff;--twc-shadow:transparent}
.twc-top,.twc-bottom{display:flex;align-items:center;gap:4px;padding:0 8px;flex:0 0 auto;border-color:var(--twc-border)}
.twc-top{height:36px;border-bottom:1px solid var(--twc-border)}
.twc-bottom{height:32px;border-top:1px solid var(--twc-border);justify-content:space-between}
.twc-intervals,.twc-ranges,.twc-actions,.twc-scales{display:flex;align-items:center;gap:2px;min-width:0}
.twc-intervals{overflow:auto;scrollbar-width:none}
.twc-intervals::-webkit-scrollbar{display:none}
.twc-btn{appearance:none;border:0;background:transparent;color:var(--twc-muted);height:26px;min-width:26px;padding:0 6px;border-radius:4px;cursor:pointer;font:inherit}
.twc-btn:hover,.twc-btn.is-on{color:#f7a600}
.twc-btn.is-on{font-weight:600}
.twc-btn svg{display:block}
.twc-actions{margin-left:auto;gap:0}
.twc-body{flex:1;display:flex;min-height:0}
.twc-tools{width:40px;border-right:1px solid var(--twc-border);display:flex;flex-direction:column;align-items:center;padding:4px 0;gap:2px;overflow:auto}
.twc-tools .twc-btn{width:32px;height:32px;padding:0;display:grid;place-items:center}
.twc-stage{position:relative;flex:1;min-width:0;min-height:0}
.twc-canvas,.twc-depth{position:absolute;inset:0}
.twc-depth{display:none;z-index:3;width:100%;height:100%;background:var(--twc-bg)}
.twc.is-depth .twc-depth{display:block}
.twc.is-depth .twc-canvas,.twc.is-depth .twc-legend,.twc.is-depth .twc-vol{visibility:hidden}
.twc.is-depth .twc-tools,.twc.is-depth .twc-bottom{display:none}
.twc-legend,.twc-vol{position:absolute;z-index:2;pointer-events:none;left:12px;text-shadow:0 1px 0 var(--twc-shadow)}
.twc-legend{top:8px}
.twc-title{color:var(--twc-text);font-size:13px;margin-bottom:2px}
.twc-ohlc{display:flex;flex-wrap:wrap;gap:8px;font-variant-numeric:tabular-nums}
.twc-ohlc b{font-weight:500}
.twc-up{color:var(--twc-up)}
.twc-down{color:var(--twc-down)}
.twc-vol{display:flex;gap:8px;color:var(--twc-muted)}
.twc-vol b{color:#5b8ff9;font-weight:500}
.twc-clock{margin-left:auto;color:var(--twc-muted);font-variant-numeric:tabular-nums;padding:0 8px}
.twc-pop{position:absolute;z-index:6;min-width:180px;max-width:260px;background:var(--twc-panel);border:1px solid var(--twc-border);border-radius:8px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.twc-pop[hidden]{display:none}
.twc-pop button,.twc-pop label{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:transparent;border:0;color:inherit;padding:6px 4px;cursor:pointer;font:inherit}
.twc-pop button:hover{color:#f7a600}
.twc-pop input[type="number"],.twc-pop input[type="text"]{width:100%;background:var(--twc-bg);color:inherit;border:1px solid var(--twc-border);border-radius:4px;padding:6px}
.twc-date{background:var(--twc-bg);color:inherit;border:1px solid var(--twc-border);border-radius:4px;padding:2px 4px;font:inherit}
.twc-emoji{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.twc-emoji button{justify-content:center;font-size:18px}
.twc-grow{flex:1}
`;

const ICONS: Record<string, string> = {
  candle:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 2v3M5 11v3M11 1v4M11 10v5"/><rect x="3.2" y="5" width="3.6" height="6" rx=".4" fill="currentColor" stroke="none"/><rect x="9.2" y="5" width="3.6" height="5" rx=".4"/></svg>',
  line: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 12l4-5 3 3 7-8"/></svg>',
  area: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 13l4-5 3 3 7-8v10H1z" opacity=".85"/></svg>',
  bars: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 2v12M6 5h3M8 11H5M11 3v10M8 6h3M13 9h-3"/></svg>',
  indicator:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 12c2-6 3-1 5-4s3 1 7-5"/></svg>',
  settings:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M12.8 3.2l-1.4 1.4M4.6 11.4l-1.4 1.4"/></svg>',
  add: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 3v10M3 8h10"/></svg>',
  camera:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 5h2l1-2h6l1 2h2v8H2z"/><circle cx="8" cy="9" r="2.2"/></svg>',
  expand:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3"/></svg>',
  cross:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 1v14M1 8h14"/></svg>',
  trend:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 12l12-8"/><circle cx="3" cy="11.5" r="1" fill="currentColor"/><circle cx="13" cy="4.5" r="1" fill="currentColor"/></svg>',
  channel:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 6l10-3M4 13l10-3"/></svg>',
  fib: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 3h12M2 6h12M2 9h12M2 13h12"/></svg>',
  pattern:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 12l3-6 3 3 3-7 5 8"/></svg>',
  brush:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 13c2-1 3-4 4-6s3-3 6-4c-1 3-1 4-3 5s-4 2-7 5z"/></svg>',
  text: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3h10M8 3v10M5 13h6"/></svg>',
  emoji:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M5.5 9.5c.7 1.2 1.6 1.8 2.5 1.8s1.8-.6 2.5-1.8"/><circle cx="6" cy="7" r=".6" fill="currentColor"/><circle cx="10" cy="7" r=".6" fill="currentColor"/></svg>',
  ruler:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 13L13 3"/><path d="M5 11l1 1M7 9l1 1M9 7l1 1M11 5l1 1"/></svg>',
  zoom: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3M7 5v4M5 7h4"/></svg>',
  magnet:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 2v6a4 4 0 0 0 8 0V2"/><path d="M4 2h2v5H4zM10 2h2v5h-2z"/></svg>',
  lock: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>',
  trash:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4"/></svg>',
  calendar:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M2 6h12M5 2v2M11 2v2"/></svg>',
};

function btn(className: string, attrs: string, icon: string, label: string): string {
  return `<button type="button" class="${className}" ${attrs} title="${label}" aria-label="${label}">${ICONS[icon] ?? ''}</button>`;
}

export function ensureChartStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(CHART_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = CHART_STYLE_ID;
  style.textContent = CHART_CSS;
  document.head.appendChild(style);
}

export function intervalButtons(intervals: readonly Interval[]): string {
  return intervals
    .map(
      (interval) =>
        `<button type="button" class="twc-btn" data-interval="${interval}">${interval}</button>`,
    )
    .join('');
}

export function renderShell(
  root: HTMLElement,
  theme: ThemeName = 'dark',
  intervalList: readonly Interval[] = CHART_INTERVALS,
): {
  shell: HTMLElement;
  intervals: HTMLElement;
  canvas: HTMLElement;
  depth: HTMLCanvasElement;
  legend: HTMLElement;
  volumeLegend: HTMLElement;
  pop: HTMLElement;
  clock: HTMLElement;
  dateInput: HTMLInputElement;
} {
  ensureChartStyles();
  root.innerHTML = '';
  const shell = document.createElement('div');
  shell.className = 'twc';
  shell.dataset.theme = theme;
  const intervals = intervalButtons(intervalList);
  const tools = [
    ['crosshair', 'cross', 'Crosshair'],
    ['trendLine', 'trend', 'Trend line'],
    ['channel', 'channel', 'Channel'],
    ['fib', 'fib', 'Fibonacci'],
    ['pattern', 'pattern', 'Pattern'],
    ['brush', 'brush', 'Brush'],
    ['text', 'text', 'Text'],
    ['emoji', 'emoji', 'Emoji'],
    ['ruler', 'ruler', 'Measure'],
    ['zoom', 'zoom', 'Zoom in'],
    ['magnet', 'magnet', 'Magnet'],
    ['lock', 'lock', 'Lock drawings'],
    ['delete', 'trash', 'Delete drawings'],
  ]
    .map(([tool, icon, label]) => btn('twc-btn', `data-tool="${tool}"`, icon, label))
    .join('');
  const ranges = RANGE_PRESETS.map(
    (preset) =>
      `<button type="button" class="twc-btn" data-range="${RANGE_MS[preset]}">${preset}</button>`,
  ).join('');

  shell.innerHTML = `
    <div class="twc-top" data-part="timeframe">
      <div class="twc-intervals">${intervals}</div>
      <div class="twc-actions">
        ${btn('twc-btn', 'data-menu="type"', 'candle', 'Chart type')}
        ${btn('twc-btn', 'data-menu="indicators"', 'indicator', 'Indicators')}
        ${btn('twc-btn', 'data-menu="settings"', 'settings', 'Settings')}
        ${btn('twc-btn', 'data-menu="indicators"', 'add', 'Add indicator')}
        ${btn('twc-btn', 'data-act="screenshot"', 'camera', 'Screenshot')}
        ${btn('twc-btn', 'data-act="fullscreen"', 'expand', 'Fullscreen')}
      </div>
    </div>
    <div class="twc-body">
      <div class="twc-tools" data-part="toolbar">${tools}</div>
      <div class="twc-stage">
        <div class="twc-canvas"></div>
        <canvas class="twc-depth"></canvas>
        <div class="twc-legend"></div>
        <div class="twc-vol" hidden></div>
        <div class="twc-pop" hidden></div>
      </div>
    </div>
    <div class="twc-bottom">
      <div class="twc-ranges">${ranges}${btn('twc-btn', 'data-act="date"', 'calendar', 'Go to date')}</div>
      <input class="twc-date" type="datetime-local" hidden />
      <span class="twc-clock"></span>
      <div class="twc-scales">
        <button type="button" class="twc-btn" data-scale="percentage">%</button>
        <button type="button" class="twc-btn" data-scale="log">log</button>
        <button type="button" class="twc-btn is-on" data-scale="auto">auto</button>
      </div>
    </div>
  `;
  root.appendChild(shell);
  const intervalBar = shell.querySelector('.twc-intervals');
  const canvas = shell.querySelector('.twc-canvas');
  const depth = shell.querySelector('.twc-depth');
  const legend = shell.querySelector('.twc-legend');
  const volumeLegend = shell.querySelector('.twc-vol');
  const pop = shell.querySelector('.twc-pop');
  const clock = shell.querySelector('.twc-clock');
  const dateInput = shell.querySelector('.twc-date');
  if (
    !intervalBar ||
    !canvas ||
    !(depth instanceof HTMLCanvasElement) ||
    !legend ||
    !volumeLegend ||
    !pop ||
    !clock ||
    !(dateInput instanceof HTMLInputElement)
  ) {
    throw new Error('Chart shell failed to render');
  }
  return {
    shell,
    intervals: intervalBar as HTMLElement,
    canvas: canvas as HTMLElement,
    depth,
    legend: legend as HTMLElement,
    volumeLegend: volumeLegend as HTMLElement,
    pop: pop as HTMLElement,
    clock: clock as HTMLElement,
    dateInput,
  };
}
