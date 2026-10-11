// Offline "AI" engine: understands common document requests and edit commands
// without any network access. It produces the same DocSpec the LLMs do.
import type { Asset, Block, BlockType, ChartBlock, DocSpec, PageSize, ThemeName } from '../types';
import { uid } from '../normalize';
import * as T from './templates';
import { buildScienceNotes, detectScienceTopic } from './science';
import { safeCompile } from '../pdf/expr';

export interface EngineResult {
  reply: string;
  doc: DocSpec;
  changes: string[];
}

const THEME_WORDS: [RegExp, ThemeName][] = [
  [/\b(ink|inky|navy ink)\b/, 'ink'],
  [/\b(sage|olive|forest|natural green)\b/, 'sage'],
  [/\b(clay|terracotta|earthy?|brick)\b/, 'clay'],
  [/\b(stone|taupe|warm gr[ae]y)\b/, 'stone'],
  [/\b(lake|teal|sea)\b/, 'lake'],
  [/\b(plum|mauve|wine)\b/, 'plum'],
  [/\b(ocean|blue|azure|sky)\b/, 'ocean'],
  [/\b(emerald|green|nature|eco|mint)\b/, 'emerald'],
  [/\b(sunset|orange|warm|amber)\b/, 'sunset'],
  [/\b(royal|purple|violet|lavender)\b/, 'royal'],
  [/\b(graphite|gr[ae]y|neutral|corporate)\b/, 'graphite'],
  [/\b(rose|pink|red|crimson)\b/, 'rose'],
  [/\b(midnight|indigo|navy|dark)\b/, 'midnight'],
];

const DOC_KINDS: { kind: string; re: RegExp }[] = [
  { kind: 'resume', re: /\b(resume|résumé|cv|curriculum vitae)\b/ },
  { kind: 'invoice', re: /\b(invoice|bill|receipt|quote for)\b/ },
  { kind: 'letter', re: /\b(cover letter|letter)\b/ },
  { kind: 'meeting', re: /\b(meeting|minutes|standup|stand-up|sync notes)\b/ },
  { kind: 'proposal', re: /\b(proposal|pitch|quotation|sow|statement of work|offer)\b/ },
  { kind: 'study', re: /\b(study guide|lesson|course|tutorial|notes on|cheat ?sheet|explain|learn)\b/ },
  { kind: 'plan', re: /\b(project plan|plan|roadmap|strategy|business plan|launch plan)\b/ },
  { kind: 'report', re: /\b(report|analysis|review|whitepaper|white paper|research|case study|summary)\b/ },
  { kind: 'article', re: /\b(article|guide|ebook|e-book|brochure|document|doc|pdf|essay|overview|handbook)\b/ },
];

const CREATE_RE = /\b(create|make|generate|write|build|design|draft|produce|prepare|compose|new)\b/;

function extractTopic(prompt: string): string {
  let p = prompt.trim().replace(/[.!?]+$/, '');
  const m = /\b(?:about|on|for|regarding|covering|of|titled|called)\s+(.+)$/i.exec(p);
  if (m) p = m[1];
  else
    p = p
      .replace(/^(please\s+)?(can you\s+)?(create|make|generate|write|build|design|draft|produce|prepare|compose)\s+/i, '')
      .replace(/^(me\s+)?(a|an|the|my|some)\s+/i, '')
      .replace(/\b(pdf|document|doc|report|proposal|guide|article|plan|study guide|invoice|letter|resume|cv)\b/gi, '')
      .trim();
  p = p.replace(/\b(with|including|that has|using)\b.*$/i, '').trim();
  p = p.replace(/\b(in|using|with)\s+(the\s+|a\s+)?\w+\s+(theme|style|colou?rs?|palette|font)\b.*$/i, '').replace(/\b(in )?(landscape|portrait)( mode)?\b/i, '').trim();
  return p.replace(/^(a|an|the)\s+/i, '').slice(0, 80) || 'your topic';
}

function pickTheme(text: string): ThemeName | undefined {
  for (const [re, t] of THEME_WORDS) if (re.test(text)) return t;
  return undefined;
}


function chartFromPrompt(p: string, topic: string): ChartBlock {
  const kind: ChartBlock['kind'] = /\bpie\b/.test(p) ? 'pie' : /\bdonut|doughnut\b/.test(p) ? 'donut' : /\bline|trend\b/.test(p) ? 'line' : /\barea\b/.test(p) ? 'area' : /\bstack/.test(p) ? 'stacked' : /\bhorizontal|ranking|hbar\b/.test(p) ? 'hbar' : 'bar';
  // inline data: "chart: A=10, B=20, C=5"
  const pairs = [...p.matchAll(/([a-z][\w\s]{0,20}?)\s*[=:]\s*(-?\d+(?:\.\d+)?)/gi)];
  const r = T.seeded(topic + kind);
  if (pairs.length >= 2) {
    return { id: uid(), type: 'chart', kind, title: `${cap(topic)}`, labels: pairs.map((m) => cap(m[1].trim())), series: [{ name: 'Value', values: pairs.map((m) => Number(m[2])) }] };
  }
  if (kind === 'pie' || kind === 'donut')
    return { id: uid(), type: 'chart', kind, title: `${cap(topic)} — distribution`, labels: ['Segment A', 'Segment B', 'Segment C', 'Segment D'], series: [{ name: 'Share', values: [38, 27, 21, 14] }], unit: '%' };
  if (kind === 'hbar')
    return { id: uid(), type: 'chart', kind, title: `${cap(topic)} — ranking`, labels: ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'], series: [{ name: 'Score', values: [92, 81, 74, 63, 48] }] };
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const mk = (b: number) => months.map((_, i) => Math.round(b * (1 + i * 0.12 + r() * 0.15)));
  return {
    id: uid(),
    type: 'chart',
    kind,
    title: `${cap(topic)} — monthly trend`,
    labels: months,
    series: kind === 'stacked' || /compar|vs\b/.test(p) ? [{ name: 'This year', values: mk(40) }, { name: 'Last year', values: mk(30) }] : [{ name: cap(topic), values: mk(50) }],
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function insertBlocks(doc: DocSpec, blocks: Block[], p: string): DocSpec {
  // "at the top / beginning" → prepend; "after <heading text>" → after that heading's section
  if (/\b(at the (top|beginning|start)|first)\b/.test(p)) return { ...doc, blocks: [...blocks, ...doc.blocks] };
  const after = /\bafter (?:the )?["“]?([^"”]+?)["”]?(?: section)?$/i.exec(p);
  if (after) {
    const i = doc.blocks.findIndex((b) => b.type === 'heading' && b.text.toLowerCase().includes(after[1].toLowerCase()));
    if (i >= 0) {
      let j = i + 1;
      while (j < doc.blocks.length && !(doc.blocks[j].type === 'heading' && (doc.blocks[j] as { level: number }).level <= (doc.blocks[i] as { level: number }).level)) j++;
      const out = [...doc.blocks];
      out.splice(j, 0, ...blocks);
      return { ...doc, blocks: out };
    }
  }
  return { ...doc, blocks: [...doc.blocks, ...blocks] };
}

export function runLocal(promptRaw: string, current: DocSpec, attachments: Asset[], isFresh: boolean): EngineResult {
  const prompt = promptRaw.trim();
  const p = prompt.toLowerCase();
  let doc: DocSpec = { meta: { ...current.meta }, blocks: [...current.blocks] };
  const changes: string[] = [];
  const replies: string[] = [];

  // ----------------------------------------------------------- new documents
  const kind = DOC_KINDS.find((k) => k.re.test(p))?.kind;
  const wantsNew = (CREATE_RE.test(p) && !!kind && !/\b(add|insert|append)\b/.test(p)) || (isFresh && !!kind && !/^(add|insert|change|set|switch|make it)\b/.test(p));
  if (/^(clear|reset|start over|blank|new blank|empty)\b/.test(p)) {
    doc = { meta: { ...doc.meta, title: 'Untitled document', subtitle: undefined, cover: false, toc: false }, blocks: [] };
    return { reply: 'Cleared the canvas. What should we create?', doc, changes: ['Cleared document'] };
  }
  const sci = detectScienceTopic(p);
  if (sci && !/^(add|insert|append|include|put)\b/.test(p) && (CREATE_RE.test(p) || isFresh || /\b(notes?|lecture|explain|teach|chapter|worksheet)\b/.test(p))) {
    doc = buildScienceNotes(sci, { theme: pickTheme(p), style: /\bmodern\b/.test(p) ? 'modern' : undefined });
    applyStyleEdits(p, prompt, doc, changes);
    changes.push(`New ${sci} notes`);
    return {
      reply: `Here are typeset **${doc.meta.title}** notes: MathJax-quality numbered equations, a vector diagram, a function plot, highlighted boxes for laws and key formulas, and a step-by-step worked example.\n\nTry *switch to modern style*, *add equation: F = G m_1 m_2 / r^2*, or *add plot of sin(x)/x*. For any other topic, connect a free **Gemini** or **Groq** key in Settings and the AI will write and draw it from scratch.`,
      doc,
      changes,
    };
  }
  if (wantsNew) {
    const topic = extractTopic(prompt);
    const theme = pickTheme(p);
    switch (kind) {
      case 'resume': {
        const nm = /\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/.exec(prompt)?.[1] ?? 'Alex Morgan';
        const role = /\b(?:as an?|for an?|role:?)\s+([a-z][\w\s]+?)(?:\s+(?:with|in|at)\b|$)/i.exec(prompt)?.[1] ?? (topic !== 'your topic' && topic.split(' ').length <= 4 ? cap(topic) : 'Product Manager');
        doc = T.buildResume(nm, cap(role), theme);
        replies.push(`Here's a polished **résumé** for ${nm} with a profile, experience timeline, skills bars and education table.`);
        break;
      }
      case 'invoice':
        doc = T.buildInvoice(topic === 'your topic' ? 'Acme Corporation' : topic, theme);
        replies.push('Created a professional **invoice** with itemized lines, tax, total due and payment instructions.');
        break;
      case 'letter':
        doc = T.buildLetter(topic === 'your topic' ? 'Cover letter' : cap(topic), theme);
        replies.push('Drafted a clean **letter** in a serif layout with a signature block.');
        break;
      case 'meeting':
        doc = T.buildMeeting(topic, theme);
        replies.push(`Meeting notes for **${topic}** are ready — agenda, progress bars, decisions and an action-item table.`);
        break;
      case 'proposal':
        doc = T.buildProposal(topic, theme);
        replies.push(`Built a **proposal** for ${topic} with a cover page, approach flowchart, timeline, pricing table and signatures.`);
        break;
      case 'study':
        doc = T.buildStudyGuide(topic, theme);
        replies.push(`Your **study guide** on ${topic} includes a concept mind map, inquiry cycle diagram, key concepts and practice questions.`);
        break;
      case 'plan':
        doc = T.buildProjectPlan(topic, theme);
        replies.push(`Created a **project plan** for ${topic}: work-breakdown mind map, schedule, effort chart, governance flowchart, RACI and risks.`);
        break;
      case 'report':
        doc = T.buildReport(topic, theme);
        replies.push(`Your **annual report** on ${topic} is compiled — cover, contents, KPIs, charts, process & decision diagrams, risk register and roadmap.`);
        break;
      default:
        doc = T.buildArticle(topic, theme);
        replies.push(`Created an illustrated **guide** to ${topic} with a mind map, process diagram, chart and action steps.`);
    }
    changes.push(`New ${kind} document`);
    if (attachments.length) {
      doc.blocks.splice(Math.min(2, doc.blocks.length), 0, ...attachments.map((a) => ({ id: uid(), type: 'image' as const, src: `asset:${a.id}`, caption: a.name.replace(/\.[a-z]+$/i, ''), width: 80 })));
      changes.push(`Placed ${attachments.length} image(s)`);
    }
    applyStyleEdits(p, prompt, doc, changes);
    return { reply: replies.join(' ') + '\n\nTip: ask me to *add a chart*, *switch to the emerald theme* or *add a flowchart: A -> B -> C*.', doc, changes };
  }

  // ---------------------------------------------------------------- edits
  applyStyleEdits(p, prompt, doc, changes);

  // removals
  const rm = /\b(remove|delete|drop|get rid of)\b\s+(?:the\s+)?(last|first|all)?\s*(block|heading|paragraph|list|table|image|diagram|flowchart|mind ?map|chart|timeline|quote|callout|code|kpis?|columns|progress|signature|divider|page ?break|section)?s?/.exec(p);
  if (rm && (rm[2] || rm[3])) {
    const which = rm[2] ?? 'last';
    const typeWord = (rm[3] ?? 'block').replace(/\s/g, '');
    const typeMap: Record<string, BlockType | undefined> = { flowchart: 'diagram', mindmap: 'diagram', kpi: 'kpis', pagebreak: 'pagebreak', block: undefined, section: 'heading' };
    const t = (typeWord in typeMap ? typeMap[typeWord] : typeWord) as BlockType | undefined;
    const idxs = doc.blocks.map((b, i) => (!t || b.type === t ? i : -1)).filter((i) => i >= 0);
    if (idxs.length) {
      let kill: number[] = which === 'all' ? idxs : which === 'first' ? [idxs[0]] : [idxs[idxs.length - 1]];
      if (typeWord === 'section') {
        // remove heading and its content
        kill = kill.flatMap((i) => {
          const lvl = (doc.blocks[i] as { level: number }).level;
          const out = [i];
          for (let j = i + 1; j < doc.blocks.length; j++) {
            const b = doc.blocks[j];
            if (b.type === 'heading' && b.level <= lvl) break;
            out.push(j);
          }
          return out;
        });
      }
      const set = new Set(kill);
      doc.blocks = doc.blocks.filter((_, i) => !set.has(i));
      changes.push(`Removed ${set.size} block(s)`);
    }
  }
  if (/\bundo\b/.test(p)) replies.push('Use the **Undo** button in the toolbar (Ctrl+Z) to step back through versions.');

  // additions
  const add: Block[] = [];
  const isAdd = /\b(add|insert|append|include|put|create|make|draw|generate|show)\b/.test(p);
  const topic = extractTopic(prompt.replace(/\b(add|insert|append|include|draw|show)\b\s+(a|an|the)?\s*/i, ''));
  const chain = /[:\-]\s*(.+(?:->|→|=>).+)$/s.exec(prompt) ?? /(.+(?:->|→|=>).+)$/s.exec(prompt);
  if (chain) {
    const dir = /\b(horizontal|left to right|lr)\b/.test(p) ? 'LR' : 'TB';
    const f = T.flowFromChain(chain[1].replace(/^.*?(?:flowchart|diagram|flow|process)\s*:?\s*/i, ''), undefined, dir);
    if (f.nodes.length >= 2) {
      add.push(f);
      changes.push(`Flowchart with ${f.nodes.length} nodes`);
    }
  } else if (isAdd) {
    // science blocks
    const eqm = /\b(?:equation|formula|latex|math)\b\s*:?\s*(.+)$/i.exec(prompt);
    if (eqm && /[=^_\\]/.test(eqm[1])) {
      add.push({ id: uid(), type: 'equation', latex: eqm[1].replace(/^\$+|\$+$/g, '').trim(), numbered: true });
      changes.push('Equation');
    }
    const plm = /\b(?:plot|graph)\b\s*(?:of|for)?\s*:?\s*(?:y\s*=\s*|f\(x\)\s*=\s*)?(.+?)(?:\s+from\s+(-?[\d.]+)\s+to\s+(-?[\d.]+))?$/i.exec(prompt);
    let plotted = false;
    if (plm && /x/.test(plm[1]) && plm[1].length < 80) {
      const exprs = plm[1].split(/\s*(?:,|;|\band\b)\s*/).filter((e) => safeCompile(e));
      if (exprs.length) {
        const xr: [number, number] | undefined = plm[2] && plm[3] ? [Number(plm[2]), Number(plm[3])] : undefined;
        add.push({ id: uid(), type: 'plot', functions: exprs.map((e) => ({ expr: e, label: `$y = ${e.replace(/\*/g, ' ')}$` })), xRange: xr ?? [-2 * Math.PI, 2 * Math.PI], xLabel: '$x$', yLabel: '$y$', caption: `Graph of ${exprs.map((e) => `$y = ${e.replace(/\*/g, ' ')}$`).join(', ')}` });
        changes.push('Function plot');
        plotted = true;
      }
    }
    if (/\b(free[- ]?body|fbd|incline|inclined plane)\b/.test(p)) {
      const fb = buildScienceNotes('forces').blocks.find((b) => b.type === 'figure');
      if (fb) add.push({ ...fb, id: uid() });
      changes.push('Free-body diagram');
    } else if (/\b(circuit)\b/.test(p)) {
      const fb = buildScienceNotes('circuits').blocks.find((b) => b.type === 'figure');
      if (fb) add.push({ ...fb, id: uid() });
      changes.push('Circuit diagram');
    } else if (/\b(ray diagram|lens)\b/.test(p)) {
      const fb = buildScienceNotes('optics').blocks.find((b) => b.type === 'figure');
      if (fb) add.push({ ...fb, id: uid() });
      changes.push('Ray diagram');
    }
    const boxm = /\b(definition|theorem|law|example|problem|summary|key idea|note|tip)\b\s*(?:box)?\s*:\s*(.+)$/i.exec(prompt);
    if (boxm) {
      const variant = boxm[1].toLowerCase() === 'key idea' ? 'key' : (boxm[1].toLowerCase() as 'definition');
      add.push({ id: uid(), type: 'box', variant, text: boxm[2].trim(), blocks: [] });
      changes.push(`${cap(boxm[1])} box`);
    }
    if (plotted || eqm) {
      /* handled above */
    } else if (/\b(mind ?map|concept map|brainstorm)\b/.test(p)) {
      add.push(T.mindmapFor(topic === 'your topic' ? doc.meta.title : topic));
      changes.push('Mind map');
    } else if (/\b(sequence|interaction|api call|handshake)\b/.test(p)) {
      add.push({ id: uid(), type: 'diagram', kind: 'sequence', caption: 'Request / response sequence', nodes: [{ id: 'u', label: 'User' }, { id: 'a', label: 'Web App' }, { id: 's', label: 'API Server' }, { id: 'd', label: 'Database' }], edges: [{ from: 'u', to: 'a', label: 'Submit form' }, { from: 'a', to: 's', label: 'POST /orders' }, { from: 's', to: 'd', label: 'INSERT order' }, { from: 'd', to: 's', label: 'OK', dashed: true }, { from: 's', to: 's', label: 'Validate & enrich' }, { from: 's', to: 'a', label: '201 Created', dashed: true }, { from: 'a', to: 'u', label: 'Confirmation', dashed: true }] });
      changes.push('Sequence diagram');
    } else if (/\b(cycle|loop|circular|lifecycle|life cycle|pdca)\b/.test(p)) {
      add.push({ id: uid(), type: 'diagram', kind: 'cycle', caption: 'Continuous improvement cycle', nodes: ['Plan', 'Do', 'Check', 'Act'].map((l, i) => ({ id: `c${i}`, label: l })), edges: [] });
      changes.push('Cycle diagram');
    } else if (/\b(org ?chart|organi[sz]ation(al)? chart|hierarchy|team structure)\b/.test(p)) {
      add.push({ id: uid(), type: 'diagram', kind: 'flowchart', direction: 'TB', caption: 'Organization chart', nodes: [{ id: 'ceo', label: 'CEO', shape: 'pill' }, { id: 'cto', label: 'CTO', group: 1 }, { id: 'cfo', label: 'CFO', group: 2 }, { id: 'coo', label: 'COO', group: 3 }, { id: 'eng', label: 'Engineering', group: 1 }, { id: 'data', label: 'Data', group: 1 }, { id: 'fin', label: 'Finance', group: 2 }, { id: 'ops', label: 'Operations', group: 3 }, { id: 'sup', label: 'Support', group: 3 }], edges: [{ from: 'ceo', to: 'cto' }, { from: 'ceo', to: 'cfo' }, { from: 'ceo', to: 'coo' }, { from: 'cto', to: 'eng' }, { from: 'cto', to: 'data' }, { from: 'cfo', to: 'fin' }, { from: 'coo', to: 'ops' }, { from: 'coo', to: 'sup' }] });
      changes.push('Org chart');
    } else if (/\b(decision|approval|workflow)\b/.test(p)) {
      add.push(T.decisionDiagram(topic === 'your topic' ? doc.meta.title : topic));
      changes.push('Decision flowchart');
    } else if (/\b(flow ?chart|diagram|process|flow|pipeline|steps)\b/.test(p)) {
      add.push(T.processDiagram(topic === 'your topic' ? doc.meta.title : topic, undefined, /\b(vertical|top to bottom|tb)\b/.test(p) ? 'TB' : 'LR'));
      changes.push('Process flowchart');
    }
    if (/\b(chart|graph|plot|pie|donut|bar|histogram)\b/.test(p) && !/flow ?chart|org ?chart/.test(p)) {
      add.push(chartFromPrompt(p, topic === 'your topic' ? doc.meta.title : topic));
      changes.push('Chart');
    }
    if (/\b(table|comparison|matrix|grid)\b/.test(p)) {
      add.push({ id: uid(), type: 'table', headers: ['Option', 'Cost', 'Effort', 'Impact', 'Recommendation'], rows: [['Option A', '$12K', 'Low', 'Medium', 'Quick win'], ['Option B', '$45K', 'Medium', 'High', '**Preferred**'], ['Option C', '$90K', 'High', 'High', 'Long-term']], caption: `Comparison — ${topic === 'your topic' ? doc.meta.title : topic}` });
      changes.push('Table');
    }
    if (/\b(timeline|roadmap|milestones|schedule)\b/.test(p)) {
      add.push({ id: uid(), type: 'timeline', items: [{ date: 'Phase 1', title: 'Kick-off', text: 'Align on goals, scope and owners.' }, { date: 'Phase 2', title: 'Build', text: 'Deliver the core work in short iterations.' }, { date: 'Phase 3', title: 'Launch', text: 'Release, communicate and support adoption.' }, { date: 'Phase 4', title: 'Review', text: 'Measure results and plan the next cycle.' }] });
      changes.push('Timeline');
    }
    if (/\b(kpis?|metrics|stats|statistics|numbers|scorecard)\b/.test(p)) {
      add.push({ id: uid(), type: 'kpis', items: [{ label: 'Revenue', value: '$2.4M', delta: '+18%', trend: 'up' }, { label: 'Customers', value: '12,480', delta: '+9%', trend: 'up' }, { label: 'Churn', value: '2.1%', delta: '-0.4 pts', trend: 'down' }, { label: 'NPS', value: '64', delta: '+6', trend: 'up' }] });
      changes.push('KPI cards');
    }
    if (/\b(quote|quotation|testimonial)\b/.test(p)) {
      add.push({ id: uid(), type: 'quote', text: 'The best way to predict the future is to create it.', author: 'Peter Drucker' });
      changes.push('Quote');
    }
    const tone = /\b(warning|caution)\b/.test(p) ? 'warning' : /\b(danger|critical|error)\b/.test(p) ? 'danger' : /\b(success|tip|takeaway)\b/.test(p) ? 'success' : /\bnote\b/.test(p) ? 'note' : /\b(callout|info|important|highlight box)\b/.test(p) ? 'info' : null;
    if (tone) {
      const body = /["“](.+?)["”]/.exec(prompt)?.[1];
      add.push({ id: uid(), type: 'callout', tone, title: cap(tone === 'success' ? 'Key takeaway' : tone === 'danger' ? 'Critical' : tone), text: body ?? 'Keep this in mind: focus on the few actions that create the most value, and review progress regularly.' });
      changes.push('Callout');
    }
    if (/\b(code|snippet|script)\b/.test(p)) {
      add.push({ id: uid(), type: 'code', language: /python/.test(p) ? 'python' : /sql/.test(p) ? 'sql' : 'typescript', code: /python/.test(p) ? 'def summarize(data):\n    # compute the average score\n    total = sum(data)\n    return total / len(data)\n\nprint(summarize([4, 8, 15, 16, 23, 42]))' : /sql/.test(p) ? "SELECT region, SUM(revenue) AS total\nFROM sales\nWHERE year = 2026\nGROUP BY region\nORDER BY total DESC;" : "// Compile a document to PDF\nimport { compilePdf } from './pdf';\n\nconst blob = await compilePdf(doc, assets);\nconsole.log(`Generated ${blob.size} bytes`);" });
      changes.push('Code block');
    }
    if (/\b(checklist|to-?do|tasks)\b/.test(p)) {
      add.push({ id: uid(), type: 'list', checklist: true, items: ['[x] Define goals', '[x] Gather inputs', '[ ] Draft the document', '[ ] Review with stakeholders', '[ ] Publish'] });
      changes.push('Checklist');
    } else if (/\b(bullet|list)\b/.test(p)) {
      add.push({ id: uid(), type: 'list', ordered: /\b(numbered|ordered|steps)\b/.test(p), items: ['First key point with a clear benefit', 'Second point backed by evidence', 'Third point with a concrete next step'] });
      changes.push('List');
    }
    if (/\b(progress|skills?|completion)\b/.test(p)) {
      add.push({ id: uid(), type: 'progress', items: [{ label: 'Research', value: 100 }, { label: 'Design', value: 75 }, { label: 'Development', value: 50 }, { label: 'Testing', value: 20 }] });
      changes.push('Progress bars');
    }
    if (/\b(columns?|side by side|cards)\b/.test(p)) {
      add.push({ id: uid(), type: 'columns', columns: [{ title: 'Strengths', text: 'What we do well and should protect.' }, { title: 'Opportunities', text: 'Where we can grow next.' }, { title: 'Risks', text: 'What could slow us down.' }] });
      changes.push('Columns');
    }
    if (/\b(swot)\b/.test(p)) {
      add.push({ id: uid(), type: 'table', headers: ['Strengths', 'Weaknesses'], rows: [['Strong brand and loyal customers', 'Limited marketing budget'], ['Experienced team', 'Legacy systems']], caption: 'SWOT — internal factors' });
      add.push({ id: uid(), type: 'table', headers: ['Opportunities', 'Threats'], rows: [['New markets and partnerships', 'Aggressive competitors'], ['Automation and AI', 'Regulatory changes']], caption: 'SWOT — external factors' });
      changes.push('SWOT analysis');
    }
    if (/\bsignature|sign-?off\b/.test(p)) {
      add.push({ id: uid(), type: 'signature', parties: [{ name: 'Party A', role: 'Authorized signatory' }, { name: 'Party B', role: 'Authorized signatory' }] });
      changes.push('Signature block');
    }
    if (/\bpage ?break|new page\b/.test(p)) {
      add.push({ id: uid(), type: 'pagebreak' });
      changes.push('Page break');
    }
    if (/\b(divider|separator|horizontal rule)\b/.test(p)) {
      add.push({ id: uid(), type: 'divider' });
      changes.push('Divider');
    }
    const sec = /\b(section|chapter|heading|paragraph|intro(duction)?|conclusion|summary)\b(?:\s+(?:about|on|for|called|titled)\s+(.+))?/.exec(p);
    if (sec && !add.length) {
      const subj = sec[3] ? prompt.slice(prompt.toLowerCase().indexOf(sec[3]), prompt.toLowerCase().indexOf(sec[3]) + sec[3].length) : cap(sec[1]);
      const title = /intro/.test(sec[1]) ? 'Introduction' : /conclusion/.test(sec[1]) ? 'Conclusion' : /summary/.test(sec[1]) ? 'Summary' : cap(subj);
      add.push({ id: uid(), type: 'heading', level: 1, text: title });
      add.push({ id: uid(), type: 'paragraph', text: `This section covers **${title.toLowerCase()}** in the context of ${doc.meta.title}. It outlines the essential ideas, why they matter, and how they connect to the rest of the document.` });
      add.push({ id: uid(), type: 'list', items: ['The core idea, stated plainly', 'Supporting evidence and examples', 'Practical implications and next steps'] });
      changes.push(`Section “${title}”`);
    }
  }
  if (attachments.length) {
    attachments.forEach((a) => add.push({ id: uid(), type: 'image', src: `asset:${a.id}`, caption: a.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '), width: /\b(small|half)\b/.test(p) ? 50 : 85 }));
    changes.push(`Placed ${attachments.length} image(s)`);
  }
  if (add.length) doc = insertBlocks(doc, add, p);

  if (!changes.length) {
    // fallback: treat as content to write about
    if (current.blocks.length === 0 || isFresh) {
      doc = T.buildArticle(extractTopic(prompt), pickTheme(p) ?? current.meta.theme);
      return { reply: `I created an illustrated document about **${extractTopic(prompt)}**. Ask for a *report*, *proposal*, *study guide* or *plan* for a different structure — or connect an LLM in **Settings** for fully custom writing.`, doc, changes: ['New document'] };
    }
    const text = prompt.length > 30 ? prompt : `Notes about ${prompt}.`;
    doc.blocks.push({ id: uid(), type: 'paragraph', text });
    return { reply: 'I added your text as a new paragraph. The offline engine understands commands like *add a pie chart*, *add flowchart: A -> B -> C*, *use the royal theme*, *landscape*, *add a cover page*. Connect an AI provider in **Settings** to have it write anything.', doc, changes: ['Paragraph'] };
  }
  const reply = replies.length ? replies.join(' ') : `Done — ${changes.map((c) => c.charAt(0).toLowerCase() + c.slice(1)).join(', ')}.`;
  return { reply, doc, changes };
}

function applyStyleEdits(p: string, raw: string, doc: DocSpec, changes: string[]) {
  const m = doc.meta;
  const styleCtx = /\b(theme|colou?r|palette|style|scheme|switch|change|make it|use)\b/.test(p);
  if (styleCtx) {
    const t = pickTheme(p);
    if (t && t !== m.theme) {
      m.theme = t;
      changes.push(`Theme → ${t}`);
    }
  }
  if (/\bserif\b/.test(p) && !/sans/.test(p) && m.font !== 'serif') ((m.font = 'serif'), changes.push('Font → serif'));
  else if (/\bsans(-serif)?\b/.test(p) && m.font !== 'sans') ((m.font = 'sans'), changes.push('Font → sans'));
  else if (/\b(monospace|mono font|typewriter)\b/.test(p) && m.font !== 'mono') ((m.font = 'mono'), changes.push('Font → mono'));
  if (/\bacademic|scientific style|journal|paper style\b/.test(p) && m.style !== 'academic') ((m.style = 'academic'), (m.font = 'serif'), changes.push('Academic style'));
  else if (/\bminimal( style| design| layout)?\b|\bsimple (design|style|layout)\b|\bclean (design|style|layout)\b/.test(p) && !/cover/.test(p) && m.style !== 'minimal') ((m.style = 'minimal'), changes.push('Minimal style'));
  else if (/\bmodern( style)?\b/.test(p) && m.style !== 'modern') ((m.style = 'modern'), changes.push('Modern style'));
  if (/\b(cream|sepia|old paper|warm paper)\b/.test(p) && m.paper !== 'cream') ((m.paper = 'cream'), changes.push('Paper → cream'));
  else if (/\b(pure )?white (paper|page|background)\b/.test(p) && m.paper !== 'white') ((m.paper = 'white'), changes.push('Paper → white'));
  else if (/\bnatural (paper|page)\b/.test(p) && m.paper) ((m.paper = 'natural'), changes.push('Paper → natural'));
  if (/\b(vivid|bright|bold|vibrant|saturated) colou?rs?\b/.test(p) && m.colors !== 'vivid') ((m.colors = 'vivid'), changes.push('Colours → vivid'));
  else if (/\b(black and white|black & white|grayscale|greyscale|monochrome|no colou?rs?)\b/.test(p) && m.colors !== 'mono') ((m.colors = 'mono'), changes.push('Colours → mono'));
  else if (/\b(soft|muted|calm|natural|gentle) colou?rs?\b/.test(p) && m.colors) ((m.colors = 'natural'), changes.push('Colours → natural'));
  if (/\b(compact|dense|tight|smaller spacing|less spacing)\b/.test(p) && m.density !== 'compact') ((m.density = 'compact'), changes.push('Spacing → compact'));
  else if (/\b(airy|spacious|more (white ?space|spacing|space)|bigger spacing|roomy|breathing)\b/.test(p) && m.density !== 'airy') ((m.density = 'airy'), changes.push('Spacing → airy'));
  else if (/\b(normal|comfortable|default) spacing\b/.test(p) && m.density) ((m.density = 'comfortable'), changes.push('Spacing → comfortable'));
  const cs = /\b(orbits?|waves?|grid|gradient|minimal)\s+cover\b/.exec(p) ?? /\bcover\s+(?:style\s+)?(orbits?|waves?|grid|gradient|minimal)\b/.exec(p);
  if (cs) {
    const v = cs[1].replace(/s$/, '') as string;
    m.coverStyle = (v === 'orbit' ? 'orbits' : v === 'wave' ? 'waves' : v) as DocSpec['meta']['coverStyle'];
    m.cover = true;
    changes.push(`Cover → ${m.coverStyle}`);
  }
  if (/\blandscape\b/.test(p) && m.orientation !== 'landscape') ((m.orientation = 'landscape'), changes.push('Landscape'));
  if (/\bportrait\b/.test(p) && m.orientation !== 'portrait') ((m.orientation = 'portrait'), changes.push('Portrait'));
  const size = /\b(a4|a5|letter size|us letter|legal)\b/.exec(p)?.[1];
  if (size) {
    const ps: PageSize = size === 'a4' ? 'A4' : size === 'a5' ? 'A5' : size === 'legal' ? 'LEGAL' : 'LETTER';
    if (ps !== m.pageSize) ((m.pageSize = ps), changes.push(`Page size → ${ps}`));
  }
  const neg = /\b(remove|no|without|hide|disable|turn off|drop|delete)\b/;
  const toggle = (re: RegExp, key: 'cover' | 'toc' | 'pageNumbers' | 'numberedHeadings', name: string) => {
    const mm = re.exec(p);
    if (!mm) return;
    const before = p.slice(Math.max(0, mm.index - 30), mm.index);
    const on = !neg.test(before);
    if (m[key] !== on) {
      m[key] = on;
      changes.push(`${name} ${on ? 'on' : 'off'}`);
    }
  };
  toggle(/\bcover( page)?\b/, 'cover', 'Cover page');
  toggle(/\b(table of contents|toc|contents page)\b/, 'toc', 'Table of contents');
  toggle(/\bpage numbers?\b/, 'pageNumbers', 'Page numbers');
  toggle(/\bnumbered headings|number(ed)? (the )?sections|heading numbers\b/, 'numberedHeadings', 'Numbered headings');
  const set = (re: RegExp, key: 'title' | 'subtitle' | 'author' | 'footer' | 'header', name: string) => {
    const mm = re.exec(raw);
    if (mm) {
      const v = mm[1].trim().replace(/^["“']|["”']$/g, '');
      (m as unknown as Record<string, string>)[key] = v;
      changes.push(`${name} → “${v}”`);
    }
  };
  set(/\b(?:set |change |rename )?(?:the )?title (?:to|:|as)\s*(.+)$/i, 'title', 'Title');
  set(/\brename (?:it |the document )?to\s+(.+)$/i, 'title', 'Title');
  set(/\bsubtitle (?:to|:|as)\s*(.+)$/i, 'subtitle', 'Subtitle');
  set(/\bauthor (?:to|:|as|is)\s*(.+)$/i, 'author', 'Author');
  set(/\bfooter (?:to|:|as)\s*(.+)$/i, 'footer', 'Footer');
  set(/\bheader (?:to|:|as)\s*(.+)$/i, 'header', 'Header');
}

