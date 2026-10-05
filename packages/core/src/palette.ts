import type { ChartColors, ThemeName } from './types';

export type Palette = {
  background: string;
  text: string;
  muted: string;
  border: string;
  grid: string;
  panel: string;
  /** True when the background is dark, so overlays use light text. */
  dark: boolean;
};

const THEME_PALETTE: Record<ThemeName, Palette> = {
  dark: {
    background: '#0b0e11',
    text: '#d1d4dc',
    muted: '#848e9c',
    border: '#1e2329',
    grid: '#1e2329',
    panel: '#161a1e',
    dark: true,
  },
  light: {
    background: '#ffffff',
    text: '#131722',
    muted: '#5d6678',
    border: '#e0e3eb',
    grid: '#e6e8eb',
    panel: '#ffffff',
    dark: false,
  },
};

/** CSS color names, so `backgroundColor="red"` gets readable text and grid lines. */
const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  silver: '#c0c0c0',
  gray: '#808080',
  grey: '#808080',
  white: '#ffffff',
  maroon: '#800000',
  red: '#ff0000',
  purple: '#800080',
  fuchsia: '#ff00ff',
  green: '#008000',
  lime: '#00ff00',
  olive: '#808000',
  yellow: '#ffff00',
  navy: '#000080',
  blue: '#0000ff',
  teal: '#008080',
  aqua: '#00ffff',
  cyan: '#00ffff',
  orange: '#ffa500',
  pink: '#ffc0cb',
  brown: '#a52a2a',
  magenta: '#ff00ff',
  gold: '#ffd700',
  indigo: '#4b0082',
  violet: '#ee82ee',
};

/** Parses `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, and CSS color names. */
export function parseColor(color: string): [number, number, number] | null {
  const value = color.trim();
  const named = NAMED_COLORS[value.toLowerCase()];
  const source = named ?? value;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(source)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex.slice(0, 6);
    return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(source);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

export function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : color;
}

function isDark(color: string): boolean | null {
  const rgb = parseColor(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.179;
}

/** Theme colors with any `background`, `text`, or `grid` overrides from `colors`. */
export function resolvePalette(theme: ThemeName, colors: ChartColors): Palette {
  const base = THEME_PALETTE[theme];
  if (!colors.background && !colors.text && !colors.grid) return base;
  const background = colors.background || base.background;
  const dark = colors.background ? (isDark(background) ?? base.dark) : base.dark;
  const fallback = THEME_PALETTE[dark ? 'dark' : 'light'];
  const text = colors.text || (colors.background ? fallback.text : base.text);
  const derived = !!colors.text || !!colors.background;
  const muted = derived ? withAlpha(text, 0.62) : base.muted;
  const grid = colors.grid || (derived ? withAlpha(text, 0.1) : base.grid);
  return {
    background,
    text,
    muted,
    border: colors.grid || (derived ? withAlpha(text, 0.14) : base.border),
    grid,
    panel: background,
    dark,
  };
}
