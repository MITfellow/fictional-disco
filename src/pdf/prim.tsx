// react-pdf primitives with automatic colour grading (see color.ts).
import * as R from '@react-pdf/renderer';
import { createElement, type ComponentType } from 'react';
import { grade } from './color';

const STYLE_KEYS = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'textDecorationColor'];
const PROP_KEYS = ['fill', 'stroke', 'stopColor', 'color'];

function gradeStyle(st: unknown): unknown {
  if (!st) return st;
  if (Array.isArray(st)) return st.map(gradeStyle);
  if (typeof st !== 'object') return st;
  let out: Record<string, unknown> | null = null;
  for (const k of STYLE_KEYS) {
    const v = (st as Record<string, unknown>)[k];
    if (v === undefined) continue;
    const g = grade(v);
    if (g !== v) (out ??= { ...(st as Record<string, unknown>) })[k] = g;
  }
  return out ?? st;
}

function wrap<T>(C: T, svg = false): T {
  const W = (props: Record<string, unknown>) => {
    const p: Record<string, unknown> = { ...props };
    if (p.style) p.style = gradeStyle(p.style);
    if (svg) for (const k of PROP_KEYS) if (p[k] !== undefined) p[k] = grade(p[k]);
    return createElement(C as unknown as ComponentType, p);
  };
  return W as unknown as T;
}

export const View = wrap(R.View);
export const Text = wrap(R.Text);
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
