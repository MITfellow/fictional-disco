import type { AiSettings, Asset, ChatMessage, DocSpec } from '../types';
import { extractJson, normalizeDoc } from '../normalize';
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

export async function runAssistant(args: RunArgs): Promise<EngineResult & { engine: string }> {
  const { settings } = args;
  if (settings.provider === 'local' || (!settings.apiKey && settings.provider !== 'custom')) {
    // tiny delay so the UI can show the thinking state
    await new Promise((r) => setTimeout(r, 350));
    const res = runLocal(args.prompt, args.doc, args.attachments, args.isFresh);
    return { ...res, engine: 'Built-in engine' };
  }
  const payload = buildUserPayload(args.prompt, args.doc, Object.values(args.assets), args.attachments);
  const turns = [...historyForAi(args.history), { role: 'user' as const, content: payload }];
  const raw = await streamCompletion(settings, SYSTEM_PROMPT, turns, (full) => args.onProgress?.({ chars: full.length, reply: partialReply(full) }), args.signal);
  const json = extractJson(raw) as { reply?: string; document?: unknown; meta?: unknown; blocks?: unknown } | null;
  if (!json) {
    // the model answered in prose — show it, keep the doc
    return { reply: raw.trim() || 'The model returned an empty response.', doc: args.doc, changes: [], engine: settings.model };
  }
  const docRaw = json.document ?? (json.blocks ? json : null);
  const doc = docRaw ? normalizeDoc(docRaw, args.doc) : args.doc;
  // keep real data URLs for images the AI saw as "asset:inline"
  doc.blocks = doc.blocks.map((b) => {
    if (b.type === 'image' && b.src === 'asset:inline') {
      const orig = args.doc.blocks.find((o) => o.id === b.id);
      return orig && orig.type === 'image' ? { ...b, src: orig.src } : b;
    }
    return b;
  });
  return { reply: json.reply ?? 'Updated the document.', doc, changes: diffDocs(args.doc, doc), engine: settings.model };
}
