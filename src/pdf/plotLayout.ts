// Function / data plots (physics graphs): y = f(x), parametric curves, data points,
// shaded integrals and reference lines → vector Scene.
import type { PlotBlock } from '../types';
import type { PdfTheme } from '../themes';
import { type Label, type Scene, type Shape, fmt, isHex, richWidth } from './scene';
import { safeCompile } from './expr';

const GRID = '#e8edf3';
const GRID2 = '#f3f6f9';
const AXIS = '#334155';
const TXT = '#475569';

function niceStep(range: number, ticks: number) {
  const raw = range / Math.max(1, ticks);
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
}
function fmtTick(v: number, step: number) {
  if (Math.abs(v) < step * 1e-6) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e5 || abs < 1e-3) {
    const e = Math.floor(Math.log10(abs));
    const m = v / 10 ** e;
    return `${+m.toFixed(1)}e${e}`;
  }
  const dec = Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9)));
  return v.toFixed(dec).replace('-', '−');
}

type P = [number, number];

export function layoutPlot(b: PlotBlock, theme: PdfTheme, width: number): Scene {
  const shapes: Shape[] = [];
  const labels: Label[] = [];
  const colorAt = (i: number, c?: string) => (isHex(c) ? c! : theme.palette[i % theme.palette.length]);

  // ---- gather curves in data space
  type Curve = { pts: (P | null)[]; color: string; dashed?: boolean; label?: string };
  const curves: Curve[] = [];
  const fns = b.functions ?? [];
  const dataX: number[] = [];
  const dataY: number[] = [];
  for (const d of b.data ?? []) for (const [x, y] of d.points) dataX.push(x), dataY.push(y);
  for (const p of b.points ?? []) dataX.push(p.x), dataY.push(p.y);
  for (const f of fns) if (f.domain) dataX.push(...f.domain);

  // parametric curves first (they define x extents)
  const par: Curve[] = [];
  (b.parametric ?? []).forEach((p, i) => {
    const fx = safeCompile(p.x, ['t']);
    const fy = safeCompile(p.y, ['t']);
    if (!fx || !fy) return;
    const [t0, t1] = p.t ?? [0, 2 * Math.PI];
    const pts: (P | null)[] = [];
    for (let k = 0; k <= 360; k++) {
      const t = t0 + ((t1 - t0) * k) / 360;
      const x = fx({ t });
      const y = fy({ t });
      if (Number.isFinite(x) && Number.isFinite(y)) {
        pts.push([x, y]);
        dataX.push(x);
        dataY.push(y);
      } else pts.push(null);
    }
    par.push({ pts, color: colorAt(fns.length + i, p.color), dashed: p.dashed, label: p.label });
  });

  let [x0, x1] = b.xRange ?? (dataX.length ? [Math.min(...dataX), Math.max(...dataX)] : [-5, 5]);
  if (!b.xRange && dataX.length) {
    if (x0 === x1) (x0 -= 1), (x1 += 1);
    if (x0 > 0 && x0 < (x1 - x0) * 0.35) x0 = 0;
    if (fns.length && !(b.data ?? []).length && !(b.parametric ?? []).length) {
      /* keep */
    } else {
      const pad = (x1 - x0) * 0.04;
      if (x0 !== 0) x0 -= pad;
      x1 += pad;
    }
  }

  const N = 480;
  fns.forEach((f, i) => {
    const fn = safeCompile(f.expr, ['x']);
    if (!fn) return;
    const [d0, d1] = f.domain ?? [x0, x1];
    const pts: (P | null)[] = [];
    for (let k = 0; k <= N; k++) {
      const x = d0 + ((d1 - d0) * k) / N;
      const y = fn({ x });
      pts.push(Number.isFinite(y) ? [x, y] : null);
    }
    curves.push({ pts, color: colorAt(i, f.color), dashed: f.dashed, label: f.label });
  });
  curves.push(...par);

  // ---- y range (robust against asymptotes)
  let y0: number, y1: number;
  if (b.yRange) [y0, y1] = b.yRange;
  else {
    const ys = [...dataY];
    for (const c of curves.slice(0, curves.length - par.length)) for (const p of c.pts) if (p) ys.push(p[1]);
    ys.sort((a, c) => a - c);
    if (!ys.length) [y0, y1] = [-1, 1];
    else {
      const q = (t: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.round(t * (ys.length - 1))))];
      const fnCount = curves.length - par.length;
      const lo = fnCount ? q(0.01) : ys[0];
      const hi = fnCount ? q(0.99) : ys[ys.length - 1];
      y0 = Math.min(lo, ...dataY);
      y1 = Math.max(hi, ...dataY);
      if ((b.shade ?? []).length) (y0 = Math.min(y0, 0)), (y1 = Math.max(y1, 0));
      if (y1 - y0 < 1e-9) (y0 -= 1), (y1 += 1);
      const span = y1 - y0;
      if (y0 > 0 && y0 < span * 0.5) y0 = 0;
      if (y1 < 0 && -y1 < span * 0.5) y1 = 0;
      const pad = span * 0.08;
      if (y0 !== 0) y0 -= pad;
      if (y1 !== 0) y1 += pad;
    }
  }
  for (const h of b.hlines ?? []) if (!b.yRange) (y0 = Math.min(y0, h.y)), (y1 = Math.max(y1, h.y));

  // ---- frame
  const legendItems = [...curves.filter((c) => c.label), ...(b.data ?? []).map((d, i) => ({ label: d.label, color: colorAt(fns.length + par.length + i, d.color), dashed: false, pts: [] }))].filter((c) => c.label);
  const H = Math.round(b.height ?? Math.min(260, Math.max(170, width * 0.56)));
  const yStep = niceStep(y1 - y0, H > 200 ? 6 : 5);
  const xStep = niceStep(x1 - x0, Math.max(4, Math.min(10, Math.floor(width / 60))));
  const yTicks: number[] = [];
  for (let v = Math.ceil(y0 / yStep - 1e-9) * yStep; v <= y1 + yStep * 1e-6; v += yStep) yTicks.push(v);
  const xTicks: number[] = [];
  for (let v = Math.ceil(x0 / xStep - 1e-9) * xStep; v <= x1 + xStep * 1e-6; v += xStep) xTicks.push(v);
  const tickW = Math.max(...yTicks.map((v) => richWidth(fmtTick(v, yStep), 7.5)), 10);
  const top = (b.title ? 22 : 8) + (b.yLabel ? 14 : 4);
  const left = tickW + 8 + (b.yLabel ? 16 : 0);
  const right = 14;
  const bottom = 20 + (b.xLabel ? 16 : 0);
  const pw = width - left - right;
  const ph = H - top - bottom;
  const X = (x: number) => left + ((x - x0) / (x1 - x0)) * pw;
  const Y = (y: number) => top + ph - ((y - y0) / (y1 - y0)) * ph;

  if (b.title) labels.push({ x: 0, y: 0, w: width, h: 16, text: b.title, size: 10, weight: 700, color: '#0f172a', align: 'center', rich: true });
  shapes.push({ kind: 'rect', x: left, y: top, w: pw, h: ph, fill: '#ffffff' });
  // minor grid
  for (let v = Math.ceil(x0 / (xStep / 2)) * (xStep / 2); v <= x1; v += xStep / 2) shapes.push({ kind: 'line', x1: X(v), y1: top, x2: X(v), y2: top + ph, stroke: GRID2, sw: 0.5 });
  for (let v = Math.ceil(y0 / (yStep / 2)) * (yStep / 2); v <= y1; v += yStep / 2) shapes.push({ kind: 'line', x1: left, y1: Y(v), x2: left + pw, y2: Y(v), stroke: GRID2, sw: 0.5 });
  for (const v of yTicks) {
    shapes.push({ kind: 'line', x1: left, y1: Y(v), x2: left + pw, y2: Y(v), stroke: GRID, sw: 0.7 });
    labels.push({ x: left - tickW - 6, y: Y(v) - 6, w: tickW, h: 12, text: fmtTick(v, yStep), size: 7.5, color: TXT, align: 'right', valign: 'middle' });
  }
  for (const v of xTicks) {
    shapes.push({ kind: 'line', x1: X(v), y1: top, x2: X(v), y2: top + ph, stroke: GRID, sw: 0.7 });
    labels.push({ x: X(v) - 25, y: top + ph + 4, w: 50, h: 11, text: fmtTick(v, xStep), size: 7.5, color: TXT, align: 'center' });
  }
  // zero axes
  if (y0 < 0 && y1 > 0) shapes.push({ kind: 'line', x1: left, y1: Y(0), x2: left + pw, y2: Y(0), stroke: AXIS, sw: 0.9 });
  if (x0 < 0 && x1 > 0) shapes.push({ kind: 'line', x1: X(0), y1: top, x2: X(0), y2: top + ph, stroke: AXIS, sw: 0.9 });
  shapes.push({ kind: 'rect', x: left, y: top, w: pw, h: ph, stroke: '#94a3b8', sw: 0.8 });
  if (b.xLabel) labels.push({ x: left, y: H - 15, w: pw, h: 14, text: b.xLabel, size: 8.5, color: '#1e293b', align: 'center', weight: 600, rich: true });
  if (b.yLabel) {
    // vertical text is not supported for labels, so place the y label above the axis, left-aligned
    labels.push({ x: 0, y: top - 17, w: Math.max(80, richWidth(b.yLabel, 8.5, true) + 4), h: 12, text: b.yLabel, size: 8.5, color: '#1e293b', weight: 600, rich: true });
  }

  // ---- clip helper: split a polyline into in-range screen segments
  const ymin = y0;
  const ymax = y1;
  const segments = (pts: (P | null)[]): P[][] => {
    const out: P[][] = [];
    let cur: P[] = [];
    const flush = () => {
      if (cur.length > 1) out.push(cur);
      cur = [];
    };
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = i ? pts[i - 1] : null;
      if (!p) {
        flush();
        continue;
      }
      const inside = p[1] >= ymin && p[1] <= ymax && p[0] >= x0 - 1e-9 && p[0] <= x1 + 1e-9;
      const prevInside = prev && prev[1] >= ymin && prev[1] <= ymax && prev[0] >= x0 - 1e-9 && prev[0] <= x1 + 1e-9;
      if (prev && inside !== !!prevInside && Math.abs(p[1] - prev[1]) < (ymax - ymin) * 20) {
        const yb = (inside ? prev[1] : p[1]) > ymax ? ymax : ymin;
        const t = (yb - prev[1]) / (p[1] - prev[1] || 1);
        if (t >= 0 && t <= 1) {
          const ip: P = [prev[0] + (p[0] - prev[0]) * t, yb];
          if (inside) cur.push([X(ip[0]), Y(ip[1])]);
          else {
            cur.push([X(ip[0]), Y(ip[1])]);
            flush();
          }
        } else if (!inside) flush();
      } else if (!inside) flush();
      if (inside) {
        if (prev && prevInside && Math.abs(p[1] - prev[1]) > (ymax - ymin) * 0.9) flush(); // asymptote jump
        cur.push([X(p[0]), Y(p[1])]);
      }
    }
    flush();
    return out;
  };
  const pathOf = (seg: P[]) => seg.map(([x, y], i) => `${i ? 'L' : 'M'} ${fmt(x)} ${fmt(y)}`).join(' ');

  // ---- shaded regions (area under curve)
  (b.shade ?? []).forEach((s, i) => {
    const fn = safeCompile(s.expr, ['x']);
    if (!fn) return;
    const a = Math.max(x0, Math.min(s.from, s.to));
    const c = Math.min(x1, Math.max(s.from, s.to));
    const pts: P[] = [];
    for (let k = 0; k <= 160; k++) {
      const x = a + ((c - a) * k) / 160;
      const y = Math.max(ymin, Math.min(ymax, fn({ x }) || 0));
      pts.push([X(x), Y(y)]);
    }
    const base = Y(Math.max(ymin, Math.min(ymax, 0)));
    const color = isHex(s.color) ? s.color! : curves[0]?.color ?? theme.primary;
    const d = `M ${fmt(X(a))} ${fmt(base)} ` + pts.map(([x, y]) => `L ${fmt(x)} ${fmt(y)}`).join(' ') + ` L ${fmt(X(c))} ${fmt(base)} Z`;
    shapes.push({ kind: 'path', d, fill: color, opacity: 0.16 });
    if (s.label) {
      const mx = (a + c) / 2;
      const my = (fn({ x: mx }) || 0) / 2;
      labels.push({ x: X(mx) - 40, y: Y(Math.max(ymin, Math.min(ymax, my))) - 7, w: 80, h: 14, text: s.label, size: 8.5, color: color, align: 'center', weight: 700, rich: true });
    }
    void i;
  });

  // ---- reference lines
  for (const v of b.vlines ?? []) {
    if (v.x < x0 || v.x > x1) continue;
    shapes.push({ kind: 'line', x1: X(v.x), y1: top, x2: X(v.x), y2: top + ph, stroke: '#64748b', sw: 0.9, dash: '4 3' });
    if (v.label) labels.push({ x: X(v.x) + 3, y: top + 3, w: richWidth(v.label, 8) + 6, h: 12, text: v.label, size: 8, color: '#334155', rich: true, bg: '#ffffff' });
  }
  for (const h of b.hlines ?? []) {
    if (h.y < ymin || h.y > ymax) continue;
    shapes.push({ kind: 'line', x1: left, y1: Y(h.y), x2: left + pw, y2: Y(h.y), stroke: '#64748b', sw: 0.9, dash: '4 3' });
    if (h.label) labels.push({ x: left + pw - richWidth(h.label, 8) - 8, y: Y(h.y) - 13, w: richWidth(h.label, 8) + 6, h: 12, text: h.label, size: 8, color: '#334155', rich: true, align: 'right' });
  }

  // ---- curves
  for (const c of curves) for (const seg of segments(c.pts)) shapes.push({ kind: 'path', d: pathOf(seg), stroke: c.color, sw: 1.8, dash: c.dashed ? '5 3' : undefined, cap: 'round' });

  // ---- data series
  (b.data ?? []).forEach((d, i) => {
    const color = colorAt(fns.length + par.length + i, d.color);
    const pts = d.points.filter(([x, y]) => x >= x0 && x <= x1 && y >= ymin && y <= ymax).map(([x, y]) => [X(x), Y(y)] as P);
    if (d.line && pts.length > 1) shapes.push({ kind: 'path', d: pathOf(pts), stroke: color, sw: 1.3 });
    for (const [x, y] of pts) shapes.push({ kind: 'circle', cx: x, cy: y, r: 2.6, fill: '#ffffff', stroke: color, sw: 1.4 });
  });

  // ---- marked points
  for (const p of b.points ?? []) {
    if (p.x < x0 || p.x > x1 || p.y < ymin || p.y > ymax) continue;
    shapes.push({ kind: 'circle', cx: X(p.x), cy: Y(p.y), r: 3, fill: theme.primaryDark, stroke: '#ffffff', sw: 1 });
    if (p.label) {
      const w = richWidth(p.label, 8) + 6;
      const rightSide = X(p.x) + w + 6 < left + pw;
      labels.push({ x: rightSide ? X(p.x) + 5 : X(p.x) - w - 5, y: Y(p.y) - 14, w, h: 12, text: p.label, size: 8, color: '#0f172a', weight: 600, rich: true, align: rightSide ? 'left' : 'right', bg: '#ffffff' });
    }
  }

  // ---- legend (top-right inside the frame)
  if (legendItems.length) {
    const lw = Math.max(...legendItems.map((l) => richWidth(l.label!, 8))) + 30;
    const lh = legendItems.length * 13 + 6;
    const lx = left + pw - lw - 6;
    const ly = top + 6;
    shapes.push({ kind: 'rect', x: lx, y: ly, w: lw, h: lh, rx: 3, fill: '#ffffff', stroke: '#e2e8f0', sw: 0.7, opacity: 0.92 });
    legendItems.forEach((l, i) => {
      const yy = ly + 9.5 + i * 13;
      shapes.push({ kind: 'line', x1: lx + 6, y1: yy, x2: lx + 20, y2: yy, stroke: l.color, sw: 2, dash: l.dashed ? '4 2' : undefined });
      labels.push({ x: lx + 24, y: yy - 6, w: lw - 26, h: 12, text: l.label!, size: 8, color: '#1e293b', valign: 'middle', rich: true });
    });
  }
  return { width, height: H, shapes, labels };
}
