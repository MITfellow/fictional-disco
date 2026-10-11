import type { Block, BlockType, DocMeta, DocSpec, FontName, NodeShape, PageSize, ThemeName, Tone } from './types';
import { THEMES } from './themes';

let counter = 0;
export const uid = (p = 'b') => `${p}${Date.now().toString(36).slice(-4)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const today = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export const DEFAULT_META: DocMeta = {
  title: 'Untitled document',
  pageSize: 'A4',
  orientation: 'portrait',
  theme: 'ocean',
  font: 'sans',
  cover: false,
  toc: false,
  pageNumbers: true,
  numberedHeadings: false,
};

const BLOCK_TYPES: BlockType[] = ['heading', 'paragraph', 'list', 'table', 'image', 'diagram', 'chart', 'timeline', 'quote', 'callout', 'code', 'kpis', 'columns', 'progress', 'signature', 'divider', 'pagebreak', 'spacer'];
const SHAPES: NodeShape[] = ['rect', 'round', 'pill', 'diamond', 'circle', 'hexagon', 'parallelogram', 'cylinder', 'note'];
const str = (v: unknown, d = ''): string => (v == null ? d : typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : d);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const TYPE_ALIASES: Record<string, BlockType> = {
  h1: 'heading', h2: 'heading', h3: 'heading', title: 'heading', text: 'paragraph', p: 'paragraph', bullets: 'list', bullet: 'list', ul: 'list', ol: 'list', numbered: 'list', checklist: 'list',
  flowchart: 'diagram', mindmap: 'diagram', graph: 'diagram', sequence: 'diagram', note: 'callout', alert: 'callout', blockquote: 'quote', hr: 'divider', break: 'pagebreak', 'page-break': 'pagebreak',
  stats: 'kpis', kpi: 'kpis', metrics: 'kpis', img: 'image', picture: 'image', bars: 'progress', skills: 'progress',
};

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

/** Extracts the first JSON object from an LLM reply (handles code fences / chatter). */
export function extractJson(text: string): unknown {
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
      // try removing trailing commas
      try {
        return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
      } catch {
        /* continue */
      }
    }
  }
  return null;
}
