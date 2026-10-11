// Free-form scientific drawings: the AI places primitives in a y-up coordinate box.
// Physics helpers (vectors, springs, inclined blocks, pulleys, lenses, waves, circuit parts…)
// are expanded into vector shapes here.
import type { FigElement, FigureBlock, Pt } from '../types';
import type { PdfTheme } from '../themes';
import { type Label, type Scene, type Shape, fmt, isHex, richWidth, tint } from './scene';

type P = [number, number];
const INK = '#1e293b';

const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const mul = (a: P, k: number): P => [a[0] * k, a[1] * k];
const len = (a: P) => Math.hypot(a[0], a[1]);
const unit = (a: P): P => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
const perp = (a: P): P => [-a[1], a[0]];
const rot = (p: P, c: P, deg: number): P => {
  const r = (deg * Math.PI) / 180;
  const d = sub(p, c);
  return [c[0] + d[0] * Math.cos(r) - d[1] * Math.sin(r), c[1] + d[0] * Math.sin(r) + d[1] * Math.cos(r)];
};
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function layoutFigure(b: FigureBlock, theme: PdfTheme, maxW: number, maxH: number): Scene {
  const W = Math.max(1, b.width);
  const H = Math.max(1, b.height);
  const pad = 14;
  const targetW = maxW * ((b.scale ?? 100) / 100) - pad * 2;
  const k = Math.max(0.05, Math.min(targetW / W, (maxH - pad * 2) / H));
  const S = (p: Pt | P): P => [pad + p[0] * k, pad + (H - p[1]) * k]; // to screen (y down)
  const shapes: Shape[] = [];
  const labels: Label[] = [];
  const palette = theme.palette;

  const color = (e: FigElement, d = INK) => (isHex(e.color) ? e.color! : e.color && /^[a-z]+$/i.test(e.color) ? cssColor(e.color, theme) : d);
  const fillOf = (e: FigElement, d?: string) => (e.fill === 'none' ? undefined : isHex(e.fill) ? e.fill : e.fill ? cssColor(e.fill, theme) : d);
  const sw = (e: FigElement, d = 1.3) => (e.width && e.width > 0 && e.width < 8 ? e.width : d);
  const dash = (e: FigElement) => (e.dashed ? '4 3' : undefined);
  const poly = (pts: P[], closed = false) => pts.map((p, i) => `${i ? 'L' : 'M'} ${fmt(p[0])} ${fmt(p[1])}`).join(' ') + (closed ? ' Z' : '');

  // text label at a screen point with anchor
  const text = (s: string, at: P, opts: { pos?: FigElement['labelPos']; size?: number; color?: string; weight?: 400 | 600 | 700; bg?: string } = {}) => {
    if (!s) return;
    const size = opts.size ?? 9;
    const w = richWidth(s, size, opts.weight === 700) * 1.2 + 8;
    const h = size * 1.45;
    const gap = 3;
    let x = at[0] - w / 2;
    let y = at[1] - h / 2;
    let align: Label['align'] = 'center';
    switch (opts.pos) {
      case 'above':
        y = at[1] - h - gap;
        break;
      case 'below':
        y = at[1] + gap;
        break;
      case 'left':
        x = at[0] - w - gap;
        align = 'right';
        break;
      case 'right':
        x = at[0] + gap;
        align = 'left';
        break;
    }
    labels.push({ x, y, w, h, text: s, size, color: opts.color ?? INK, align, valign: 'middle', rich: true, weight: opts.weight, bg: opts.bg });
  };
  // label beside a segment (perpendicular offset, on the left of the direction of travel)
  const sideLabel = (s: string | undefined, a: P, c: P, e: FigElement, off = 9, t = 0.5) => {
    if (!s) return;
    const m = lerp(a, c, t);
    const n = unit(perp(sub(c, a)));
    // screen coords: perp points … choose the side that is "above" for horizontal lines
    let dir: P = n[1] > 0 ? mul(n, -1) : n;
    if (e.labelPos === 'below') dir = mul(dir, -1);
    if (e.labelPos === 'right') dir = [1, 0];
    if (e.labelPos === 'left') dir = [-1, 0];
    const size = e.fontSize ?? 9;
    const w = richWidth(s, size) + 4;
    const at = add(m, mul(dir, off + Math.abs(dir[0]) * w * 0.5));
    text(s, at, { size, color: color(e) });
  };

  const arrowHead = (tip: P, from: P, c: string, w: number) => {
    const d = unit(sub(tip, from));
    const L = 5 + w * 2.2;
    const Wd = 2.6 + w * 1.1;
    const base = sub(tip, mul(d, L));
    const n = perp(d);
    shapes.push({ kind: 'polygon', points: [tip, add(base, mul(n, Wd)), sub(base, mul(n, Wd))], fill: c });
    return base;
  };
  const line = (a: P, c: P, e: FigElement, col: string, w: number, arrow: FigElement['arrow'] = 'none') => {
    let s0 = a;
    let s1 = c;
    if (arrow === 'end' || arrow === 'both') s1 = arrowHead(c, a, col, w);
    if (arrow === 'start' || arrow === 'both') s0 = arrowHead(a, c, col, w);
    shapes.push({ kind: 'line', x1: s0[0], y1: s0[1], x2: s1[0], y2: s1[1], stroke: col, sw: w, dash: dash(e) });
  };
  // two-terminal component helper: draws leads, returns the body span (screen coords)
  const twoTerminal = (e: FigElement, bodyLen: number, draw: (a: P, c: P, d: P, n: P, col: string) => void) => {
    if (!e.from || !e.to) return;
    const a = S(e.from);
    const c = S(e.to);
    const col = color(e);
    const L = len(sub(c, a));
    const d = unit(sub(c, a));
    const n = perp(d);
    const bl = Math.min(bodyLen, L * 0.8);
    const m = lerp(a, c, 0.5);
    const p0 = sub(m, mul(d, bl / 2));
    const p1 = add(m, mul(d, bl / 2));
    shapes.push({ kind: 'line', x1: a[0], y1: a[1], x2: p0[0], y2: p0[1], stroke: col, sw: sw(e, 1.3) });
    shapes.push({ kind: 'line', x1: p1[0], y1: p1[1], x2: c[0], y2: c[1], stroke: col, sw: sw(e, 1.3) });
    draw(p0, p1, d, n, col);
    if (e.label) {
      const side = Math.abs(d[0]) > Math.abs(d[1]) ? (e.labelPos === 'below' ? 1 : -1) : 0;
      const at = side ? add(m, [0, side * 16]) : add(m, [e.labelPos === 'left' ? -14 : 14, 0]);
      text(e.label, at, { size: e.fontSize ?? 9, color: col, pos: side ? undefined : e.labelPos === 'left' ? 'left' : 'right' });
    }
  };

  let autoColor = 0;
  for (const e of b.elements) {
    const t = e.type.toLowerCase();
    try {
      switch (t) {
        case 'line':
        case 'wire':
        case 'rope':
        case 'string':
        case 'rod': {
          if (!e.from && e.points?.length === 2) {
            e.from = e.points[0];
            e.to = e.points[1];
          }
          if (e.points && e.points.length > 2) {
            shapes.push({ kind: 'path', d: poly(e.points.map(S)), stroke: color(e), sw: sw(e, t === 'rod' ? 3 : 1.3), dash: dash(e) });
            break;
          }
          if (!e.from || !e.to) break;
          line(S(e.from), S(e.to), e, color(e), sw(e, t === 'rod' ? 3 : 1.3), e.arrow ?? 'none');
          sideLabel(e.label, S(e.from), S(e.to), e);
          break;
        }
        case 'polyline':
        case 'path': {
          if (!e.points?.length) break;
          const pts = e.points.map(S);
          shapes.push({ kind: 'path', d: e.smooth ? spline(pts, !!e.closed) : poly(pts, !!e.closed), stroke: color(e), sw: sw(e), dash: dash(e), fill: fillOf(e), cap: 'round' });
          if (e.arrow === 'end' && pts.length > 1) arrowHead(pts[pts.length - 1], pts[pts.length - 2], color(e), sw(e));
          if (e.label) text(e.label, pts[pts.length - 1], { pos: e.labelPos ?? 'right', color: color(e) });
          break;
        }
        case 'curve':
        case 'trajectory': {
          if (!e.points?.length) break;
          const pts = e.points.map(S);
          shapes.push({ kind: 'path', d: spline(pts, !!e.closed), stroke: color(e, theme.primary), sw: sw(e, 1.6), dash: dash(e), fill: fillOf(e), cap: 'round' });
          if (e.arrow === 'end' && pts.length > 1) arrowHead(pts[pts.length - 1], pts[pts.length - 2], color(e, theme.primary), sw(e, 1.6));
          if (e.label) text(e.label, pts[Math.floor(pts.length / 2)], { pos: e.labelPos ?? 'above', color: color(e, theme.primary) });
          break;
        }
        case 'arrow':
        case 'vector':
        case 'force':
        case 'velocity': {
          if (!e.from) break;
          const to = e.to ?? (e.length ? add(e.from as P, e.length as P) : null);
          if (!to) break;
          const def = t === 'arrow' ? INK : palette[autoColor++ % palette.length];
          const col = color(e, def);
          const w = sw(e, t === 'arrow' ? 1.3 : 1.9);
          const a = S(e.from);
          const c = S(to);
          line(a, c, e, col, w, e.arrow ?? 'end');
          if (e.label) {
            if (e.labelPos === 'end' || (!e.labelPos && t !== 'arrow')) {
              const d = unit(sub(c, a));
              const size = e.fontSize ?? 9.5;
              const wl = richWidth(e.label, size, true);
              text(e.label, add(c, [d[0] * (wl / 2 + 5), d[1] * 9]), { size, color: col, weight: 700 });
            } else sideLabel(e.label, a, c, e, 8);
          }
          break;
        }
        case 'rect':
        case 'box':
        case 'block':
        case 'mass': {
          const size: P = (e.size as P) ?? [e.width ?? 20, e.height ?? 14];
          const center: P = e.center ? (e.center as P) : e.at ? [e.at[0] + size[0] / 2, e.at[1] + size[1] / 2] : [W / 2, H / 2];
          const corners: P[] = [
            [center[0] - size[0] / 2, center[1] - size[1] / 2],
            [center[0] + size[0] / 2, center[1] - size[1] / 2],
            [center[0] + size[0] / 2, center[1] + size[1] / 2],
            [center[0] - size[0] / 2, center[1] + size[1] / 2],
          ].map((p) => (e.rotate ? rot(p as P, center, e.rotate) : (p as P)));
          const isMass = t === 'block' || t === 'mass';
          shapes.push({ kind: 'polygon', points: corners.map(S), fill: fillOf(e, isMass ? tint(theme.primary, 0.78) : undefined) ?? 'none', stroke: color(e, isMass ? theme.primaryDark : INK), sw: sw(e, 1.2) });
          if (e.label || e.text) text(e.label ?? e.text ?? '', S(center), { size: e.fontSize ?? 10, color: isMass ? theme.primaryDark : color(e), weight: 700 });
          break;
        }
        case 'circle':
        case 'ball':
        case 'particle':
        case 'charge': {
          const c = (e.center ?? e.at) as P | undefined;
          if (!c) break;
          const r = (e.r ?? (t === 'circle' ? 10 : 4)) * k;
          const isQ = t === 'charge';
          const neg = isQ && /−|-/.test(e.label ?? e.text ?? e.kind ?? '');
          const def = t === 'circle' ? undefined : isQ ? (neg ? '#dbeafe' : '#fee2e2') : tint(theme.primary, 0.55);
          shapes.push({ kind: 'circle', cx: S(c)[0], cy: S(c)[1], r, fill: fillOf(e, def) ?? 'none', stroke: color(e, isQ ? (neg ? '#2563eb' : '#dc2626') : t === 'circle' ? INK : theme.primaryDark), sw: sw(e, 1.2), opacity: 1 });
          if (e.label || e.text) {
            const inside = isQ || (r > 9 && (e.labelPos ?? 'center') === 'center');
            text(e.label ?? e.text ?? '', inside ? S(c) : add(S(c), [0, 0]), { pos: inside ? undefined : e.labelPos ?? 'above', size: e.fontSize ?? (isQ ? 11 : 9), color: isQ ? (neg ? '#1d4ed8' : '#b91c1c') : color(e), weight: isQ ? 700 : 400 });
            if (!inside && (e.labelPos ?? 'above') === 'above') labels[labels.length - 1].y -= r;
          }
          break;
        }
        case 'ellipse': {
          const c = (e.center ?? e.at) as P | undefined;
          if (!c) break;
          shapes.push({ kind: 'ellipse', cx: S(c)[0], cy: S(c)[1], rx: (e.rx ?? 10) * k, ry: (e.ry ?? 6) * k, fill: fillOf(e) ?? 'none', stroke: color(e), sw: sw(e), opacity: 1 });
          if (e.label) text(e.label, S(c), { size: e.fontSize ?? 9, color: color(e) });
          break;
        }
        case 'polygon':
        case 'triangle':
        case 'incline':
        case 'wedge': {
          const pts = e.points?.length ? e.points.map((p) => S(p)) : null;
          if (!pts) break;
          const fill = fillOf(e, t === 'incline' || t === 'wedge' ? '#e2e8f0' : undefined);
          shapes.push({ kind: 'polygon', points: pts, fill: fill ?? 'none', stroke: color(e, t === 'incline' || t === 'wedge' ? '#475569' : INK), sw: sw(e, 1.2) });
          if (e.label) {
            const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
            const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
            text(e.label, [cx, cy], { size: e.fontSize ?? 9, color: color(e) });
          }
          break;
        }
        case 'arc': {
          const c = (e.center ?? e.at) as P | undefined;
          if (!c) break;
          const r = e.r ?? 10;
          const a0 = e.startAngle ?? 0;
          const a1 = e.endAngle ?? 90;
          const pts: P[] = [];
          for (let i = 0; i <= 48; i++) {
            const a = ((a0 + ((a1 - a0) * i) / 48) * Math.PI) / 180;
            pts.push(S([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]));
          }
          shapes.push({ kind: 'path', d: poly(pts), stroke: color(e), sw: sw(e), dash: dash(e) });
          if (e.arrow === 'end' || e.arrow === 'both') arrowHead(pts[pts.length - 1], pts[pts.length - 3], color(e), sw(e));
          if (e.arrow === 'start' || e.arrow === 'both') arrowHead(pts[0], pts[2], color(e), sw(e));
          if (e.label) {
            const am = (((a0 + a1) / 2) * Math.PI) / 180;
            text(e.label, S([c[0] + (r + 6 / k) * Math.cos(am), c[1] + (r + 6 / k) * Math.sin(am)]), { size: e.fontSize ?? 9, color: color(e) });
          }
          break;
        }
        case 'angle': {
          const v = (e.at ?? e.center) as P | undefined;
          if (!v) break;
          let a0 = e.startAngle;
          let a1 = e.endAngle;
          if (a0 == null && e.from) a0 = (Math.atan2(e.from[1] - v[1], e.from[0] - v[0]) * 180) / Math.PI;
          if (a1 == null && e.to) a1 = (Math.atan2(e.to[1] - v[1], e.to[0] - v[0]) * 180) / Math.PI;
          a0 ??= 0;
          a1 ??= 30;
          if (a1 < a0) a1 += 360;
          if (a1 - a0 > 180) [a0, a1] = [a1 - 360, a0];
          const r = e.r ?? Math.max(4, 22 / k);
          const col = color(e, '#475569');
          if (Math.abs(a1 - a0 - 90) < 0.5 && e.kind !== 'arc') {
            const p1 = add(v, [r * 0.6 * Math.cos((a0 * Math.PI) / 180), r * 0.6 * Math.sin((a0 * Math.PI) / 180)]);
            const p2 = add(v, [r * 0.6 * Math.cos((a1 * Math.PI) / 180), r * 0.6 * Math.sin((a1 * Math.PI) / 180)]);
            const p3 = add(p1, sub(p2, v));
            shapes.push({ kind: 'path', d: poly([S(p1), S(p3), S(p2)]), stroke: col, sw: 0.9 });
          } else {
            const pts: P[] = [];
            for (let i = 0; i <= 32; i++) {
              const a = ((a0 + ((a1 - a0) * i) / 32) * Math.PI) / 180;
              pts.push(S([v[0] + r * Math.cos(a), v[1] + r * Math.sin(a)]));
            }
            shapes.push({ kind: 'path', d: poly(pts), stroke: col, sw: 0.9 });
          }
          if (e.label) {
            const am = (((a0 + a1) / 2) * Math.PI) / 180;
            const rr = r + 9 / k;
            text(e.label, S([v[0] + rr * Math.cos(am), v[1] + rr * Math.sin(am)]), { size: e.fontSize ?? 9, color: col });
          }
          break;
        }
        case 'text':
        case 'label':
        case 'note': {
          const at = (e.at ?? e.center ?? e.from) as P | undefined;
          if (!at) break;
          text(e.text ?? e.label ?? '', S(at), { pos: e.labelPos === 'center' ? undefined : e.labelPos, size: e.fontSize ?? 9.5, color: color(e), weight: e.kind === 'bold' ? 700 : undefined });
          break;
        }
        case 'dot':
        case 'point': {
          const at = (e.at ?? e.center) as P | undefined;
          if (!at) break;
          shapes.push({ kind: 'circle', cx: S(at)[0], cy: S(at)[1], r: e.r ? e.r * k : 2.4, fill: color(e) });
          if (e.label) text(e.label, S(at), { pos: e.labelPos ?? 'above', size: e.fontSize ?? 9, color: color(e) });
          break;
        }
        case 'spring': {
          if (!e.from || !e.to) break;
          const a = S(e.from);
          const c = S(e.to);
          const d = unit(sub(c, a));
          const n = perp(d);
          const L = len(sub(c, a));
          const coils = Math.max(3, Math.min(30, e.coils ?? 8));
          const amp = (e.amplitude ?? 0) * k || Math.min(7, L * 0.08 + 3);
          const lead = Math.min(8, L * 0.12);
          const pts: P[] = [a, add(a, mul(d, lead))];
          const span = L - lead * 2;
          for (let i = 0; i < coils * 2; i++) pts.push(add(add(a, mul(d, lead + (span * (i + 0.5)) / (coils * 2))), mul(n, i % 2 ? -amp : amp)));
          pts.push(sub(c, mul(d, lead)), c);
          shapes.push({ kind: 'path', d: poly(pts), stroke: color(e, '#475569'), sw: sw(e, 1.1) });
          sideLabel(e.label, a, c, e, amp + 7);
          break;
        }
        case 'ground':
        case 'wall':
        case 'surface':
        case 'ceiling':
        case 'floor': {
          if (!e.from || !e.to) break;
          const a = S(e.from);
          const c = S(e.to);
          const d = unit(sub(c, a));
          let n = perp(d); // hatch side
          if (t === 'ceiling') n = n[1] > 0 ? mul(n, -1) : n;
          else n = n[1] < 0 ? mul(n, -1) : n; // below for floors/grounds
          if (e.kind === 'flip') n = mul(n, -1);
          const L = len(sub(c, a));
          shapes.push({ kind: 'line', x1: a[0], y1: a[1], x2: c[0], y2: c[1], stroke: color(e, '#334155'), sw: sw(e, 1.4) });
          const step = 6;
          for (let s = step / 2; s < L; s += step) {
            const p = add(a, mul(d, s));
            const q = add(add(p, mul(n, 6)), mul(d, -4));
            shapes.push({ kind: 'line', x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: '#94a3b8', sw: 0.7 });
          }
          sideLabel(e.label, a, c, e);
          break;
        }
        case 'resistor':
          twoTerminal(e, 34, (p0, p1, d, n, col) => {
            const pts: P[] = [p0];
            const L = len(sub(p1, p0));
            for (let i = 0; i < 6; i++) pts.push(add(add(p0, mul(d, (L * (i + 0.5)) / 6)), mul(n, i % 2 ? -5 : 5)));
            pts.push(p1);
            shapes.push({ kind: 'path', d: poly(pts), stroke: col, sw: 1.3 });
          });
          break;
        case 'capacitor':
          twoTerminal(e, 8, (p0, p1, _d, n, col) => {
            for (const p of [p0, p1]) {
              const q0 = add(p, mul(n, 10));
              const q1 = sub(p, mul(n, 10));
              shapes.push({ kind: 'line', x1: q0[0], y1: q0[1], x2: q1[0], y2: q1[1], stroke: col, sw: 1.8 });
            }
          });
          break;
        case 'battery':
        case 'cell':
          twoTerminal(e, 8, (p0, p1, _d, n, col) => {
            const a0 = add(p0, mul(n, 12));
            const a1 = sub(p0, mul(n, 12));
            const b0 = add(p1, mul(n, 6));
            const b1 = sub(p1, mul(n, 6));
            shapes.push({ kind: 'line', x1: a0[0], y1: a0[1], x2: a1[0], y2: a1[1], stroke: col, sw: 1.4 });
            shapes.push({ kind: 'line', x1: b0[0], y1: b0[1], x2: b1[0], y2: b1[1], stroke: col, sw: 2.6 });
          });
          break;
        case 'inductor':
        case 'coil':
          twoTerminal(e, 36, (p0, p1, d, n, col) => {
            const L = len(sub(p1, p0));
            const loops = 4;
            let path = `M ${fmt(p0[0])} ${fmt(p0[1])}`;
            for (let i = 0; i < loops; i++) {
              const s = add(p0, mul(d, (L * i) / loops));
              const e2 = add(p0, mul(d, (L * (i + 1)) / loops));
              const c1 = add(add(s, mul(d, L / loops / 6)), mul(n, -9));
              const c2 = add(sub(e2, mul(d, L / loops / 6)), mul(n, -9));
              path += ` C ${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(e2[0])} ${fmt(e2[1])}`;
            }
            shapes.push({ kind: 'path', d: path, stroke: col, sw: 1.3 });
          });
          break;
        case 'bulb':
        case 'lamp':
          twoTerminal(e, 18, (p0, p1, _d, _n, col) => {
            const m = lerp(p0, p1, 0.5);
            shapes.push({ kind: 'circle', cx: m[0], cy: m[1], r: 9, fill: '#fffbeb', stroke: col, sw: 1.3 });
            const r = 6.3;
            shapes.push({ kind: 'line', x1: m[0] - r, y1: m[1] - r, x2: m[0] + r, y2: m[1] + r, stroke: col, sw: 1 });
            shapes.push({ kind: 'line', x1: m[0] - r, y1: m[1] + r, x2: m[0] + r, y2: m[1] - r, stroke: col, sw: 1 });
          });
          break;
        case 'meter':
        case 'ammeter':
        case 'voltmeter':
        case 'galvanometer':
          twoTerminal(e, 20, (p0, p1, _d, _n, col) => {
            const m = lerp(p0, p1, 0.5);
            shapes.push({ kind: 'circle', cx: m[0], cy: m[1], r: 10, fill: '#ffffff', stroke: col, sw: 1.3 });
            const letter = t === 'ammeter' ? 'A' : t === 'voltmeter' ? 'V' : t === 'galvanometer' ? 'G' : (e.kind ?? e.text ?? 'A').slice(0, 2);
            labels.push({ x: m[0] - 10, y: m[1] - 7, w: 20, h: 14, text: letter, size: 9.5, color: col, align: 'center', valign: 'middle', weight: 700 });
          });
          break;
        case 'switch':
          twoTerminal(e, 24, (p0, p1, d, n, col) => {
            shapes.push({ kind: 'circle', cx: p0[0], cy: p0[1], r: 2, fill: '#ffffff', stroke: col, sw: 1.1 });
            shapes.push({ kind: 'circle', cx: p1[0], cy: p1[1], r: 2, fill: '#ffffff', stroke: col, sw: 1.1 });
            const closed = e.kind === 'closed';
            const tip = closed ? p1 : add(sub(p1, mul(d, 3)), mul(n, -11));
            shapes.push({ kind: 'line', x1: p0[0], y1: p0[1], x2: tip[0], y2: tip[1], stroke: col, sw: 1.3 });
          });
          break;
        case 'source':
        case 'ac':
          twoTerminal(e, 22, (p0, p1, d, n, col) => {
            const m = lerp(p0, p1, 0.5);
            shapes.push({ kind: 'circle', cx: m[0], cy: m[1], r: 11, fill: '#ffffff', stroke: col, sw: 1.3 });
            const pts: P[] = [];
            for (let i = 0; i <= 24; i++) {
              const s = -6 + (12 * i) / 24;
              pts.push(add(add(m, mul(d, s)), mul(n, -3.5 * Math.sin((s / 6) * Math.PI))));
            }
            shapes.push({ kind: 'path', d: poly(pts), stroke: col, sw: 1.1 });
          });
          break;
        case 'diode':
          twoTerminal(e, 14, (p0, p1, _d, n, col) => {
            shapes.push({ kind: 'polygon', points: [add(p0, mul(n, 7)), sub(p0, mul(n, 7)), p1], fill: col });
            const q0 = add(p1, mul(n, 7));
            const q1 = sub(p1, mul(n, 7));
            shapes.push({ kind: 'line', x1: q0[0], y1: q0[1], x2: q1[0], y2: q1[1], stroke: col, sw: 1.6 });
          });
          break;
        case 'lens': {
          const at = (e.at ?? e.center) as P | undefined;
          if (!at) break;
          const h = (e.height ?? H * 0.6) * k;
          const c = S(at);
          const concave = e.kind === 'concave' || e.kind === 'diverging';
          const bulge = Math.max(5, h * 0.12);
          const top: P = [c[0], c[1] - h / 2];
          const bot: P = [c[0], c[1] + h / 2];
          const d = concave
            ? `M ${fmt(top[0] - bulge)} ${fmt(top[1])} L ${fmt(top[0] + bulge)} ${fmt(top[1])} Q ${fmt(c[0] + 2)} ${fmt(c[1])} ${fmt(bot[0] + bulge)} ${fmt(bot[1])} L ${fmt(bot[0] - bulge)} ${fmt(bot[1])} Q ${fmt(c[0] - 2)} ${fmt(c[1])} ${fmt(top[0] - bulge)} ${fmt(top[1])} Z`
            : `M ${fmt(top[0])} ${fmt(top[1])} Q ${fmt(c[0] + bulge * 2)} ${fmt(c[1])} ${fmt(bot[0])} ${fmt(bot[1])} Q ${fmt(c[0] - bulge * 2)} ${fmt(c[1])} ${fmt(top[0])} ${fmt(top[1])} Z`;
          shapes.push({ kind: 'path', d, fill: '#cfe8ff', stroke: color(e, '#2563eb'), sw: 1.1, opacity: 0.85 });
          if (e.label) text(e.label, top, { pos: 'above', size: e.fontSize ?? 9, color: color(e, '#1d4ed8') });
          break;
        }
        case 'mirror': {
          if (!e.from || !e.to) break;
          const a = S(e.from);
          const c = S(e.to);
          const d = unit(sub(c, a));
          let n = perp(d);
          if (e.kind === 'flip') n = mul(n, -1);
          shapes.push({ kind: 'line', x1: a[0], y1: a[1], x2: c[0], y2: c[1], stroke: color(e, '#334155'), sw: 2 });
          const L = len(sub(c, a));
          for (let s = 3; s < L; s += 5) {
            const p = add(a, mul(d, s));
            const q = add(add(p, mul(n, 5)), mul(d, -3));
            shapes.push({ kind: 'line', x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: '#94a3b8', sw: 0.7 });
          }
          sideLabel(e.label, a, c, e);
          break;
        }
        case 'wave':
        case 'sine': {
          if (!e.from || !e.to) break;
          const a = S(e.from);
          const c = S(e.to);
          const d = unit(sub(c, a));
          const n = perp(d);
          const L = len(sub(c, a));
          const amp = (e.amplitude ?? H * 0.12) * k;
          const wl = (e.wavelength ?? W / 4) * k;
          const pts: P[] = [];
          const N = Math.max(40, Math.ceil(L / 2));
          for (let i = 0; i <= N; i++) {
            const s = (L * i) / N;
            pts.push(add(add(a, mul(d, s)), mul(n, -amp * Math.sin((2 * Math.PI * s) / wl))));
          }
          shapes.push({ kind: 'path', d: poly(pts), stroke: color(e, theme.primary), sw: sw(e, 1.6), dash: dash(e), cap: 'round' });
          if (e.arrow === 'end') arrowHead(add(c, mul(d, 10)), c, color(e, theme.primary), 1.2);
          sideLabel(e.label, a, c, e, amp + 8);
          break;
        }
        case 'axes':
        case 'axis': {
          const o = (e.at ?? e.from ?? [0, 0]) as P;
          const [lx, ly] = (e.length ?? e.size ?? [W - o[0] - 2, H - o[1] - 2]) as P;
          const names = (e.text ?? e.label ?? 'x,y').split(',').map((s) => s.trim());
          const col = color(e, '#334155');
          const O = S(o);
          if (lx) {
            const X1 = S([o[0] + lx, o[1]]);
            line(O, X1, {} as FigElement, col, 1, 'end');
            if (names[0]) text(names[0], X1, { pos: 'right', size: e.fontSize ?? 9.5, color: col });
          }
          if (ly) {
            const Y1 = S([o[0], o[1] + ly]);
            line(O, Y1, {} as FigElement, col, 1, 'end');
            if (names[1]) text(names[1], Y1, { pos: 'above', size: e.fontSize ?? 9.5, color: col });
          }
          if (e.kind === 'origin' || names[2]) text(names[2] ?? 'O', O, { pos: 'left', size: 9, color: col });
          break;
        }
        case 'dimension':
        case 'measure': {
          if (!e.from || !e.to) break;
          const a = S(e.from);
          const c = S(e.to);
          const col = color(e, '#64748b');
          const n = unit(perp(sub(c, a)));
          for (const p of [a, c]) shapes.push({ kind: 'line', x1: p[0] - n[0] * 4, y1: p[1] - n[1] * 4, x2: p[0] + n[0] * 4, y2: p[1] + n[1] * 4, stroke: col, sw: 0.8 });
          line(a, c, {} as FigElement, col, 0.8, 'both');
          if (e.label) {
            const m = lerp(a, c, 0.5);
            text(e.label, m, { size: e.fontSize ?? 8.5, color: '#334155', bg: '#ffffff' });
          }
          break;
        }
        case 'pulley': {
          const c = (e.center ?? e.at) as P | undefined;
          if (!c) break;
          const r = (e.r ?? 6) * k;
          const sc = S(c);
          shapes.push({ kind: 'circle', cx: sc[0], cy: sc[1], r, fill: '#f1f5f9', stroke: color(e, '#334155'), sw: 1.3 });
          shapes.push({ kind: 'circle', cx: sc[0], cy: sc[1], r: Math.max(1.5, r * 0.18), fill: '#334155' });
          if (e.label) text(e.label, [sc[0], sc[1] - r], { pos: 'above', size: e.fontSize ?? 9, color: color(e) });
          break;
        }
        case 'field':
        case 'fieldlines': {
          // parallel arrows filling a rectangle: kind = 'right' | 'left' | 'up' | 'down' | 'in' | 'out'
          const at = (e.at ?? [0, 0]) as P;
          const size = (e.size ?? [W, H]) as P;
          const col = color(e, '#94a3b8');
          const kind = e.kind ?? 'right';
          if (kind === 'in' || kind === 'out') {
            const step = Math.max(size[0], size[1]) / 6;
            for (let x = at[0] + step / 2; x < at[0] + size[0]; x += step)
              for (let y = at[1] + step / 2; y < at[1] + size[1]; y += step) {
                const p = S([x, y]);
                if (kind === 'out') {
                  shapes.push({ kind: 'circle', cx: p[0], cy: p[1], r: 3, stroke: col, sw: 0.9 });
                  shapes.push({ kind: 'circle', cx: p[0], cy: p[1], r: 0.9, fill: col });
                } else {
                  shapes.push({ kind: 'line', x1: p[0] - 2.5, y1: p[1] - 2.5, x2: p[0] + 2.5, y2: p[1] + 2.5, stroke: col, sw: 1 });
                  shapes.push({ kind: 'line', x1: p[0] - 2.5, y1: p[1] + 2.5, x2: p[0] + 2.5, y2: p[1] - 2.5, stroke: col, sw: 1 });
                }
              }
          } else {
            const horiz = kind === 'right' || kind === 'left';
            const n = 5;
            for (let i = 0; i < n; i++) {
              const f = (i + 0.5) / n;
              let a: P, c: P;
              if (horiz) {
                const y = at[1] + size[1] * f;
                a = [at[0], y];
                c = [at[0] + size[0], y];
              } else {
                const x = at[0] + size[0] * f;
                a = [x, at[1]];
                c = [x, at[1] + size[1]];
              }
              if (kind === 'left' || kind === 'down') [a, c] = [c, a];
              const A = S(a);
              const C = S(c);
              shapes.push({ kind: 'line', x1: A[0], y1: A[1], x2: C[0], y2: C[1], stroke: col, sw: 0.9 });
              arrowHead(lerp(A, C, 0.55), A, col, 0.8);
            }
          }
          if (e.label) text(e.label, S([at[0] + size[0], at[1] + size[1]]), { pos: 'left', size: 9, color: '#475569' });
          break;
        }
        default:
          break;
      }
    } catch {
      /* skip malformed element */
    }
  }
  return { width: W * k + pad * 2, height: H * k + pad * 2, shapes, labels };
}

function spline(pts: P[], closed: boolean): string {
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'} ${fmt(p[0])} ${fmt(p[1])}`).join(' ');
  const P2 = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M ${fmt(P2[1][0])} ${fmt(P2[1][1])}`;
  for (let i = 1; i < P2.length - 2; i++) {
    const [p0, p1, p2, p3] = [P2[i - 1], P2[i], P2[i + 1], P2[i + 2]];
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d + (closed ? ' Z' : '');
}

const NAMED: Record<string, string> = {
  red: '#dc2626', blue: '#2563eb', green: '#16a34a', orange: '#ea580c', purple: '#7c3aed', black: '#0f172a', gray: '#64748b', grey: '#64748b',
  yellow: '#eab308', teal: '#0d9488', pink: '#db2777', brown: '#92400e', white: '#ffffff', cyan: '#0891b2', navy: '#1e3a8a', lightblue: '#bfdbfe', lightgray: '#e2e8f0', gold: '#ca8a04',
};
function cssColor(name: string, theme: PdfTheme): string {
  const n = name.toLowerCase();
  if (n === 'primary') return theme.primary;
  if (n === 'accent') return theme.accent;
  if (n === 'muted') return theme.muted;
  if (n === 'soft') return theme.soft;
  return NAMED[n] ?? '#1e293b';
}
