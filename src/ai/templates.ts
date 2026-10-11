// Rich document builders used by the offline engine (and as starter templates).
import type { Block, DiagramBlock, DocSpec, ThemeName } from '../types';
import { DEFAULT_META, today, uid } from '../normalize';

const cap = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
const titleCase = (s: string) =>
  cap(s)
    .split(' ')
    .map((w, i) => (i > 0 && /^(a|an|the|of|and|or|for|to|in|on|with|by|at)$/i.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

const H = (level: 1 | 2 | 3, text: string): Block => ({ id: uid(), type: 'heading', level, text });
const P = (text: string, lead = false): Block => ({ id: uid(), type: 'paragraph', text, lead });
const L = (items: string[], ordered = false, checklist = false): Block => ({ id: uid(), type: 'list', items, ordered, checklist });

export function seeded(topic: string) {
  let h = 2166136261;
  for (let i = 0; i < topic.length; i++) h = Math.imul(h ^ topic.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function flowFromChain(chain: string, caption?: string, direction: 'LR' | 'TB' = 'TB'): DiagramBlock {
  // "A -> B -> C; B -> D: label" | "A > B > C"
  const nodes = new Map<string, { id: string; label: string }>();
  const edges: DiagramBlock['edges'] = [];
  const idOf = (label: string) => {
    const clean = label.trim().replace(/^["']|["']$/g, '');
    const key = clean.toLowerCase();
    if (!nodes.has(key)) nodes.set(key, { id: `n${nodes.size + 1}`, label: clean });
    return nodes.get(key)!.id;
  };
  chain
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((stmt) => {
      const parts = stmt.split(/\s*(?:-+>|→|=>|>)\s*/).filter(Boolean);
      for (let i = 0; i < parts.length - 1; i++) {
        let target = parts[i + 1];
        let label: string | undefined;
        const lm = /^\[([^\]]+)\]\s*(.*)$/.exec(target) || /^\|([^|]+)\|\s*(.*)$/.exec(target);
        if (lm) {
          label = lm[1];
          target = lm[2];
        }
        edges.push({ from: idOf(parts[i]), to: idOf(target), label });
      }
      if (parts.length === 1) idOf(parts[0]);
    });
  const list = [...nodes.values()].map((n, i, a) => ({
    ...n,
    shape: (i === 0 || i === a.length - 1 ? 'pill' : /\?$/.test(n.label) ? 'diamond' : 'round') as DiagramBlock['nodes'][number]['shape'],
  }));
  return { id: uid(), type: 'diagram', kind: 'flowchart', direction, nodes: list, edges, caption };
}

export function processDiagram(topic: string, steps?: string[], direction: 'LR' | 'TB' = 'LR'): DiagramBlock {
  const s = steps ?? ['Discover', 'Define', 'Design', 'Build', 'Validate', 'Launch'];
  const nodes = s.map((label, i) => ({ id: `s${i}`, label, shape: (i === 0 || i === s.length - 1 ? 'pill' : 'round') as 'pill' | 'round' }));
  const edges = s.slice(1).map((_, i) => ({ from: `s${i}`, to: `s${i + 1}` }));
  return { id: uid(), type: 'diagram', kind: 'flowchart', direction, nodes, edges, caption: `${titleCase(topic)} — end-to-end process` };
}

export function decisionDiagram(topic: string): DiagramBlock {
  return {
    id: uid(),
    type: 'diagram',
    kind: 'flowchart',
    direction: 'TB',
    caption: `Decision workflow for ${topic}`,
    nodes: [
      { id: 'start', label: 'Request received', shape: 'pill' },
      { id: 'assess', label: 'Assess requirements', shape: 'round' },
      { id: 'ok', label: 'Meets criteria?', shape: 'diamond' },
      { id: 'plan', label: 'Plan & allocate resources', shape: 'round' },
      { id: 'revise', label: 'Revise scope with stakeholders', shape: 'round' },
      { id: 'exec', label: 'Execute & monitor', shape: 'round' },
      { id: 'data', label: 'Metrics store', shape: 'cylinder' },
      { id: 'done', label: 'Deliver & review', shape: 'pill' },
    ],
    edges: [
      { from: 'start', to: 'assess' },
      { from: 'assess', to: 'ok' },
      { from: 'ok', to: 'plan', label: 'Yes' },
      { from: 'ok', to: 'revise', label: 'No' },
      { from: 'revise', to: 'assess', dashed: true },
      { from: 'plan', to: 'exec' },
      { from: 'exec', to: 'data', dashed: true },
      { from: 'exec', to: 'done' },
    ],
  };
}

export function mindmapFor(topic: string, branches?: Record<string, string[]>): DiagramBlock {
  const b = branches ?? {
    Goals: ['Short-term wins', 'Long-term vision'],
    People: ['Stakeholders', 'Team & roles'],
    Process: ['Workflow', 'Quality checks'],
    Tools: ['Platforms', 'Automation'],
    Risks: ['Budget', 'Timeline'],
    Metrics: ['KPIs', 'Feedback loops'],
  };
  const nodes: DiagramBlock['nodes'] = [{ id: 'root', label: titleCase(topic) }];
  const edges: DiagramBlock['edges'] = [];
  Object.entries(b).forEach(([k, kids], i) => {
    const id = `b${i}`;
    nodes.push({ id, label: k });
    edges.push({ from: 'root', to: id });
    kids.forEach((c, j) => {
      nodes.push({ id: `${id}_${j}`, label: c });
      edges.push({ from: id, to: `${id}_${j}` });
    });
  });
  return { id: uid(), type: 'diagram', kind: 'mindmap', nodes, edges, caption: `Concept map — ${topic}` };
}

function quarters(rand: () => number, base = 100, n = 6) {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v = Math.round(v * (1 + (rand() * 0.22 - 0.04)));
    out.push(v);
  }
  return out;
}

const meta = (title: string, extra: Partial<DocSpec['meta']> = {}): DocSpec['meta'] => ({ ...DEFAULT_META, title, date: today(), ...extra });

// ------------------------------------------------------------------ report
export function buildReport(topic: string, theme: ThemeName = 'ink'): DocSpec {
  const T = titleCase(topic);
  const r = seeded(topic);
  const rev = quarters(r, 120 + Math.round(r() * 200));
  const growth = Math.round(((rev[5] - rev[0]) / rev[0]) * 100);
  return {
    meta: meta(`${T}: Annual Report`, { subtitle: `Performance review, key insights and strategic outlook for ${topic}`, author: 'Strategy & Insights Team', cover: true, toc: true, numberedHeadings: true, theme, header: `${T} — Annual Report`, footer: 'Confidential · Internal use only' }),
    blocks: [
      H(1, 'Executive Summary'),
      P(`This report presents a comprehensive review of **${topic}** over the past six quarters. It consolidates performance data, highlights what worked, surfaces the most important risks, and recommends a focused plan for the year ahead.`, true),
      { id: uid(), type: 'kpis', items: [
        { label: 'Growth', value: `${growth}%`, delta: `+${Math.round(growth / 3)} pts YoY`, trend: 'up' },
        { label: 'Satisfaction', value: `${(4 + r() * 0.8).toFixed(1)}/5`, delta: '+0.3', trend: 'up' },
        { label: 'Efficiency', value: `${Math.round(70 + r() * 20)}%`, delta: '+6%', trend: 'up' },
        { label: 'Cost / unit', value: `$${Math.round(20 + r() * 30)}`, delta: '-8%', trend: 'down' },
      ] },
      P(`Overall, ${topic} delivered **strong, consistent progress**. Growth accelerated in the second half, driven by better execution and clearer priorities, while costs were kept under control through process automation.`),
      { id: uid(), type: 'callout', tone: 'success', title: 'Key takeaway', text: `Momentum is real: the last two quarters outperformed the plan. Doubling down on the highest-impact initiatives can sustain ==double-digit growth==.` },
      H(1, 'Performance Overview'),
      P(`The chart below tracks the primary performance indicator across six quarters. The trend shows a healthy upward trajectory with a slight seasonal dip mid-period.`),
      { id: uid(), type: 'chart', kind: 'area', title: 'Quarterly performance index', labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'], series: [{ name: 'Actual', values: rev }, { name: 'Target', values: rev.map((_v, i) => Math.round(rev[0] * (1 + i * 0.08))) }], caption: 'Actual vs. target performance by quarter' },
      H(2, 'Breakdown by segment'),
      { id: uid(), type: 'table', headers: ['Segment', 'Share', 'Growth', 'Status'], rows: [
        ['Core', '42%', '+12%', '**On track**'],
        ['Emerging', '23%', '+31%', '**Ahead**'],
        ['Partnerships', '19%', '+7%', 'Stable'],
        ['Other', '16%', '-2%', 'Needs attention'],
        ['Total', '100%', `+${growth}%`, ''],
      ], caption: 'Contribution and growth by segment', totalRow: true },
      { id: uid(), type: 'chart', kind: 'donut', title: 'Share by segment', labels: ['Core', 'Emerging', 'Partnerships', 'Other'], series: [{ name: 'Share', values: [42, 23, 19, 16] }], unit: '%' },
      H(1, 'Operating Model'),
      P(`To scale ${topic} reliably, we standardized the delivery workflow. Every initiative now moves through the same stages, with clear owners and quality gates.`),
      processDiagram(topic),
      H(2, 'Decision workflow'),
      P('Requests are triaged through a lightweight decision process that balances speed with rigor:'),
      decisionDiagram(topic),
      H(1, 'Risks & Mitigations'),
      { id: uid(), type: 'table', headers: ['Risk', 'Likelihood', 'Impact', 'Mitigation'], rows: [
        ['Resource constraints', 'Medium', 'High', 'Cross-train teams; prioritize ruthlessly'],
        ['Market volatility', 'High', 'Medium', 'Diversify channels and scenario-plan quarterly'],
        ['Technical debt', 'Medium', 'Medium', 'Reserve 20% capacity for platform health'],
        ['Compliance changes', 'Low', 'High', 'Quarterly legal review and early alerts'],
      ], caption: 'Risk register' },
      { id: uid(), type: 'callout', tone: 'warning', title: 'Watch item', text: 'The "Other" segment declined slightly. A deep-dive is recommended before the next planning cycle.' },
      H(1, 'Roadmap'),
      { id: uid(), type: 'timeline', items: [
        { date: 'Q1', title: 'Foundation', text: 'Consolidate data sources, finalize OKRs and staffing plan.' },
        { date: 'Q2', title: 'Acceleration', text: 'Launch the top three initiatives with dedicated squads.' },
        { date: 'Q3', title: 'Scale', text: 'Expand to new segments; automate reporting end-to-end.' },
        { date: 'Q4', title: 'Optimize', text: 'Review outcomes, retire low-impact work, plan next year.' },
      ] },
      H(1, 'Recommendations'),
      L([`Focus investment on the **Emerging** segment, which shows the highest growth.`, 'Automate the remaining manual reporting steps to free up capacity.', 'Introduce a quarterly business review with all stakeholders.', 'Track a small set of north-star metrics:', '  Growth rate and retention', '  Unit cost and cycle time'], true),
      { id: uid(), type: 'quote', text: 'What gets measured gets managed — but only what gets prioritized gets done.', author: 'Leadership offsite' },
      H(1, 'Conclusion'),
      P(`${T} is in a strong position. With disciplined execution of the roadmap above, the coming year can deliver sustainable growth, healthier margins and a better experience for everyone involved.`),
    ],
  };
}

// ---------------------------------------------------------------- proposal
export function buildProposal(topic: string, theme: ThemeName = 'plum'): DocSpec {
  const T = titleCase(topic);
  return {
    meta: meta(`Proposal: ${T}`, { subtitle: `A clear plan, timeline and investment summary for ${topic}`, author: 'Your Company', cover: true, toc: false, theme, footer: 'Proposal · Valid for 30 days' }),
    blocks: [
      H(1, 'Overview'),
      P(`We propose a focused engagement to deliver **${topic}** with measurable outcomes, a transparent timeline and a fixed investment.`, true),
      { id: uid(), type: 'columns', columns: [
        { title: 'The challenge', text: 'Current processes are fragmented, slow and hard to measure — creating cost and missed opportunities.' },
        { title: 'Our solution', text: `A structured program for ${topic} combining expert guidance, modern tooling and hands-on delivery.` },
        { title: 'The outcome', text: 'Faster delivery, lower cost, and a repeatable process your team owns.' },
      ] },
      H(1, 'Scope of Work'),
      L(['Discovery workshops and stakeholder interviews', 'Current-state assessment and gap analysis', 'Solution design and prototype', 'Implementation and integration', 'Training, documentation and handover'], true),
      H(1, 'Approach'),
      processDiagram(topic, ['Kick-off', 'Discovery', 'Design', 'Build', 'Test', 'Handover']),
      H(1, 'Timeline'),
      { id: uid(), type: 'timeline', items: [
        { date: 'Weeks 1–2', title: 'Discovery', text: 'Workshops, interviews and requirements sign-off.' },
        { date: 'Weeks 3–5', title: 'Design', text: 'Architecture, prototype and feedback rounds.' },
        { date: 'Weeks 6–10', title: 'Build & integrate', text: 'Iterative delivery with bi-weekly demos.' },
        { date: 'Weeks 11–12', title: 'Launch & handover', text: 'Go-live support, training and documentation.' },
      ] },
      H(1, 'Investment'),
      { id: uid(), type: 'table', headers: ['Item', 'Description', 'Amount'], rows: [
        ['Discovery', 'Workshops, research, requirements', '$6,500'],
        ['Design', 'Architecture and prototype', '$9,000'],
        ['Implementation', 'Build, integrate and test', '$24,000'],
        ['Enablement', 'Training and documentation', '$3,500'],
        ['Total', '', '$43,000'],
      ], totalRow: true, caption: 'Fixed-price investment summary' },
      { id: uid(), type: 'callout', tone: 'info', title: 'Payment terms', text: '40% on signature, 40% at design approval, 20% on launch. All prices exclude applicable taxes.' },
      H(1, 'Why Us'),
      L(['Proven delivery across 120+ similar projects', 'Senior team, no hand-offs', 'Transparent weekly reporting', 'Satisfaction guarantee']),
      H(1, 'Acceptance'),
      P('By signing below, both parties agree to the scope, timeline and investment described in this proposal.'),
      { id: uid(), type: 'signature', parties: [{ name: 'Client Representative', role: 'Authorized signatory' }, { name: 'Project Lead', role: 'Your Company' }] },
    ],
  };
}

// ------------------------------------------------------------------ resume
export function buildResume(name: string, role: string, theme: ThemeName = 'stone'): DocSpec {
  return {
    meta: meta(titleCase(name), { subtitle: role, cover: false, toc: false, theme, pageNumbers: false, date: undefined }),
    blocks: [
      { id: uid(), type: 'columns', columns: [
        { title: 'Contact', text: 'hello@example.com · +1 555 0100' },
        { title: 'Location', text: 'San Francisco, CA · Remote' },
        { title: 'Links', text: '[linkedin.com/in/you](https://linkedin.com) · [github.com/you](https://github.com)' },
      ] },
      H(2, 'Profile'),
      P(`Results-driven **${role}** with 8+ years of experience delivering high-impact products. Combines strategic thinking with hands-on execution, and thrives in fast-moving, collaborative teams.`),
      H(2, 'Experience'),
      { id: uid(), type: 'timeline', items: [
        { date: '2021 — Present', title: `Senior ${role} · Northwind`, text: 'Led a cross-functional team of 9; shipped a platform used by 2M+ users and improved retention by 18%.' },
        { date: '2018 — 2021', title: `${role} · Contoso`, text: 'Owned the roadmap for three product lines; cut delivery cycle time by 35% with a new workflow.' },
        { date: '2016 — 2018', title: `Associate ${role} · Fabrikam`, text: 'Built analytics dashboards and automated reporting saving 20 hours per week.' },
      ] },
      H(2, 'Skills'),
      { id: uid(), type: 'progress', items: [
        { label: 'Strategy & planning', value: 92 },
        { label: 'Leadership', value: 88 },
        { label: 'Data analysis', value: 84 },
        { label: 'Communication', value: 95 },
      ] },
      H(2, 'Education'),
      { id: uid(), type: 'table', headers: ['Degree', 'Institution', 'Year'], rows: [['M.Sc. Management', 'State University', '2016'], ['B.Sc. Computer Science', 'Tech Institute', '2014']] },
      H(2, 'Certifications'),
      L(['Certified Scrum Product Owner (CSPO)', 'Google Data Analytics Professional', 'PMP — Project Management Professional']),
    ],
  };
}

// ----------------------------------------------------------------- invoice
export function buildInvoice(client: string, theme: ThemeName = 'sage'): DocSpec {
  const no = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
  return {
    meta: meta(`Invoice ${no}`, { subtitle: `Billed to ${titleCase(client)}`, author: 'Your Company LLC', cover: false, toc: false, theme, footer: 'Thank you for your business!' }),
    blocks: [
      { id: uid(), type: 'columns', columns: [
        { title: 'From', text: '**Your Company LLC**\n123 Market Street, Suite 400\nSan Francisco, CA 94105\nbilling@yourcompany.com' },
        { title: 'Bill to', text: `**${titleCase(client)}**\n456 Client Avenue\nNew York, NY 10001\naccounts@client.com` },
        { title: 'Details', text: `Invoice: **${no}**\nIssued: ${today()}\nDue: Net 30\nPO: 7781-A` },
      ] },
      { id: uid(), type: 'table', headers: ['Description', 'Qty', 'Rate', 'Amount'], rows: [
        ['Strategy workshop (half-day)', '2', '$1,200.00', '$2,400.00'],
        ['UX research & interviews', '12', '$150.00', '$1,800.00'],
        ['Design system & UI kit', '1', '$4,500.00', '$4,500.00'],
        ['Front-end development (hours)', '40', '$125.00', '$5,000.00'],
        ['Subtotal', '', '', '$13,700.00'],
        ['Tax (8.5%)', '', '', '$1,164.50'],
        ['Total due', '', '', '$14,864.50'],
      ], totalRow: true, striped: true },
      { id: uid(), type: 'kpis', items: [
        { label: 'Amount due', value: '$14,864.50' },
        { label: 'Due date', value: 'Net 30' },
        { label: 'Status', value: 'Unpaid' },
      ] },
      { id: uid(), type: 'callout', tone: 'info', title: 'Payment instructions', text: 'Bank transfer to **Your Bank** · IBAN US00 0000 0000 0000 · SWIFT ABCDUS33. Please include the invoice number as the reference.' },
      P('Questions about this invoice? Contact billing@yourcompany.com within 14 days.'),
    ],
  };
}

// ------------------------------------------------------------------ letter
export function buildLetter(topic: string, theme: ThemeName = 'stone'): DocSpec {
  return {
    meta: meta(titleCase(topic), { cover: false, toc: false, theme, font: 'serif', pageNumbers: false }),
    blocks: [
      P(`${today()}`),
      P('Dear Hiring Manager,'),
      P(`I am writing regarding **${topic}**. With a track record of delivering results and a genuine passion for this field, I am confident I can make a meaningful contribution to your team.`),
      P('In my previous roles, I led initiatives that improved efficiency, strengthened relationships with key stakeholders, and delivered measurable outcomes. I pride myself on clear communication, ownership, and a collaborative approach.'),
      L(['Delivered projects on time and on budget across multiple teams', 'Introduced processes that cut turnaround time by 30%', 'Mentored colleagues and fostered a culture of continuous improvement']),
      P('I would welcome the opportunity to discuss how my experience aligns with your goals. Thank you for your time and consideration.'),
      P('Sincerely,'),
      { id: uid(), type: 'signature', parties: [{ name: 'Your Name', role: 'you@example.com · +1 555 0100' }] },
    ],
  };
}

// ----------------------------------------------------------------- meeting
export function buildMeeting(topic: string, theme: ThemeName = 'lake'): DocSpec {
  return {
    meta: meta(`Meeting Notes: ${titleCase(topic)}`, { subtitle: 'Weekly sync · 45 minutes · Conference Room B / Teams', cover: false, theme, footer: 'Distributed to all attendees' }),
    blocks: [
      { id: uid(), type: 'columns', columns: [
        { title: 'Attendees', text: 'Alex (chair), Priya, Jordan, Mei, Sam' },
        { title: 'Absent', text: 'Chris (on leave)' },
        { title: 'Next meeting', text: 'Same time next week' },
      ] },
      H(2, 'Agenda'),
      L(['Review of last week’s action items', `Status update on ${topic}`, 'Blockers and risks', 'Decisions needed', 'AOB'], true),
      H(2, 'Discussion'),
      P(`The team reviewed progress on **${topic}**. Most workstreams are on track; integration testing is slightly behind due to environment issues.`),
      { id: uid(), type: 'progress', items: [
        { label: 'Research', value: 100 },
        { label: 'Design', value: 80 },
        { label: 'Development', value: 55 },
        { label: 'Testing', value: 20 },
      ] },
      H(2, 'Decisions'),
      { id: uid(), type: 'callout', tone: 'success', title: 'Agreed', text: 'Move the beta launch by one week to allow complete testing. Priya to own the revised test plan.' },
      H(2, 'Action Items'),
      { id: uid(), type: 'table', headers: ['Action', 'Owner', 'Due', 'Status'], rows: [
        ['Fix staging environment', 'Jordan', 'Wed', 'In progress'],
        ['Update test plan', 'Priya', 'Thu', 'Not started'],
        ['Share launch comms draft', 'Mei', 'Fri', 'Not started'],
        ['Confirm vendor contract', 'Alex', 'Mon', 'Done'],
      ] },
      L(['[x] Circulate last week’s notes', '[ ] Book demo slot with stakeholders', '[ ] Update project dashboard'], false, true),
    ],
  };
}

// ------------------------------------------------------------------ study
export function buildStudyGuide(topic: string, theme: ThemeName = 'clay'): DocSpec {
  const T = titleCase(topic);
  return {
    meta: meta(`${T}: Study Guide`, { subtitle: 'Key concepts, visual summaries and practice questions', author: 'Learning Lab', cover: true, toc: true, theme, numberedHeadings: true }),
    blocks: [
      H(1, 'Learning Objectives'),
      L([`Explain the core ideas behind ${topic}`, 'Connect concepts using visual models', 'Apply knowledge to realistic scenarios', 'Evaluate common misconceptions'], false, true),
      H(1, 'Concept Map'),
      P(`The map below organizes the main themes of **${topic}** and how they relate.`),
      mindmapFor(topic, { Foundations: ['Definitions', 'History'], Principles: ['Core rules', 'Key models'], Applications: ['Real-world cases', 'Tools'], Challenges: ['Limitations', 'Open questions'] }),
      H(1, 'Key Concepts'),
      { id: uid(), type: 'columns', columns: [
        { title: 'Foundations', text: `The essential vocabulary and context you need before diving deeper into ${topic}.` },
        { title: 'Principles', text: 'The rules and models that explain how and why things work.' },
        { title: 'Applications', text: 'How the theory is used in practice — with examples.' },
      ] },
      { id: uid(), type: 'callout', tone: 'note', title: 'Remember', text: 'Focus on *why* each principle matters — understanding beats memorization.' },
      H(1, 'How It Works'),
      { id: uid(), type: 'diagram', kind: 'cycle', nodes: [{ id: 'a', label: 'Observe' }, { id: 'b', label: 'Question' }, { id: 'c', label: 'Hypothesize' }, { id: 'd', label: 'Experiment' }, { id: 'e', label: 'Analyze' }, { id: 'f', label: 'Conclude' }], edges: [], caption: 'The inquiry cycle' },
      H(1, 'Practice Questions'),
      L([`Define ${topic} in your own words.`, 'Name two principles and give an example of each.', 'What is a common misconception, and why is it wrong?', 'Design a small experiment to test one idea from this guide.'], true),
      H(1, 'Summary'),
      { id: uid(), type: 'table', headers: ['Concept', 'One-line summary'], rows: [['Foundations', 'Shared vocabulary and context'], ['Principles', 'Rules that explain behavior'], ['Applications', 'Using ideas to solve problems'], ['Challenges', 'Where the model breaks down']] },
    ],
  };
}

// ------------------------------------------------------------ project plan
export function buildProjectPlan(topic: string, theme: ThemeName = 'ink'): DocSpec {
  const T = titleCase(topic);
  return {
    meta: meta(`${T}: Project Plan`, { subtitle: 'Objectives, scope, schedule, team and risks', author: 'Project Management Office', cover: true, toc: true, theme, numberedHeadings: true, header: `${T} — Project Plan` }),
    blocks: [
      H(1, 'Objectives'),
      P(`Deliver **${topic}** on time and within budget, with clear ownership and measurable success criteria.`, true),
      { id: uid(), type: 'kpis', items: [
        { label: 'Duration', value: '16 wks' },
        { label: 'Budget', value: '$250K' },
        { label: 'Team', value: '8 FTE' },
        { label: 'Milestones', value: '5' },
      ] },
      H(1, 'Work Breakdown'),
      mindmapFor(topic, { Planning: ['Charter', 'Requirements'], Design: ['Architecture', 'UX'], Delivery: ['Build', 'Integrations'], Quality: ['Testing', 'UAT'], Launch: ['Training', 'Go-live'] }),
      H(1, 'Schedule'),
      { id: uid(), type: 'table', headers: ['Phase', 'Start', 'End', 'Owner', 'Deliverable'], rows: [
        ['Initiation', 'Week 1', 'Week 2', 'PM', 'Project charter'],
        ['Design', 'Week 3', 'Week 6', 'Architect', 'Design specification'],
        ['Build', 'Week 7', 'Week 12', 'Tech lead', 'Working release'],
        ['Test', 'Week 11', 'Week 14', 'QA lead', 'Test report'],
        ['Launch', 'Week 15', 'Week 16', 'PM', 'Go-live & handover'],
      ] },
      { id: uid(), type: 'chart', kind: 'stacked', title: 'Planned effort by phase (person-days)', labels: ['Initiation', 'Design', 'Build', 'Test', 'Launch'], series: [{ name: 'Engineering', values: [5, 30, 120, 40, 10] }, { name: 'Design', values: [3, 35, 15, 5, 2] }, { name: 'Management', values: [10, 10, 15, 10, 12] }] },
      H(1, 'Governance'),
      decisionDiagram(topic),
      H(1, 'Team & RACI'),
      { id: uid(), type: 'table', headers: ['Activity', 'Sponsor', 'PM', 'Tech lead', 'QA'], rows: [
        ['Scope approval', 'A', 'R', 'C', 'I'],
        ['Architecture', 'I', 'C', 'A/R', 'C'],
        ['Testing', 'I', 'A', 'C', 'R'],
        ['Go-live decision', 'A', 'R', 'C', 'C'],
      ], caption: 'R = Responsible, A = Accountable, C = Consulted, I = Informed' },
      H(1, 'Risks'),
      { id: uid(), type: 'callout', tone: 'danger', title: 'Critical dependency', text: 'Third-party API access must be confirmed by Week 4 or the build phase will slip.' },
      L(['Scope creep — enforce change control', 'Key-person dependency — pair on critical tasks', 'Vendor delays — weekly vendor check-ins']),
    ],
  };
}

// ---------------------------------------------------------------- article
export function buildArticle(topic: string, theme: ThemeName = 'ink'): DocSpec {
  const T = titleCase(topic);
  return {
    meta: meta(T, { subtitle: `An illustrated guide to ${topic}`, author: 'Fluent PDF Studio', cover: false, toc: false, theme }),
    blocks: [
      P(`**${T}** touches many parts of how we work and live. This guide breaks the topic into clear ideas, visual models and practical next steps.`, true),
      H(1, 'Why It Matters'),
      P(`Understanding ${topic} helps teams make better decisions, avoid common pitfalls and spot new opportunities early. The benefits compound over time.`),
      { id: uid(), type: 'columns', columns: [
        { title: 'Clarity', text: 'A shared mental model reduces confusion and rework.' },
        { title: 'Speed', text: 'Good structure makes it faster to act with confidence.' },
        { title: 'Impact', text: 'Focused effort produces measurable, lasting results.' },
      ] },
      H(1, 'The Big Picture'),
      mindmapFor(topic),
      H(1, 'How It Works'),
      P('At a high level, the process follows a simple sequence of stages:'),
      processDiagram(topic, ['Understand', 'Plan', 'Execute', 'Measure', 'Improve']),
      H(1, 'Key Facts'),
      { id: uid(), type: 'chart', kind: 'bar', title: 'Relative importance of key factors', labels: ['Strategy', 'People', 'Process', 'Technology', 'Culture'], series: [{ name: 'Importance', values: [86, 92, 74, 68, 81] }], unit: '%' },
      { id: uid(), type: 'quote', text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
      H(1, 'Getting Started'),
      L(['Define what success looks like', 'Map the current situation honestly', 'Pick one high-impact improvement', 'Measure, learn and iterate'], true),
      { id: uid(), type: 'callout', tone: 'info', title: 'Tip', text: 'Ask the AI to *"add a table comparing options"* or *"turn the process into a vertical flowchart"* to keep refining this document.' },
    ],
  };
}

// --------------------------------------------------------------- welcome
export function buildWelcome(): DocSpec {
  return {
    meta: meta('Welcome to Fluent PDF Studio', {
      subtitle: 'Describe a document. The AI writes, draws and typesets it as a real vector PDF.',
      author: 'Fluent PDF Studio',
      theme: 'ink',
      cover: false,
      font: 'serif',
      style: 'academic',
      kicker: 'Physics · Maths · Reports · Anything',
    }),
    blocks: [
      P('Ask for lecture notes, a lab report, a worksheet, a research summary, an annual report or a proposal. The assistant writes the text and builds **typeset equations, function plots, physics diagrams, charts and tables**. Everything on this page is vector PDF that you can zoom in on without losing quality.', true),
      H(1, 'Typeset equations'),
      P('Display maths is typeset by a TeX engine and numbered automatically. Inline maths such as $E = mc^2$ or $\\vec{F} = m\\vec{a}$ also works in paragraphs, tables and captions.'),
      { id: uid(), type: 'equation', latex: '\\nabla \\times \\vec{B} = \\mu_0 \\vec{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\vec{E}}{\\partial t}', numbered: true },
      { id: uid(), type: 'equation', latex: 'x(t) = A\\,e^{-\\gamma t}\\cos\\left(\\omega_d t + \\varphi\\right), \\qquad \\omega_d = \\sqrt{\\omega_0^2 - \\gamma^2}', numbered: true },
      H(1, 'Plots of real functions'),
      {
        id: uid(),
        type: 'plot',
        title: 'Damped oscillator',
        functions: [
          { expr: 'exp(-0.25*x)*cos(2*x)', label: '$x(t)$' },
          { expr: 'exp(-0.25*x)', label: 'envelope $\\pm A e^{-\\gamma t}$', dashed: true, color: '#0ea5b7' },
          { expr: '-exp(-0.25*x)', dashed: true, color: '#0ea5b7' },
        ],
        xRange: [0, 14],
        yRange: [-1.1, 1.1],
        xLabel: '$t$ (s)',
        yLabel: '$x$ (m)',
        height: 170,
      },
      H(1, 'Physics diagrams with real lines'),
      {
        id: uid(),
        type: 'figure',
        width: 120,
        height: 34,
        scale: 90,
        elements: [
          { type: 'wall', from: [6, 4], to: [6, 30], kind: 'flip' },
          { type: 'spring', from: [6, 17], to: [60, 17], coils: 10, label: '$k$' },
          { type: 'block', center: [70, 17], size: [20, 16], label: '$m$' },
          { type: 'ground', from: [0, 9], to: [120, 9] },
          { type: 'vector', from: [80, 17], to: [100, 17], label: '$x$', color: '#64748b', width: 1 },
          { type: 'vector', from: [60, 4], to: [44, 4], label: '$F = -kx$', color: '#dc2626', labelPos: 'below' },
        ],
        caption: 'A mass–spring system drawn from simple primitives. The AI also has springs, vectors, inclines, pulleys, circuit parts, lenses, field lines, angles and dimensions.',
      } as Block,
      { id: uid(), type: 'box', variant: 'tip', title: 'Try asking', text: '“Lecture notes on projectile motion with a trajectory diagram and a worked example” · “A lab report on measuring $g$ with a pendulum” · “Add a circuit diagram with two resistors in parallel” · “Make it minimal with airy spacing” · “Use cream paper and black and white colours”', blocks: [] },
      H(1, 'Charts, tables and business layouts too'),
      { id: uid(), type: 'chart', kind: 'bar', title: 'Sample: documents created per month', labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], series: [{ name: 'Notes', values: [12, 19, 24, 31, 38, 46] }, { name: 'Reports', values: [8, 11, 15, 14, 21, 27] }] },
      { id: uid(), type: 'table', headers: ['Capability', 'Examples'], rows: [
        ['Science', 'Equations, step-by-step derivations, plots, free-body, circuit and ray diagrams'],
        ['Structure', 'Definition, theorem, law, example and solution boxes, numbered headings, contents'],
        ['Visuals', 'Flowcharts, mind maps, timelines, 7 chart types, your own images'],
        ['Design', 'Minimal, academic and modern styles; natural paper and calm colours; compact to airy spacing; cover pages'],
      ] },
    ],
  };
}
