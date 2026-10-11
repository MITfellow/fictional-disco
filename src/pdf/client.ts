import type { Asset, DocSpec } from '../types';

type Pending = { resolve: (b: ArrayBuffer) => void; reject: (e: Error) => void };

const SOURCE_LIMIT = 1_000_000;
function boundNumbers(value: unknown): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(-SOURCE_LIMIT, Math.min(SOURCE_LIMIT, value)) : 0;
  if (Array.isArray(value)) return value.map(boundNumbers);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, boundNumbers(v)]));
}

function omitUnsafePlots(doc: DocSpec): DocSpec {
  const clean = (blocks: DocSpec['blocks']): DocSpec['blocks'] => blocks.flatMap((block) => {
    if (block.type === 'plot') return [];
    if (block.type === 'box' && block.blocks) return [{ ...block, blocks: clean(block.blocks) }];
    return [block];
  });
  return { ...doc, blocks: clean(doc.blocks) };
}

/** Compiles PDFs off the main thread (falls back to the main thread if workers fail). */
class PdfCompiler {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();
  // In dev, Vite's React Fast Refresh runtime leaks into worker modules, so compile on the main thread there.
  private useMain = import.meta.env.DEV;

  private ensure() {
    if (this.worker || this.useMain) return;
    try {
      this.worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        const { id, buf, error } = e.data;
        const p = this.pending.get(id);
        if (!p) return;
        this.pending.delete(id);
        if (error) p.reject(new Error(error));
        else p.resolve(buf);
      };
      this.worker.onerror = (e) => {
        console.warn('PDF worker failed, falling back to main thread:', e.message, e.filename, e.lineno);
        this.useMain = true;
        this.worker?.terminate();
        this.worker = null;
        const all = [...this.pending.values()];
        this.pending.clear();
        all.forEach((p) => p.reject(new Error('__retry__')));
      };
    } catch {
      this.useMain = true;
    }
  }

  private async compileMain(doc: DocSpec, assets: Record<string, Asset>) {
    const [{ registerBrowserFonts }, { compilePdf }] = await Promise.all([import('./fonts.browser'), import('./compile')]);
    registerBrowserFonts();
    try {
      const blob = await compilePdf(doc, assets);
      return blob.arrayBuffer();
    } catch (error) {
      // Never leave the preview unusable because provider-authored geometry hit
      // PDFKit's numeric limits. Retry with bounded source values, then isolate
      // plots (the usual source is a finite value near an asymptote).
      if (!(error instanceof Error) || !/unsupported number|not a finite number/i.test(error.message)) throw error;
      const bounded = boundNumbers(doc) as DocSpec;
      try {
        const blob = await compilePdf(bounded, assets);
        return blob.arrayBuffer();
      } catch (boundedError) {
        if (!(boundedError instanceof Error) || !/unsupported number|not a finite number/i.test(boundedError.message)) throw boundedError;
        const recovered = omitUnsafePlots(bounded);
        const blob = await compilePdf(recovered, assets);
        return blob.arrayBuffer();
      }
    }
  }

  async compile(doc: DocSpec, assets: Record<string, Asset>): Promise<ArrayBuffer> {
    this.ensure();
    if (this.useMain || !this.worker) return this.compileMain(doc, assets);
    const id = ++this.seq;
    try {
      return await new Promise<ArrayBuffer>((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        this.worker!.postMessage({ id, doc, assets });
      });
    } catch (e) {
      if (e instanceof Error && (e.message === '__retry__' || /unsupported number|not a finite number/i.test(e.message))) return this.compileMain(doc, assets);
      throw e;
    }
  }
}

export const compiler = new PdfCompiler();
