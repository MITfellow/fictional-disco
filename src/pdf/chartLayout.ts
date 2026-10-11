import type { ChartBlock } from '../types';
import type { PdfTheme } from '../themes';
import { type Label, type Scene, type Shape, fmt, isHex, textWidth, tint } from './scene';

const AXIS = '#94a3b8';
const GRID = '#e2e8f0';
const TXT = '#475569';

function niceStep(range: number, ticks = 5) {
  const raw = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

export function fmtNum(v: number, unit = ''): string {
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1e9) s = (v / 1e9).toFixed(abs >= 1e10 ? 0 : 1) + 'B';
  else if (abs >= 1e6) s = (v / 1e6).toFixed(abs >= 1e7 ? 0 : 1) + 'M';
  else if (abs >= 1e4) s = (v / 1e3).toFixed(abs >= 1e5 ? 0 : 1) + 'K';
  else s = Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 1 : 0);
  s = s.replace(/\.0(?=[KMB]?$)/, '');
  if (!unit) return s;
  if (['$', '€', '£', '¥'].includes(unit)) return unit + s;
  return s + unit;
}

export function layoutChart(block: ChartBlock, theme: PdfTheme, width: number): Scene {
  const labels = (block.labels ?? []).map(String);
  const series = (block.series ?? []).filter((s) => Array.isArray(s.values)).map((s, i) => ({
    name: String(s.name ?? `Series ${i + 1}`),
    values: labels.map((_, j) => Number(s.values[j]) || 0),
    color: isHex(s.color) ? s.color! : theme.palette[i % theme.palette.length],
  }));
  if (!labels.length || !series.length) return { width, height: 40, shapes: [], labels: [{ x: 0, y: 10, w: width, h: 20, text: 'No chart data', size: 9, color: TXT, align: 'center' }] };
  const kind = block.kind ?? 'bar';
  if (kind === 'pie' || kind === 'donut') return pie(block, labels, series, theme, width);
  if (kind === 'hbar') return hbar(block, labels, series, width);
  return cartesian(block, labels, series, width, kind);
}

type S = { name: string; values: number[]; color: string };

function legend(series: { name: string; color: string }[], width: number, y: number, shapes: Shape[], out: Label[]) {
  const items = series.map((s) => ({ ...s, w: textWidth(s.name, 8) + 22 }));
  const total = items.reduce((a, b) => a + b.w, 0);
  let x = Math.max(0, (width - total) / 2);
  items.forEach((it) => {
    shapes.push({ kind: 'rect', x, y: y + 2, w: 9, h: 9, rx: 2, fill: it.color });
    out.push({ x: x + 12, y, w: it.w - 12, h: 13, text: it.name, size: 8, color: TXT, valign: 'middle' });
    x += it.w;
  });
}

function cartesian(block: ChartBlock, labels: string[], series: S[], width: number, kind: ChartBlock['kind']): Scene {
  const shapes: Shape[] = [];
  const out: Label[] = [];
  const stacked = kind === 'stacked';
  const height = 220;
  const showLegend = series.length > 1;
  const top = block.title ? 26 : 10;
  const bottom = 30 + (showLegend ? 18 : 0);
  let maxV = stacked ? Math.max(...labels.map((_, j) => series.reduce((s, se) => s + Math.max(0, se.values[j]), 0))) : Math.max(...series.flatMap((s) => s.values));
  let minV = Math.min(0, ...series.flatMap((s) => s.values));
  if (maxV === minV) maxV = minV + 1;
  const step = niceStep(maxV - minV);
  maxV = Math.ceil(maxV / step) * step;
  minV = Math.floor(minV / step) * step;
  const yLabelW = Math.max(...[maxV, minV].map((v) => textWidth(fmtNum(v, block.unit), 8))) + 10;
  const left = yLabelW + 4;
  const right = 10;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const yOf = (v: number) => top + plotH - ((v - minV) / (maxV - minV)) * plotH;

  if (block.title) out.push({ x: 0, y: 2, w: width, h: 16, text: block.title, size: 10.5, weight: 700, color: '#0f172a', align: 'center' });
  for (let v = minV; v <= maxV + step / 2; v += step) {
    const y = yOf(v);
    shapes.push({ kind: 'line', x1: left, y1: y, x2: width - right, y2: y, stroke: v === 0 ? AXIS : GRID, sw: v === 0 ? 1 : 0.7 });
    out.push({ x: 0, y: y - 6, w: yLabelW, h: 12, text: fmtNum(v, block.unit), size: 7.5, color: TXT, align: 'right', valign: 'middle' });
  }
  const band = plotW / labels.length;
  const maxLabelChars = Math.max(4, Math.floor(band / 4.4));
  labels.forEach((l, j) => {
    const t = l.length > maxLabelChars ? l.slice(0, maxLabelChars - 1) + '…' : l;
    out.push({ x: left + j * band, y: top + plotH + 5, w: band, h: 12, text: t, size: 7.5, color: TXT, align: 'center' });
  });

  if (kind === 'line' || kind === 'area') {
    series.forEach((s) => {
      const pts = s.values.map((v, j) => [left + band * j + band / 2, yOf(v)] as [number, number]);
      if (kind === 'area') {
        const base = yOf(Math.max(minV, 0));
        const d = `M ${fmt(pts[0][0])} ${fmt(base)} ` + pts.map(([x, y]) => `L ${fmt(x)} ${fmt(y)}`).join(' ') + ` L ${fmt(pts[pts.length - 1][0])} ${fmt(base)} Z`;
        shapes.push({ kind: 'path', d, fill: s.color, opacity: series.length > 1 ? 0.18 : 0.22 });
      }
      // smooth line (Catmull-Rom → Bezier)
      let d = `M ${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] ?? pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] ?? p2;
        const c1x = p1[0] + (p2[0] - p0[0]) / 6;
        const c1y = p1[1] + (p2[1] - p0[1]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6;
        const c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ` C ${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2[0])} ${fmt(p2[1])}`;
      }
      shapes.push({ kind: 'path', d, stroke: s.color, sw: 2, cap: 'round' });
      pts.forEach(([x, y]) => shapes.push({ kind: 'circle', cx: x, cy: y, r: 2.6, fill: '#ffffff', stroke: s.color, sw: 1.4 }));
      if (series.length === 1 && labels.length <= 12)
        pts.forEach(([x, y], j) => out.push({ x: x - 24, y: y - 15, w: 48, h: 10, text: fmtNum(s.values[j], block.unit), size: 7, color: '#334155', align: 'center', weight: 600 }));
    });
  } else {
    const groupW = band * 0.72;
    const n = stacked ? 1 : series.length;
    const barW = Math.min(34, groupW / n);
    labels.forEach((_, j) => {
      const gx = left + band * j + (band - barW * n) / 2;
      let acc = 0;
      series.forEach((s, i) => {
        const v = s.values[j];
        let y1: number;
        let y2: number;
        let x: number;
        if (stacked) {
          y1 = yOf(acc + Math.max(0, v));
          y2 = yOf(acc);
          acc += Math.max(0, v);
          x = gx;
        } else {
          y1 = yOf(Math.max(v, 0));
          y2 = yOf(Math.min(v, 0));
          x = gx + i * barW;
        }
        const h = Math.max(0.5, y2 - y1);
        shapes.push({ kind: 'rect', x: x + 1, y: y1, w: barW - 2, h, rx: Math.min(3, barW / 4), fill: s.color });
        if (!stacked && labels.length * n <= 16)
          out.push({ x: x - 8, y: y1 - 11, w: barW + 16, h: 10, text: fmtNum(v, block.unit), size: 6.8, color: '#334155', align: 'center', weight: 600 });
      });
      if (stacked && labels.length <= 14) out.push({ x: gx - 10, y: yOf(acc) - 11, w: barW + 20, h: 10, text: fmtNum(acc, block.unit), size: 6.8, color: '#334155', align: 'center', weight: 700 });
    });
  }
  shapes.push({ kind: 'line', x1: left, y1: top, x2: left, y2: top + plotH, stroke: AXIS, sw: 1 });
  if (showLegend) legend(series, width, height - 16, shapes, out);
  return { width, height, shapes, labels: out };
}

function hbar(block: ChartBlock, labels: string[], series: S[], width: number): Scene {
  const shapes: Shape[] = [];
  const out: Label[] = [];
  const s = series[0];
  const rowH = 20;
  const top = block.title ? 26 : 6;
  const labW = Math.min(width * 0.32, Math.max(...labels.map((l) => textWidth(l, 8.5))) + 10);
  const valW = 46;
  const plotW = width - labW - valW;
  const maxV = Math.max(...s.values, 1);
  if (block.title) out.push({ x: 0, y: 2, w: width, h: 16, text: block.title, size: 10.5, weight: 700, color: '#0f172a', align: 'center' });
  labels.forEach((l, j) => {
    const y = top + j * rowH;
    const v = s.values[j];
    const w = Math.max(1, (v / maxV) * plotW);
    const color = series.length === 1 ? s.color : s.color;
    out.push({ x: 0, y: y + 3, w: labW - 8, h: 12, text: l, size: 8.5, color: '#1e293b', align: 'right', valign: 'middle' });
    shapes.push({ kind: 'rect', x: labW, y: y + 3, w: plotW, h: 13, rx: 3, fill: tint(color, 0.9) });
    shapes.push({ kind: 'rect', x: labW, y: y + 3, w, h: 13, rx: 3, fill: color });
    out.push({ x: labW + w + 4, y: y + 3, w: valW, h: 13, text: fmtNum(v, block.unit), size: 8, weight: 700, color: '#334155', valign: 'middle' });
  });
  return { width, height: top + labels.length * rowH + 6, shapes, labels: out };
}

function pie(block: ChartBlock, labels: string[], series: S[], theme: PdfTheme, width: number): Scene {
  const shapes: Shape[] = [];
  const out: Label[] = [];
  const vals = series[0].values.map((v) => Math.max(0, v));
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const top = block.title ? 24 : 4;
  const R = 78;
  const cx = Math.min(width * 0.32, 140);
  const cy = top + R + 6;
  const donut = block.kind === 'donut';
  if (block.title) out.push({ x: 0, y: 2, w: width, h: 16, text: block.title, size: 10.5, weight: 700, color: '#0f172a', align: 'center' });
  let a = -Math.PI / 2;
  vals.forEach((v, i) => {
    const color = theme.palette[i % theme.palette.length];
    const frac = v / total;
    const a2 = a + frac * Math.PI * 2;
    if (frac >= 0.9999) {
      shapes.push({ kind: 'circle', cx, cy, r: R, fill: color });
    } else if (frac > 0) {
      const large = a2 - a > Math.PI ? 1 : 0;
      const x1 = cx + Math.cos(a) * R;
      const y1 = cy + Math.sin(a) * R;
      const x2 = cx + Math.cos(a2) * R;
      const y2 = cy + Math.sin(a2) * R;
      shapes.push({ kind: 'path', d: `M ${fmt(cx)} ${fmt(cy)} L ${fmt(x1)} ${fmt(y1)} A ${R} ${R} 0 ${large} 1 ${fmt(x2)} ${fmt(y2)} Z`, fill: color, stroke: '#ffffff', sw: 1.5 });
    }
    if (frac > 0.05) {
      const mid = (a + a2) / 2;
      const rr = donut ? R * 0.78 : R * 0.64;
      out.push({ x: cx + Math.cos(mid) * rr - 20, y: cy + Math.sin(mid) * rr - 5, w: 40, h: 10, text: `${Math.round(frac * 100)}%`, size: 7.5, weight: 700, color: '#ffffff', align: 'center', valign: 'middle' });
    }
    a = a2;
  });
  if (donut) {
    shapes.push({ kind: 'circle', cx, cy, r: R * 0.56, fill: '#ffffff' });
    out.push({ x: cx - 40, y: cy - 14, w: 80, h: 16, text: fmtNum(total, block.unit), size: 14, weight: 800, color: '#0f172a', align: 'center', valign: 'middle' });
    out.push({ x: cx - 40, y: cy + 3, w: 80, h: 10, text: 'TOTAL', size: 6.5, weight: 700, color: TXT, align: 'center' });
  }
  // legend list
  const lx = cx + R + 30;
  const lw = width - lx;
  const rowH = 17;
  const ly = cy - (labels.length * rowH) / 2;
  labels.forEach((l, i) => {
    const y = ly + i * rowH;
    const color = theme.palette[i % theme.palette.length];
    shapes.push({ kind: 'rect', x: lx, y: y + 3, w: 10, h: 10, rx: 3, fill: color });
    out.push({ x: lx + 16, y: y + 1, w: lw - 80, h: 14, text: l, size: 8.5, color: '#1e293b', valign: 'middle' });
    out.push({ x: width - 70, y: y + 1, w: 70, h: 14, text: block.unit === '%' ? `${fmtNum(vals[i], '%')}` : `${fmtNum(vals[i], block.unit)} · ${Math.round((vals[i] / total) * 100)}%`, size: 8, color: TXT, align: 'right', valign: 'middle', weight: 600 });
    shapes.push({ kind: 'line', x1: lx, y1: y + rowH, x2: width, y2: y + rowH, stroke: GRID, sw: 0.5 });
  });
  const height = Math.max(cy + R + 8, ly + labels.length * rowH + 8);
  return { width, height, shapes, labels: out };
}
