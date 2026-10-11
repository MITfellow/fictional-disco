// react-pdf primitives with automatic colour grading (see color.ts).
import * as R from '@react-pdf/renderer';
import { createElement, type ComponentType } from 'react';
import { grade } from './color';

const STYLE_KEYS = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'textDecorationColor'];
const PROP_KEYS = ['fill', 'stroke', 'stopColor', 'color'];
const SVG_NUMBER_STRINGS = new Set(['d', 'points', 'transform', 'viewBox', 'strokeDasharray']);
const PDF_LIMIT = 100_000;
const safeNumber = (n: number) => (Number.isFinite(n) ? Math.max(-PDF_LIMIT, Math.min(PDF_LIMIT, n)) : 0);
const safeNumberString = (value: string) => value.replace(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi, (token) => String(safeNumber(Number(token))));

function gradeStyle(st: unknown): unknown {
  if (!st) return st;
  if (Array.isArray(st)) return st.map(gradeStyle);
  if (typeof st !== 'object') return st;
  const source = st as Record<string, unknown>;
  let out: Record<string, unknown> | null = null;
  // Numeric overflow can also arrive through absolute-position styles.
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === 'number') {
      const n = safeNumber(v);
      if (n !== v) (out ??= { ...source })[k] = n;
    }
  }
  for (const k of STYLE_KEYS) {
    const v = source[k];
    if (v === undefined) continue;
    const g = grade(v);
    if (g !== v) (out ??= { ...source })[k] = g;
  }
  return out ?? st;
}

function wrap<T>(C: T, svg = false): T {
  const W = (props: Record<string, unknown>) => {
    const p: Record<string, unknown> = { ...props };
    if (p.style) p.style = gradeStyle(p.style);
    // Final safety boundary before values reach PDFKit. This covers every SVG
    // producer, including MathJax and future diagram engines.
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'number') p[k] = safeNumber(v);
      else if (svg && typeof v === 'string' && SVG_NUMBER_STRINGS.has(k)) p[k] = safeNumberString(v);
    }
    if (svg) for (const k of PROP_KEYS) if (p[k] !== undefined) p[k] = grade(p[k]);
    return createElement(C as unknown as ComponentType, p);
  };
  return W as unknown as T;
}

export const View = wrap(R.View);
const GradedText = wrap(R.Text);
// Never break inside a word: a bold word followed by punctuation is split into two runs,
// and the line breaker would otherwise hyphenate between them ("other-;").
export const Text = ((props: Record<string, unknown>) => createElement(GradedText as unknown as ComponentType<Record<string, unknown>>, { hyphenationPenalty: 10000, ...props })) as unknown as typeof R.Text;
export const Link = wrap(R.Link);
export const Image = R.Image;
export const Svg = wrap(R.Svg, true);
export const G = wrap(R.G, true);
export const Path = wrap(R.Path, true);
export const Rect = wrap(R.Rect, true);
export const Circle = wrap(R.Circle, true);
export const Ellipse = wrap(R.Ellipse, true);
export const Line = wrap(R.Line, true);
export const Polygon = wrap(R.Polygon, true);
export const Polyline = wrap(R.Polyline, true);
export const Stop = wrap(R.Stop, true);
export const LinearGradient = R.LinearGradient;
export const RadialGradient = R.RadialGradient;
export const Defs = R.Defs;
export const Document = R.Document;
export const Page = R.Page;
