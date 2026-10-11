// Colour grading for the PDF. Every colour that reaches the page goes through
// grade(): white becomes the paper tone, cold slate greys become warm greys,
// near-black becomes soft ink, and loud saturated hues are calmed down. This
// keeps any document (and anything an AI invents) easy on the eyes.
import type { ColorMode, PaperTone } from '../types';

export const PAPER: Record<PaperTone, string> = { natural: '#faf8f2', cream: '#f5efe1', white: '#ffffff' };
const INK = [44, 41, 36]; // #2c2924

type RGB = [number, number, number];

function parse(c: string): RGB | null {
  const s = c.trim().toLowerCase();
  if (s === 'white') return [255, 255, 255];
  if (s === 'black') return [0, 0, 0];
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16)) as RGB;
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as RGB;
  m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}
const hex = (c: RGB) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a: RGB, b: RGB | number[], t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function natural(c: RGB, paper: RGB): RGB {
  const [h, s, l] = toHsl(c);
  if (l > 0.965 && s < 0.5) return paper; // white → paper
  if (l < 0.24) return mix(c, INK, 0.65); // black / navy → soft ink
  let out: RGB;
  if (s < 0.28) {
    // greys (often cold slate) → warm greys of the same lightness
    out = mix(c, fromHsl(38, 0.09, l), 0.75);
  } else {
    // compress saturation above 0.36, pull extreme lightness in a little
    const s2 = s > 0.36 ? 0.36 + (s - 0.36) * 0.28 : s;
    const l2 = l > 0.55 && l < 0.85 ? l - (l - 0.55) * 0.15 : l;
    out = fromHsl(h, s2, l2);
  }
  if (l > 0.84) out = mix(out, paper, 0.35); // pale tints melt into the paper
  return out;
}
function mono(c: RGB, paper: RGB): RGB {
  const [, , l] = toHsl(c);
  if (l > 0.965) return paper;
  if (l < 0.24) return mix(c, INK, 0.8);
  return mix(fromHsl(36, 0.07, l), paper, l > 0.84 ? 0.35 : 0);
}

let current: { key: string; paper: RGB; mode: ColorMode; cache: Map<string, string> } = { key: '', paper: [255, 255, 255], mode: 'vivid', cache: new Map() };

export function setGrade(paper: PaperTone | undefined, mode: ColorMode | undefined) {
  const p = paper ?? 'natural';
  const m = mode ?? 'natural';
  const key = `${p}|${m}`;
  if (current.key === key) return;
  current = { key, paper: parse(PAPER[p])!, mode: m, cache: new Map() };
}
export function paperColor(paper: PaperTone | undefined) {
  return PAPER[paper ?? 'natural'];
}

export function grade(c: unknown): unknown {
  if (typeof c !== 'string' || !c || c === 'none' || c === 'transparent' || c === 'currentColor' || c.startsWith('url(')) return c;
  const hit = current.cache.get(c);
  if (hit) return hit;
  const rgb = parse(c);
  if (!rgb) return c;
  const out = current.mode === 'vivid' ? (toHsl(rgb)[2] > 0.97 ? current.paper : rgb) : current.mode === 'mono' ? mono(rgb, current.paper) : natural(rgb, current.paper);
  const res = hex(out);
  current.cache.set(c, res);
  return res;
}
