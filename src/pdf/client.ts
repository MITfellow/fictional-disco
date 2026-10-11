import type { Asset, DocSpec } from '../types';

type Pending = { resolve: (b: ArrayBuffer) => void; reject: (e: Error) => void };

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
    const blob = await compilePdf(doc, assets);
    return blob.arrayBuffer();
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
      if (e instanceof Error && e.message === '__retry__') return this.compileMain(doc, assets);
      throw e;
    }
  }
}

export const compiler = new PdfCompiler();
