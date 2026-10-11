// A scene is a resolution-independent vector drawing (shapes + text labels)
// produced by the diagram/chart layout engines and painted by <SceneView/>.

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx?: number; fill?: string; stroke?: string; sw?: number; dash?: string; opacity?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; opacity?: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill?: string; stroke?: string; sw?: number; opacity?: number }
  | { kind: 'path'; d: string; fill?: string; stroke?: string; sw?: number; dash?: string; opacity?: number; cap?: 'round' | 'butt' | 'square' }
  | { kind: 'polygon'; points: [number, number][]; fill?: string; stroke?: string; sw?: number; opacity?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; sw?: number; dash?: string; opacity?: number };

export interface Label {
  x: number; // box left
  y: number; // box top
  w: number;
  h: number;
  text: string;
  size: number;
  color: string;
  weight?: 400 | 600 | 700 | 800;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  bg?: string;
  italic?: boolean;
}

export interface Scene {
  width: number;
  height: number;
  shapes: Shape[];
  labels: Label[];
}

export function scaleScene(s: Scene, k: number): Scene {
  if (Math.abs(k - 1) < 1e-3) return s;
  const sc = (v: number) => v * k;
  const shapes: Shape[] = s.shapes.map((sh) => {
    switch (sh.kind) {
      case 'rect':
        return { ...sh, x: sc(sh.x), y: sc(sh.y), w: sc(sh.w), h: sc(sh.h), rx: sh.rx != null ? sc(sh.rx) : undefined, sw: sh.sw != null ? Math.max(0.4, sh.sw * k) : undefined };
      case 'circle':
        return { ...sh, cx: sc(sh.cx), cy: sc(sh.cy), r: sc(sh.r), sw: sh.sw != null ? Math.max(0.4, sh.sw * k) : undefined };
      case 'ellipse':
        return { ...sh, cx: sc(sh.cx), cy: sc(sh.cy), rx: sc(sh.rx), ry: sc(sh.ry), sw: sh.sw != null ? Math.max(0.4, sh.sw * k) : undefined };
      case 'polygon':
        return { ...sh, points: sh.points.map(([x, y]) => [sc(x), sc(y)] as [number, number]), sw: sh.sw != null ? Math.max(0.4, sh.sw * k) : undefined };
      case 'line':
        return { ...sh, x1: sc(sh.x1), y1: sc(sh.y1), x2: sc(sh.x2), y2: sc(sh.y2), sw: sh.sw != null ? Math.max(0.4, sh.sw * k) : undefined };
      case 'path':
        return { ...sh, d: scalePath(sh.d, k), sw: sh.sw != null ? Math.max(0.4, sh.sw * k) : undefined };
    }
  });
  const labels = s.labels.map((l) => ({ ...l, x: sc(l.x), y: sc(l.y), w: sc(l.w), h: sc(l.h), size: Math.max(5, l.size * k) }));
  return { width: sc(s.width), height: sc(s.height), shapes, labels };
}

// Scales absolute path commands (M L C Q A Z only; arcs keep flags).
function scalePath(d: string, k: number): string {
  const tokens = d.match(/[MLCQAZHV]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out: string[] = [];
  let cmd = '';
  let argIdx = 0;
  for (const t of tokens) {
    if (/^[a-z]$/i.test(t)) {
      cmd = t.toUpperCase();
      argIdx = 0;
      out.push(t);
      continue;
    }
    const v = parseFloat(t);
    if (cmd === 'A') {
      // rx ry rot large sweep x y
      const pos = argIdx % 7;
      out.push(pos === 2 || pos === 3 || pos === 4 ? t : fmt(v * k));
    } else out.push(fmt(v * k));
    argIdx++;
  }
  return out.join(' ');
}

export const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

// ---------------------------------------------------------------- colors
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [100, 116, 139];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r: number, g: number, b: number) {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** mix color a with b; t=0 → a, t=1 → b */
export function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
export const tint = (c: string, t: number) => mix(c, '#ffffff', t);
export const shade = (c: string, t: number) => mix(c, '#000000', t);
export function isHex(c?: string): c is string {
  return !!c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
}
export function luminance(c: string) {
  const [r, g, b] = hexToRgb(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ---------------------------------------------------------------- text
export const charW = (size: number, bold = false) => size * (bold ? 0.6 : 0.555);

export function wrapText(text: string, maxChars: number): string[] {
  const words = String(text ?? '').replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
    while (cur.length > maxChars * 1.4) {
      lines.push(cur.slice(0, maxChars));
      cur = cur.slice(maxChars);
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

export function textWidth(text: string, size: number, bold = false) {
  return text.length * charW(size, bold);
}
