import type { Block, BlockType, BoxVariant, CoverStyle, DocMeta, DocSpec, FigElement, FontName, NodeShape, PageSize, Pt, ThemeName, Tone } from './types';
import { THEMES } from './themes';

let counter = 0;
export const uid = (p = 'b') => `${p}${Date.now().toString(36).slice(-4)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const today = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export const DEFAULT_META: DocMeta = {
  title: 'Untitled document',
  pageSize: 'A4',
  orientation: 'portrait',
  theme: 'ink',
  font: 'sans',
  cover: false,
  toc: false,
  pageNumbers: true,
  numberedHeadings: false,
};

const BLOCK_TYPES: BlockType[] = ['heading', 'paragraph', 'list', 'table', 'image', 'diagram', 'chart', 'timeline', 'quote', 'callout', 'code', 'kpis', 'columns', 'progress', 'signature', 'divider', 'pagebreak', 'spacer', 'equation', 'plot', 'figure', 'box', 'steps'];
const BOX_VARIANTS: BoxVariant[] = ['definition', 'theorem', 'law', 'principle', 'example', 'problem', 'solution', 'proof', 'note', 'tip', 'warning', 'summary', 'key', 'formula', 'abstract'];
const COVER_STYLES: CoverStyle[] = ['gradient', 'orbits', 'waves', 'grid', 'minimal'];
const SHAPES: NodeShape[] = ['rect', 'round', 'pill', 'diamond', 'circle', 'hexagon', 'parallelogram', 'cylinder', 'note'];
const str = (v: unknown, d = ''): string => (v == null ? d : typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : d);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const TYPE_ALIASES: Record<string, BlockType> = {
  h1: 'heading', h2: 'heading', h3: 'heading', title: 'heading', text: 'paragraph', p: 'paragraph', bullets: 'list', bullet: 'list', ul: 'list', ol: 'list', numbered: 'list', checklist: 'list',
  flowchart: 'diagram', mindmap: 'diagram', graph: 'diagram', sequence: 'diagram', note: 'callout', alert: 'callout', blockquote: 'quote', hr: 'divider', break: 'pagebreak', 'page-break': 'pagebreak',
  math: 'equation', formula: 'equation', latex: 'equation', eq: 'equation', 'display-math': 'equation',
  function: 'plot', 'function-plot': 'plot', graph2d: 'plot', 'plot2d': 'plot',
  drawing: 'figure', sketch: 'figure', illustration: 'figure', svg: 'figure', 'free-body': 'figure', circuit: 'figure',
  definition: 'box', theorem: 'box', law: 'box', example: 'box', problem: 'box', solution: 'box', proof: 'box', summary: 'box', panel: 'box', card: 'box',
  solution_steps: 'steps', derivation: 'steps', 'worked-solution': 'steps',
  stats: 'kpis', kpi: 'kpis', metrics: 'kpis', img: 'image', picture: 'image', bars: 'progress', skills: 'progress',
};

const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : d;
};
const pt = (v: unknown): Pt | undefined => {
  if (Array.isArray(v) && v.length >= 2) return [num(v[0]), num(v[1])];
  if (v && typeof v === 'object' && 'x' in v) return [num((v as { x: unknown }).x), num((v as unknown as { y: unknown }).y)];
  return undefined;
};
const range = (v: unknown): [number, number] | undefined => {
  const p = pt(v);
  return p && p[1] > p[0] ? p : undefined;
};
const opt = (v: unknown) => str(v) || undefined;

function normalizeElement(raw: unknown): FigElement | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  const type = str(e.type ?? e.kind ?? e.shape).toLowerCase();
  if (!type) return null;
  const el: FigElement = { type };
  for (const k of ['from', 'to', 'at', 'center', 'size', 'length'] as const) {
    const p = pt(e[k]);
    if (p) el[k] = p;
  }
  if (Array.isArray(e.points)) el.points = e.points.map(pt).filter((p): p is Pt => !!p);
  for (const k of ['r', 'rx', 'ry', 'startAngle', 'endAngle', 'rotate', 'width', 'fontSize', 'amplitude', 'wavelength', 'coils', 'height', 'lines'] as const)
    if (e[k] != null && Number.isFinite(num(e[k], NaN))) el[k] = num(e[k]);
  if (e.radius != null && el.r == null) el.r = num(e.radius);
  if (e.turns != null && el.coils == null) el.coils = num(e.turns);
  for (const k of ['text', 'label', 'color', 'fill', 'kind'] as const) if (e[k] != null && str(e[k])) el[k] = str(e[k]);
  if (e.type && e.kind && type !== str(e.kind).toLowerCase()) el.kind = str(e.kind);
  const lp = str(e.labelPos ?? e.anchor);
  if (['above', 'below', 'left', 'right', 'center', 'start', 'end'].includes(lp)) el.labelPos = lp as never;
  const ar = str(e.arrow);
  if (['end', 'start', 'both', 'none'].includes(ar)) el.arrow = ar as never;
  if (e.dashed) el.dashed = true;
  if (e.smooth) el.smooth = true;
  if (e.closed) el.closed = true;
  if (!el.from && el.points?.length && ['line', 'arrow', 'vector', 'spring', 'resistor', 'capacitor', 'battery', 'inductor', 'bulb', 'switch', 'source', 'meter', 'dimension', 'wave', 'ground', 'solenoid'].includes(type) && el.points.length >= 2) {
    el.from = el.points[0];
    el.to = el.points[el.points.length - 1];
  }
  return el;
}

export function normalizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  let type = str(r.type).toLowerCase() as BlockType;
  const alias = TYPE_ALIASES[type];
  const origType = type as string;
  if (alias) type = alias;
  if (!BLOCK_TYPES.includes(type)) return null;
  const id = str(r.id) || uid();
  switch (type) {
    case 'heading': {
      let level = Number(r.level) || (origType === 'h2' ? 2 : origType === 'h3' ? 3 : 1);
      level = Math.max(1, Math.min(3, level));
      return { id, type, level: level as 1 | 2 | 3, text: str(r.text ?? r.content) };
    }
    case 'paragraph':
      return { id, type, text: str(r.text ?? r.content), align: (['left', 'center', 'right', 'justify'].includes(str(r.align)) ? r.align : undefined) as never, lead: !!r.lead };
    case 'list':
      return { id, type, ordered: !!r.ordered || origType === 'ol' || origType === 'numbered', checklist: !!r.checklist || origType === 'checklist', items: arr<unknown>(r.items).map((i) => (typeof i === 'object' && i ? str((i as Record<string, unknown>).text) : str(i))) };
    case 'table': {
      const headers = arr<unknown>(r.headers ?? r.columns).map((h) => str(h));
      const rows = arr<unknown>(r.rows).map((row) => (Array.isArray(row) ? row.map((c) => str(c)) : typeof row === 'object' && row ? Object.values(row as object).map((c) => str(c)) : [str(row)]));
      return { id, type, headers, rows, caption: str(r.caption) || undefined, striped: r.striped !== false, totalRow: !!r.totalRow, align: Array.isArray(r.align) ? (r.align as never) : undefined };
    }
    case 'image':
      return { id, type, src: str(r.src ?? r.url ?? r.asset), caption: str(r.caption) || undefined, width: Number(r.width) || undefined, align: (['left', 'center', 'right'].includes(str(r.align)) ? r.align : 'center') as never, rounded: r.rounded !== false };
    case 'diagram': {
      let kind = str(r.kind || origType).toLowerCase();
      if (!['flowchart', 'mindmap', 'sequence', 'cycle'].includes(kind)) kind = 'flowchart';
      const nodes = arr<Record<string, unknown>>(r.nodes)
        .filter((n) => n && (n.id != null || n.label != null))
        .map((n) => ({
          id: str(n.id ?? n.label),
          label: str(n.label ?? n.text ?? n.id),
          shape: (SHAPES.includes(str(n.shape) as NodeShape) ? n.shape : undefined) as NodeShape | undefined,
          color: str(n.color) || undefined,
          group: typeof n.group === 'number' ? n.group : undefined,
        }));
      const ids = new Set(nodes.map((n) => n.id));
      const edges = arr<Record<string, unknown>>(r.edges ?? r.links)
        .map((e) => ({ from: str(e.from ?? e.source), to: str(e.to ?? e.target), label: str(e.label) || undefined, dashed: !!e.dashed, bidirectional: !!e.bidirectional }))
        .filter((e) => e.from && e.to);
      // auto-create missing nodes referenced by edges
      for (const e of edges)
        for (const k of [e.from, e.to])
          if (!ids.has(k)) {
            ids.add(k);
            nodes.push({ id: k, label: k, shape: undefined, color: undefined, group: undefined });
          }
      return { id, type, kind: kind as never, direction: str(r.direction).toUpperCase() === 'LR' ? 'LR' : 'TB', nodes, edges, caption: str(r.caption) || undefined, height: Number(r.height) || undefined };
    }
    case 'chart': {
      let kind = str(r.kind || r.chartType || 'bar').toLowerCase();
      if (!['bar', 'hbar', 'line', 'area', 'pie', 'donut', 'stacked'].includes(kind)) kind = 'bar';
      const labels = arr<unknown>(r.labels ?? r.categories).map((l) => str(l));
      let series = arr<Record<string, unknown>>(r.series).map((s) => ({ name: str(s.name), values: arr<unknown>(s.values ?? s.data).map((v) => Number(v) || 0), color: str(s.color) || undefined }));
      if (!series.length && Array.isArray(r.values)) series = [{ name: str(r.title, 'Value'), values: (r.values as unknown[]).map((v) => Number(v) || 0), color: undefined }];
      return { id, type, kind: kind as never, title: str(r.title) || undefined, labels, series, unit: str(r.unit) || undefined, caption: str(r.caption) || undefined };
    }
    case 'timeline':
      return { id, type, items: arr<Record<string, unknown>>(r.items ?? r.events).map((i) => ({ date: str(i.date ?? i.when), title: str(i.title ?? i.label), text: str(i.text ?? i.description) || undefined })) };
    case 'quote':
      return { id, type, text: str(r.text), author: str(r.author) || undefined };
    case 'callout': {
      const tone = str(r.tone || r.variant || 'info').toLowerCase();
      return { id, type, tone: (['info', 'success', 'warning', 'danger', 'note'].includes(tone) ? tone : 'info') as Tone, title: str(r.title) || undefined, text: str(r.text) };
    }
    case 'code':
      return { id, type, language: str(r.language) || undefined, code: str(r.code ?? r.text) };
    case 'kpis':
      return { id, type, items: arr<Record<string, unknown>>(r.items).slice(0, 5).map((i) => ({ label: str(i.label), value: str(i.value), delta: str(i.delta) || undefined, trend: (['up', 'down', 'flat'].includes(str(i.trend)) ? i.trend : undefined) as never })) };
    case 'columns':
      return { id, type, columns: arr<Record<string, unknown>>(r.columns).slice(0, 4).map((c) => ({ title: str(c.title) || undefined, text: str(c.text) })) };
    case 'progress':
      return { id, type, items: arr<Record<string, unknown>>(r.items).map((i) => ({ label: str(i.label), value: Number(i.value) || 0 })) };
    case 'signature':
      return { id, type, parties: arr<Record<string, unknown>>(r.parties).slice(0, 3).map((p) => ({ name: str(p.name), role: str(p.role) || undefined })) };
    case 'divider':
    case 'pagebreak':
      return { id, type } as Block;
    case 'spacer':
      return { id, type, size: Number(r.size) || 16 };
    case 'equation': {
      let latex = str(r.latex ?? r.tex ?? r.math ?? r.text ?? r.content ?? r.formula).trim();
      latex = latex.replace(/^\$\$([\s\S]*)\$\$$/, '$1').replace(/^\\\[([\s\S]*)\\\]$/, '$1').replace(/^\$([\s\S]*)\$$/, '$1').trim();
      if (!latex) return null;
      return { id, type, latex, numbered: r.numbered !== false, label: opt(r.label ?? r.tag), caption: opt(r.caption) };
    }
    case 'plot': {
      const fns = arr<unknown>(r.functions ?? r.curves ?? (r.expr ? [r] : []))
        .map((f) => (typeof f === 'string' ? { expr: f } : (f as Record<string, unknown>)))
        .filter((f) => f && str(f.expr ?? f.fn ?? f.y))
        .slice(0, 8)
        .map((f) => ({ expr: str(f.expr ?? f.fn ?? f.y), label: opt(f.label ?? f.name), color: opt(f.color), dashed: !!f.dashed, domain: range(f.domain) }));
      const parametric = arr<Record<string, unknown>>(r.parametric)
        .filter((p) => p && str(p.x) && str(p.y))
        .slice(0, 6)
        .map((p) => ({ x: str(p.x), y: str(p.y), t: range(p.t ?? p.tRange), label: opt(p.label), color: opt(p.color), dashed: !!p.dashed }));
      const data = arr<Record<string, unknown>>(r.data ?? r.series)
        .filter((d) => d && Array.isArray(d.points))
        .slice(0, 6)
        .map((d) => ({ points: arr<unknown>(d.points).map(pt).filter((p): p is Pt => !!p), label: opt(d.label ?? d.name), color: opt(d.color), line: !!d.line }));
      const points = arr<Record<string, unknown>>(r.points ?? r.markers)
        .map((p) => ({ x: num(p?.x ?? (Array.isArray(p) ? p[0] : 0)), y: num(p?.y ?? (Array.isArray(p) ? p[1] : 0)), label: opt(p?.label) }));
      const vlines = arr<Record<string, unknown>>(r.vlines).map((v) => (typeof v === 'number' ? { x: v } : { x: num(v?.x), label: opt(v?.label) }));
      const hlines = arr<Record<string, unknown>>(r.hlines).map((v) => (typeof v === 'number' ? { y: v } : { y: num(v?.y), label: opt(v?.label) }));
      const shade = arr<Record<string, unknown>>(Array.isArray(r.shade) ? r.shade : r.shade ? [r.shade] : [])
        .filter((s) => s && str(s.expr))
        .map((s) => ({ expr: str(s.expr), from: num(s.from), to: num(s.to, 1), label: opt(s.label), color: opt(s.color) }));
      if (!fns.length && !parametric.length && !data.length && !points.length) return null;
      return { id, type, title: opt(r.title), functions: fns, parametric, data, points, vlines, hlines, shade, xRange: range(r.xRange ?? r.xrange ?? r.domain), yRange: range(r.yRange ?? r.yrange), xLabel: opt(r.xLabel ?? r.xlabel), yLabel: opt(r.yLabel ?? r.ylabel), height: Number(r.height) || undefined, caption: opt(r.caption) };
    }
    case 'figure': {
      const elements = arr<unknown>(r.elements ?? r.shapes ?? r.items).map(normalizeElement).filter((e): e is FigElement => !!e).slice(0, 400);
      if (!elements.length) return null;
      return { id, type, width: Math.max(1, num(r.width, 100)), height: Math.max(1, num(r.height, 60)), elements, caption: opt(r.caption), scale: Number(r.scale) ? Math.max(10, Math.min(100, Number(r.scale))) : undefined, fullPage: !!r.fullPage, side: r.side === 'left' || r.side === 'right' ? r.side : undefined, beside: Number(r.beside) ? Math.max(1, Math.min(3, Math.round(Number(r.beside)))) : undefined };
    }
    case 'box': {
      let variant = str(r.variant ?? r.kind ?? r.style ?? (origType !== 'box' ? origType : 'note')).toLowerCase() as BoxVariant;
      if (!BOX_VARIANTS.includes(variant)) variant = 'note';
      const blocks = arr<unknown>(r.blocks ?? r.content).map(normalizeBlock).filter((b): b is Block => !!b && b.type !== 'pagebreak');
      return { id, type, variant, title: opt(r.title), text: opt(typeof r.content === 'string' ? r.content : r.text), blocks };
    }
    case 'steps': {
      const items = arr<unknown>(r.items ?? r.steps)
        .map((i) => (typeof i === 'string' ? { text: i } : { text: opt((i as Record<string, unknown>)?.text), math: opt((i as Record<string, unknown>)?.math ?? (i as Record<string, unknown>)?.latex) }))
        .filter((i) => i.text || i.math);
      return { id, type, title: opt(r.title), items };
    }
  }
  return null;
}

export function normalizeDoc(raw: unknown, fallback?: DocSpec): DocSpec {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const hasMeta = !!r.meta && typeof r.meta === 'object';
  const fb = fallback?.meta ?? DEFAULT_META;
  // Optional fields are inherited only when the source has no meta at all (a complete meta replaces them).
  const m = (hasMeta ? r.meta : { ...fb }) as Record<string, unknown>;
  const theme = str(m.theme).toLowerCase();
  const font = str(m.font).toLowerCase();
  const size = str(m.pageSize).toUpperCase();
  const meta: DocMeta = {
    title: str(m.title) || fb.title,
    subtitle: str(m.subtitle) || undefined,
    author: str(m.author) || undefined,
    date: str(m.date) || undefined,
    pageSize: (['A4', 'LETTER', 'LEGAL', 'A5'].includes(size) ? size : fb.pageSize) as PageSize,
    orientation: m.orientation === 'landscape' ? 'landscape' : m.orientation === 'portrait' ? 'portrait' : fb.orientation,
    theme: (theme in THEMES ? theme : fb.theme) as ThemeName,
    font: (['sans', 'serif', 'mono'].includes(font) ? font : fb.font) as FontName,
    cover: typeof m.cover === 'boolean' ? m.cover : fb.cover,
    toc: typeof m.toc === 'boolean' ? m.toc : fb.toc,
    header: str(m.header) || undefined,
    footer: str(m.footer) || undefined,
    pageNumbers: typeof m.pageNumbers === 'boolean' ? m.pageNumbers : fb.pageNumbers,
    numberedHeadings: typeof m.numberedHeadings === 'boolean' ? m.numberedHeadings : fb.numberedHeadings,
    style: (['academic', 'modern', 'minimal'].includes(str(m.style)) ? m.style : hasMeta ? undefined : fb.style) as DocMeta['style'],
    paper: (['natural', 'cream', 'white'].includes(str(m.paper)) ? m.paper : hasMeta ? undefined : fb.paper) as DocMeta['paper'],
    colors: (['natural', 'vivid', 'mono'].includes(str(m.colors)) ? m.colors : hasMeta ? undefined : fb.colors) as DocMeta['colors'],
    density: (['compact', 'comfortable', 'airy'].includes(str(m.density)) ? m.density : hasMeta ? undefined : fb.density) as DocMeta['density'],
    coverStyle: (COVER_STYLES.includes(str(m.coverStyle) as CoverStyle) ? m.coverStyle : hasMeta ? undefined : fb.coverStyle) as CoverStyle | undefined,
    kicker: str(m.kicker) || undefined,
  };
  const seen = new Set<string>();
  const blocks = arr<unknown>(r.blocks)
    .map(normalizeBlock)
    .filter((b): b is Block => !!b)
    .map((b) => {
      if (seen.has(b.id)) b = { ...b, id: uid() };
      seen.add(b.id);
      return b;
    });
  return { meta, blocks };
}

/** Closes an incomplete (truncated) JSON object so it can still be parsed. */
export function repairJson(src: string): unknown {
  const start = src.indexOf('{');
  if (start < 0) return null;
  const s = src.slice(start);
  const stack: string[] = [];
  const cuts: { at: number; stack: string }[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') {
        inStr = false;
        cuts.push({ at: i + 1, stack: stack.join('') });
      }
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') {
      stack.pop();
      cuts.push({ at: i + 1, stack: stack.join('') });
      if (!stack.length) break;
    } else if (/[\d el]/.test(c) && /[,}\]\s]/.test(s[i + 1] ?? '')) cuts.push({ at: i + 1, stack: stack.join('') });
  }
  for (let k = cuts.length - 1, tries = 0; k >= 0 && tries < 400; k--, tries++) {
    const { at, stack: st } = cuts[k];
    let body = s.slice(0, at).replace(/,\s*$/, '');
    // a dangling key ("key") or "key": without value is invalid → drop it
    body = body.replace(/,\s*"[^"]*"\s*:?\s*$/, '').replace(/\{\s*"[^"]*"\s*:?\s*$/, '{');
    const closed = body + st.split('').reverse().join('');
    try {
      return JSON.parse(closed);
    } catch {
      /* try an earlier cut */
    }
  }
  return null;
}

/** Doubles backslashes that are not valid JSON escapes (models often write "\\vec" as "\vec"). */
export function fixJsonEscapes(raw: string): string {
  return raw.replace(/\\(\\|u[0-9a-fA-F]{4}|["\/bfnrt])|\\/g, (m, ok) => (ok ? m : '\\\\'));
}

/** Extracts the first JSON object from an LLM reply (handles code fences / chatter / truncation). */
export function extractJson(rawText: string): unknown {
  const text = fixJsonEscapes(rawText);
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidates = [fence?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf('{');
    const end = c.lastIndexOf('}');
    if (start < 0 || end <= start) continue;
    const slice = c.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      try {
        return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
      } catch {
        /* continue */
      }
    }
  }
  // truncated output (token limit) or unclosed fence
  const open = /```(?:json)?\s*([\s\S]*)$/i.exec(text)?.[1] ?? text;
  return repairJson(open.replace(/```\s*$/, ''));
}

const TEX_KEYS = new Set(['latex', 'math', 'tex', 'formula']);
/** Undo JSON escape damage in LaTeX ("\frac" parsed as form-feed + "rac", "\theta" as TAB + "heta", …). */
export function fixTex(s: string, whole: boolean): string {
  const fix = (t: string) =>
    t
      .replace(/\f/g, '\\f')
      .replace(/\x08/g, '\\b')
      .replace(/\t(?=[a-zA-Z])/g, '\\t')
      .replace(/\r(?=[a-zA-Z])/g, '\\r')
      .replace(/\n(?=(?:abla|u|eq|e|ot|otin|i|orm|ewline|leq|geq|parallel|exists|mid|subset|onumber|olimits|eg|earrow|warrow|atural)(?![a-zA-Z]))/g, '\\n');
  let out = whole ? fix(s) : s.replace(/\$[^$]+\$/g, (m) => fix(m));
  if (!whole) out = out.replace(/[\f\x08]/g, '');
  if (whole && /\\\\[a-zA-Z]/.test(out) && !/(^|[^\\])\\[a-zA-Z]/.test(out)) out = out.replace(/\\\\(?=[a-zA-Z])/g, '\\'); // fully double-escaped
  return out;
}
export function fixTexDeep<T>(v: T, key = ''): T {
  if (typeof v === 'string') return fixTex(v, TEX_KEYS.has(key)) as T;
  if (Array.isArray(v)) return v.map((x) => fixTexDeep(x, key)) as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = k === 'src' ? x : fixTexDeep(x, k);
    return o as T;
  }
  return v;
}
