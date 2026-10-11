// Renders every template to ./samples/*.pdf (node) — used for testing the compiler.
import { renderToFile } from '@react-pdf/renderer';
import path from 'node:path';
import fs from 'node:fs';
import { registerFonts } from '../src/pdf/fonts';
import { PdfDocument, type PageMap } from '../src/pdf/PdfDocument';
import * as T from '../src/ai/templates';
import type { DocSpec } from '../src/types';

const fs_ = (p: string) => path.resolve('node_modules/@fontsource', p);
registerFonts({
  sans: { 400: fs_('inter/files/inter-latin-400-normal.woff'), '400i': fs_('inter/files/inter-latin-400-italic.woff'), 600: fs_('inter/files/inter-latin-600-normal.woff'), 700: fs_('inter/files/inter-latin-700-normal.woff'), '700i': fs_('inter/files/inter-latin-700-italic.woff'), 800: fs_('inter/files/inter-latin-800-normal.woff') },
  serif: { 400: fs_('merriweather/files/merriweather-latin-400-normal.woff'), '400i': fs_('merriweather/files/merriweather-latin-400-italic.woff'), 700: fs_('merriweather/files/merriweather-latin-700-normal.woff'), '700i': fs_('merriweather/files/merriweather-latin-700-italic.woff'), 900: fs_('merriweather/files/merriweather-latin-900-normal.woff') },
  mono: { 400: fs_('jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff'), 700: fs_('jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff') },
});

const docs: Record<string, DocSpec> = {
  welcome: T.buildWelcome(),
  report: T.buildReport('renewable energy'),
  proposal: T.buildProposal('website redesign'),
  resume: T.buildResume('Jane Doe', 'Product Manager'),
  invoice: T.buildInvoice('Acme Corp'),
  letter: T.buildLetter('Application for Senior Designer'),
  meeting: T.buildMeeting('mobile app launch'),
  study: T.buildStudyGuide('photosynthesis'),
  plan: T.buildProjectPlan('CRM migration'),
  article: T.buildArticle('remote work'),
};
const only = process.argv[2];
fs.mkdirSync('samples', { recursive: true });
for (const [name, doc] of Object.entries(docs)) {
  if (only && name !== only) continue;
  const t = Date.now();
  const pageMap: PageMap = {};
  await renderToFile(<PdfDocument doc={doc} opts={{ assets: {}, pageMap }} />, `samples/${name}.pdf`);
  if (doc.meta.toc) await renderToFile(<PdfDocument doc={doc} opts={{ assets: {}, knownPages: pageMap }} />, `samples/${name}.pdf`);
  console.log(name, Date.now() - t, 'ms', doc.meta.toc ? JSON.stringify(pageMap).slice(0, 80) : '');
}
