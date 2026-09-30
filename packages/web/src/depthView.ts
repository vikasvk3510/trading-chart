import { formatNumber, type ChartColors, type DepthBook, type DepthLevel } from '@talkwallet/chart-core';

type Point = { price: number; size: number };

function hexAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatSize(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  }
  return value.toFixed(2);
}

/** Bids step down toward the spread. Asks step up away from it. */
function stepSeries(levels: DepthLevel[], side: 'bid' | 'ask'): Point[] {
  if (levels.length === 0) return [];
  const ordered = [...levels].sort((a, b) => a.price - b.price);
  const points: Point[] = [];
  if (side === 'bid') {
    let remaining = ordered.reduce((sum, level) => sum + level.size, 0);
    const first = ordered[0];
    if (!first) return points;
    points.push({ price: first.price, size: remaining });
    for (const level of ordered) {
      points.push({ price: level.price, size: remaining });
      remaining -= level.size;
      points.push({ price: level.price, size: Math.max(0, remaining) });
    }
    return points;
  }
  let filled = 0;
  const first = ordered[0];
  if (!first) return points;
  points.push({ price: first.price, size: 0 });
  for (const level of ordered) {
    points.push({ price: level.price, size: filled });
    filled += level.size;
    points.push({ price: level.price, size: filled });
  }
  const last = ordered[ordered.length - 1];
  if (last) points.push({ price: last.price, size: filled });
  return points;
}

export function paintDepthChart(
  canvas: HTMLCanvasElement,
  book: DepthBook,
  colors: ChartColors,
  digits: number,
): void {
  const parent = canvas.parentElement;
  if (!parent) return;
  const width = parent.clientWidth;
  const height = parent.clientHeight;
  if (width < 10 || height < 10) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b0e11';
  ctx.fillRect(0, 0, width, height);

  const bids = stepSeries(book.bids, 'bid');
  const asks = stepSeries(book.asks, 'ask');
  if (bids.length === 0 && asks.length === 0) {
    ctx.fillStyle = '#848e9c';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Waiting for depth', 16, 28);
    return;
  }

  const prices = [...bids, ...asks].map((point) => point.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const span = maxPrice - minPrice || 1;
  const maxSize = Math.max(1, ...bids.map((point) => point.size), ...asks.map((point) => point.size));
  const padLeft = 58;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 28;
  const plotWidth = Math.max(1, width - padLeft - padRight);
  const plotHeight = Math.max(1, height - padTop - padBottom);
  const xOf = (price: number) => padLeft + ((price - minPrice) / span) * plotWidth;
  const yOf = (size: number) => padTop + (1 - size / maxSize) * plotHeight;
  const baseline = padTop + plotHeight;

  const fill = (points: Point[], color: string) => {
    if (points.length === 0) return;
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return;
    ctx.beginPath();
    ctx.moveTo(xOf(first.price), yOf(first.size));
    for (const point of points) ctx.lineTo(xOf(point.price), yOf(point.size));
    ctx.lineTo(xOf(last.price), baseline);
    ctx.lineTo(xOf(first.price), baseline);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, padTop, 0, baseline);
    gradient.addColorStop(0, hexAlpha(color, 0.55));
    gradient.addColorStop(1, hexAlpha(color, 0.05));
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(xOf(first.price), yOf(first.size));
    for (const point of points) ctx.lineTo(xOf(point.price), yOf(point.size));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  fill(bids, colors.up);
  fill(asks, colors.down);

  const bestBid = book.bids[0]?.price;
  const bestAsk = book.asks[0]?.price;
  const mid =
    bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : (bestBid ?? bestAsk ?? (minPrice + maxPrice) / 2);
  const midX = xOf(mid);
  ctx.beginPath();
  ctx.moveTo(midX, padTop);
  ctx.lineTo(midX, baseline);
  ctx.strokeStyle = 'rgba(234,236,239,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#848e9c';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const ticks = 5;
  for (let i = 0; i <= ticks; i += 1) {
    const size = (maxSize * i) / ticks;
    const y = yOf(size);
    ctx.fillText(formatSize(size), padLeft - 8, y);
  }

  ctx.textBaseline = 'top';
  const labels = [
    { x: padLeft, align: 'left' as const, price: minPrice, color: colors.up },
    { x: midX, align: 'center' as const, price: mid, color: '#eaecef' },
    { x: width - padRight, align: 'right' as const, price: maxPrice, color: colors.down },
  ];
  for (const label of labels) {
    ctx.textAlign = label.align;
    ctx.fillStyle = label.color;
    ctx.fillText(formatNumber(label.price, digits), label.x, baseline + 8);
  }
}
