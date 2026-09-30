import { registerOverlay, type OverlayFigure } from 'klinecharts';

let registered = false;

function textOf(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/** Custom overlays KLineChart does not ship: pattern, emoji, plain text, and a measure ruler. */
export function registerCustomOverlays(): void {
  if (registered) return;
  registered = true;

  registerOverlay<string>({
    name: 'textNote',
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates, overlay }) => {
      const point = coordinates[0];
      if (!point) return [];
      return [
        {
          type: 'text',
          attrs: {
            x: point.x,
            y: point.y,
            text: textOf(overlay.extendData, 'Text'),
            align: 'left',
            baseline: 'bottom',
          },
          styles: { color: '#f7a600', size: 14, backgroundColor: 'transparent' },
        },
      ];
    },
  });

  registerOverlay<string>({
    name: 'emojiMark',
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates, overlay }) => {
      const point = coordinates[0];
      if (!point) return [];
      return [
        {
          type: 'text',
          attrs: {
            x: point.x,
            y: point.y,
            text: textOf(overlay.extendData, '😀'),
            align: 'center',
            baseline: 'middle',
          },
          styles: { size: 22, backgroundColor: 'transparent' },
        },
      ];
    },
  });

  registerOverlay({
    name: 'xabcdPattern',
    totalStep: 6,
    needDefaultPointFigure: true,
    createPointFigures: ({ coordinates }) => {
      const labels = ['X', 'A', 'B', 'C', 'D'];
      const figures: OverlayFigure[] = [];
      if (coordinates.length >= 2) {
        figures.push({
          type: 'line',
          attrs: { coordinates },
        });
      }
      coordinates.forEach((point, index) => {
        figures.push({
          type: 'text',
          attrs: {
            x: point.x + 8,
            y: point.y,
            text: labels[index] ?? '',
            align: 'left',
            baseline: 'middle',
          },
          styles: { color: '#f7a600', size: 12, backgroundColor: 'transparent' },
        });
      });
      return figures;
    },
  });

  registerOverlay({
    name: 'measureRuler',
    totalStep: 3,
    needDefaultPointFigure: true,
    createPointFigures: ({ coordinates, overlay }) => {
      const start = coordinates[0];
      const end = coordinates[1];
      if (!start || !end) return [];
      const from = overlay.points[0]?.value ?? 0;
      const to = overlay.points[1]?.value ?? 0;
      const delta = to - from;
      const pct = from !== 0 ? (delta / from) * 100 : 0;
      const bars = Math.abs((overlay.points[1]?.dataIndex ?? 0) - (overlay.points[0]?.dataIndex ?? 0));
      const sign = delta > 0 ? '+' : '';
      const text = `${sign}${delta.toFixed(2)} (${sign}${pct.toFixed(2)}%)  ${bars} bars`;
      const left = Math.min(start.x, end.x);
      const top = Math.min(start.y, end.y);
      return [
        {
          type: 'rect',
          attrs: {
            x: left,
            y: top,
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y),
          },
          styles: {
            style: 'fill',
            color: delta >= 0 ? 'rgba(38,166,91,0.18)' : 'rgba(229,72,77,0.18)',
            borderColor: delta >= 0 ? '#26a65b' : '#e5484d',
          },
        },
        {
          type: 'line',
          attrs: { coordinates: [start, end] },
        },
        {
          type: 'text',
          attrs: {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
            text,
            align: 'center',
            baseline: 'middle',
          },
          styles: {
            color: '#ffffff',
            size: 12,
            backgroundColor: '#1e2329',
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: 4,
          },
        },
      ];
    },
  });
}
