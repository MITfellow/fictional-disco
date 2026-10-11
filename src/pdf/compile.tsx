import { pdf } from '@react-pdf/renderer';
import { refreshFonts } from './fonts';
import type { Asset, DocSpec } from '../types';
import { PdfDocument, type PageMap } from './PdfDocument';

// In the browser build, fontkit glyph state left over from one render can map characters to the
// wrong glyphs in the next (words break mid-line, '.' turns into a control character). Dropping
// the parsed fonts before every pass avoids it; the font files themselves stay in the HTTP cache.
const isBrowser = typeof document !== 'undefined' || typeof (globalThis as { importScripts?: unknown }).importScripts === 'function';
let rendered = false;
function fresh(el: Parameters<typeof pdf>[0]) {
  if (isBrowser && rendered) refreshFonts();
  rendered = true;
  return pdf(el).toBlob();
}

async function render(doc: DocSpec, assets: Record<string, Asset>): Promise<Blob> {
  if (!doc.meta.toc) return fresh(<PdfDocument doc={doc} opts={{ assets }} />);
  const pageMap: PageMap = {};
  const first = await fresh(<PdfDocument doc={doc} opts={{ assets, pageMap }} />);
  if (!Object.keys(pageMap).length) return first;
  return fresh(<PdfDocument doc={doc} opts={{ assets, knownPages: { ...pageMap } }} />);
}

// react-pdf shares font objects between renders, so two overlapping renders can corrupt
// each other's glyph runs (mis-broken words, wrong characters). Run them strictly one at a
// time, and skip queued jobs that a newer request has already replaced.
let chain: Promise<unknown> = Promise.resolve();
let latest = 0;
export const STALE = '__stale__';

/** Compiles a DocSpec into a PDF blob. Runs a second pass when a table of contents needs page numbers. */
export function compilePdf(doc: DocSpec, assets: Record<string, Asset>): Promise<Blob> {
  const ticket = ++latest;
  const job = chain.then(() => {
    if (ticket !== latest) throw new Error(STALE);
    return render(doc, assets);
  });
  chain = job.catch(() => undefined);
  return job;
}
