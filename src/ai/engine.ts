import type { AiSettings, Asset, Block, ChatMessage, DocSpec } from '../types';
import { extractJson, fixTexDeep, normalizeBlock, normalizeDoc, uid } from '../normalize';
import { SYSTEM_PROMPT, buildUserPayload, historyForAi } from './prompt';
import { partialReply, streamCompletion } from './providers';
import { runLocal, type EngineResult } from './local';

export interface RunArgs {
  prompt: string;
  doc: DocSpec;
  assets: Record<string, Asset>;
  attachments: Asset[];
  history: ChatMessage[];
  settings: AiSettings;
  isFresh: boolean;
  onProgress?: (p: { chars: number; reply: string }) => void;
  signal?: AbortSignal;
}

export function diffDocs(a: DocSpec, b: DocSpec): string[] {
  const out: string[] = [];
  const am = a.meta as unknown as Record<string, unknown>;
  const bm = b.meta as unknown as Record<string, unknown>;
  const metaChanged = Object.keys({ ...am, ...bm }).filter((k) => JSON.stringify(am[k]) !== JSON.stringify(bm[k]));
  if (metaChanged.length) out.push(`Updated ${metaChanged.slice(0, 4).join(', ')}`);
  const aIds = new Map(a.blocks.map((x) => [x.id, JSON.stringify(x)]));
  const bIds = new Set(b.blocks.map((x) => x.id));
  const added = b.blocks.filter((x) => !aIds.has(x.id));
  const removed = a.blocks.filter((x) => !bIds.has(x.id));
  const modified = b.blocks.filter((x) => aIds.has(x.id) && aIds.get(x.id) !== JSON.stringify(x));
  if (added.length) {
    const types = [...new Set(added.map((x) => x.type))];
    out.push(`+${added.length} block${added.length > 1 ? 's' : ''} (${types.slice(0, 5).join(', ')}${types.length > 5 ? '…' : ''})`);
  }
  if (modified.length) out.push(`${modified.length} edited`);
  if (removed.length) out.push(`−${removed.length} removed`);
  return out;
}

type Op = { op?: string; type?: string; id?: string; ids?: string[]; after?: string | null; before?: string; block?: unknown; blocks?: unknown[]; set?: Record<string, unknown>; meta?: Record<string, unknown> };

/** Applies AI edit operations to a document. Unknown or invalid ops are skipped. */
export function applyOps(doc: DocSpec, ops: Op[]): DocSpec {
  let blocks = [...doc.blocks];
  let meta = { ...doc.meta } as Record<string, unknown>;
  const idx = (id?: string | null) => (id ? blocks.findIndex((b) => b.id === id) : -1);
  const fresh = (raw: unknown[]): Block[] => {
    const seen = new Set(blocks.map((b) => b.id));
    return raw
      .map(normalizeBlock)
      .filter((b): b is Block => !!b)
      .map((b) => (seen.has(b.id) ? { ...b, id: uid() } : (seen.add(b.id), b)));
  };
  const position = (after?: string | null, before?: string) => {
    if (before) {
      const i = idx(before);
      if (i >= 0) return i;
    }
    if (after === 'start' || after === null) return 0;
    if (!after || after === 'end') return blocks.length;
    const i = idx(after);
    return i >= 0 ? i + 1 : blocks.length;
  };
  for (const o of ops) {
    if (!o || typeof o !== 'object') continue;
    const kind = String(o.op ?? o.type ?? '').toLowerCase();
    if (kind === 'meta' || kind === 'set_meta' || kind === 'setmeta') {
      meta = { ...meta, ...(o.set ?? o.meta ?? {}) };
    } else if (kind === 'replace' || kind === 'update') {
      const i = idx(o.id);
      const nb = normalizeBlock({ ...(o.block as object), id: o.id });
      if (i >= 0 && nb) blocks[i] = nb;
    } else if (kind === 'insert' || kind === 'add') {
      const nb = fresh(o.blocks ?? (o.block ? [o.block] : []));
      blocks.splice(position(o.after, o.before), 0, ...nb);
    } else if (kind === 'delete' || kind === 'remove') {
      const kill = new Set([...(o.ids ?? []), ...(o.id ? [o.id] : [])]);
      blocks = blocks.filter((b) => !kill.has(b.id));
    } else if (kind === 'move') {
      const i = idx(o.id);
      if (i < 0) continue;
      const [b] = blocks.splice(i, 1);
      blocks.splice(position(o.after, o.before), 0, b);
    }
  }
  const out = normalizeDoc({ meta, blocks }, doc);
  // normalizeDoc re-validates blocks; keep ids stable
  return out;
}

export async function runAssistant(args: RunArgs): Promise<EngineResult & { engine: string }> {
  const { settings } = args;
  if (settings.provider === 'local' || (!settings.apiKey && settings.provider !== 'custom')) {
    await new Promise((r) => setTimeout(r, 350));
    const res = runLocal(args.prompt, args.doc, args.attachments, args.isFresh);
    return { ...res, engine: 'Built-in engine' };
  }
  const payload = buildUserPayload(args.prompt, args.doc, Object.values(args.assets), args.attachments, args.isFresh);
  const turns = [...historyForAi(args.history), { role: 'user' as const, content: payload }];
  const raw = await streamCompletion(settings, SYSTEM_PROMPT, turns, (full) => args.onProgress?.({ chars: full.length, reply: partialReply(full) }), args.signal);
  const parsed = extractJson(raw);
  const model = settings.model || settings.provider;
  if (!parsed || typeof parsed !== 'object') {
    return { reply: raw.trim() || 'The model returned an empty response.', doc: args.doc, changes: [], engine: model };
  }
  const json = fixTexDeep(parsed) as { reply?: string; document?: unknown; meta?: unknown; blocks?: unknown; ops?: Op[] };
  let doc = args.doc;
  if (json.document || json.blocks) doc = normalizeDoc(json.document ?? json, args.doc);
  else if (Array.isArray(json.ops)) doc = applyOps(args.doc, json.ops);
  // keep real data URLs for images the AI saw as "asset:inline"
  doc.blocks = doc.blocks.map((b) => {
    if (b.type === 'image' && b.src === 'asset:inline') {
      const orig = args.doc.blocks.find((o) => o.id === b.id);
      return orig && orig.type === 'image' ? { ...b, src: orig.src } : b;
    }
    return b;
  });
  const truncated = !/\}\s*(```)?\s*$/.test(raw.trim());
  const reply = (json.reply ?? 'Updated the document.') + (truncated ? '\n\n_(The response hit the model’s length limit; I kept everything that arrived. Ask me to “continue” to add the rest.)_' : '');
  return { reply, doc, changes: diffDocs(args.doc, doc), engine: model };
}
