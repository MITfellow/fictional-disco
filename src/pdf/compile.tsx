import { pdf } from '@react-pdf/renderer';
import type { Asset, DocSpec } from '../types';
import { PdfDocument, type PageMap } from './PdfDocument';

/** Compiles a DocSpec into a PDF blob. Runs a second pass when a table of contents needs page numbers. */
export async function compilePdf(doc: DocSpec, assets: Record<string, Asset>): Promise<Blob> {
  if (!doc.meta.toc) return pdf(<PdfDocument doc={doc} opts={{ assets }} />).toBlob();
  const pageMap: PageMap = {};
  const first = await pdf(<PdfDocument doc={doc} opts={{ assets, pageMap }} />).toBlob();
  if (!Object.keys(pageMap).length) return first;
  return pdf(<PdfDocument doc={doc} opts={{ assets, knownPages: { ...pageMap } }} />).toBlob();
}
