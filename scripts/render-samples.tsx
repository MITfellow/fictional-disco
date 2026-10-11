// Renders every template to ./samples/*.pdf (node) — used for testing the compiler.
import { renderToFile } from '@react-pdf/renderer';
import path from 'node:path';
import fs from 'node:fs';
import { registerFonts } from '../src/pdf/fonts';
import { PdfDocument, type PageMap } from '../src/pdf/PdfDocument';
import * as T from '../src/ai/templates';
import { buildScienceNotes } from '../src/ai/science';
import type { DocSpec } from '../src/types';

registerFonts((f) => path.resolve('node_modules/@fontsource', f));

const docs: Record<string, DocSpec> = {
  projectile: buildScienceNotes('projectile'),
  forces: buildScienceNotes('forces'),
  shm: buildScienceNotes('oscillations'),
  circuits: buildScienceNotes('circuits'),
  optics: buildScienceNotes('optics'),
  emi: buildScienceNotes('induction'),
  welcome: T.buildWelcome(),
  minimal: ((d) => ({ ...d, meta: { ...d.meta, style: 'minimal', density: 'airy', font: 'sans', theme: 'stone' } }))(buildScienceNotes('forces')) as DocSpec,
  minserif: ((d) => ({ ...d, meta: { ...d.meta, style: 'minimal', density: 'airy' } }))(buildScienceNotes('forces')) as DocSpec,
  textbook: ((d) => ({ ...d, meta: { ...d.meta, paper: 'cream', colors: 'mono' } }))(buildScienceNotes('oscillations')) as DocSpec,
  compact: ((d) => ({ ...d, meta: { ...d.meta, density: 'compact', theme: 'sage' } }))(buildScienceNotes('optics')) as DocSpec,
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
