import { useState, type ReactElement } from 'react';
import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Text,
  Textarea,
  Tooltip,
} from '@fluentui/react-components';
import {
  Add16Regular,
  ArrowDown16Regular,
  ArrowUp16Regular,
  CheckboxChecked16Regular,
  Code16Regular,
  ColumnTriple20Regular,
  Copy16Regular,
  DataBarVertical16Regular,
  Delete16Regular,
  DocumentPageBreak20Regular,
  Edit16Regular,
  Flowchart16Regular,
  Gauge16Regular,
  GanttChart16Regular,
  Image16Regular,
  Info16Regular,
  LineHorizontal116Regular,
  Signature16Regular,
  Table16Regular,
  TextBulletListLtr16Regular,
  TextHeader1Lines16Regular,
  TextParagraph16Regular,
  TextQuote16Regular,
  DataTrending16Regular,
} from '@fluentui/react-icons';
import type { Block, BlockType, DocSpec } from '../types';
import { normalizeBlock, uid } from '../normalize';
import { stripInline } from '../inline';

export const BLOCK_ICONS: Record<BlockType, ReactElement> = {
  heading: <TextHeader1Lines16Regular />,
  paragraph: <TextParagraph16Regular />,
  list: <TextBulletListLtr16Regular />,
  table: <Table16Regular />,
  image: <Image16Regular />,
  diagram: <Flowchart16Regular />,
  chart: <DataBarVertical16Regular />,
  timeline: <GanttChart16Regular />,
  quote: <TextQuote16Regular />,
  callout: <Info16Regular />,
  code: <Code16Regular />,
  kpis: <DataTrending16Regular />,
  columns: <ColumnTriple20Regular />,
  progress: <Gauge16Regular />,
  signature: <Signature16Regular />,
  divider: <LineHorizontal116Regular />,
  pagebreak: <DocumentPageBreak20Regular />,
  spacer: <CheckboxChecked16Regular />,
};

export function summarize(b: Block): string {
  switch (b.type) {
    case 'heading':
    case 'paragraph':
      return stripInline(b.text);
    case 'list':
      return b.items.map(stripInline).join(' · ');
    case 'table':
      return `${b.headers.join(' | ')} — ${b.rows.length} rows`;
    case 'image':
      return b.caption ?? b.src.slice(0, 40);
    case 'diagram':
      return `${b.kind} · ${b.nodes.length} nodes · ${b.edges.length} links${b.caption ? ` — ${b.caption}` : ''}`;
    case 'chart':
      return `${b.kind} chart${b.title ? ` — ${b.title}` : ''}`;
    case 'timeline':
      return b.items.map((i) => i.title).join(' → ');
    case 'quote':
      return `“${b.text}”`;
    case 'callout':
      return `${b.tone}: ${b.title ?? ''} ${stripInline(b.text)}`;
    case 'code':
      return `${b.language ?? 'code'} · ${b.code.split('\n').length} lines`;
    case 'kpis':
      return b.items.map((i) => `${i.label} ${i.value}`).join(' · ');
    case 'columns':
      return b.columns.map((c) => c.title ?? '').join(' · ');
    case 'progress':
      return b.items.map((i) => `${i.label} ${i.value}%`).join(' · ');
    case 'signature':
      return b.parties.map((p) => p.name).join(', ');
    default:
      return '';
  }
}

const TEMPLATES: Record<string, () => unknown> = {
  heading: () => ({ type: 'heading', level: 1, text: 'New section' }),
  paragraph: () => ({ type: 'paragraph', text: 'Write something **great** here.' }),
  list: () => ({ type: 'list', items: ['First point', 'Second point', '  Nested detail', 'Third point'] }),
  table: () => ({ type: 'table', headers: ['Item', 'Description', 'Value'], rows: [['Alpha', 'First item', '10'], ['Beta', 'Second item', '20']] }),
  diagram: () => ({ type: 'diagram', kind: 'flowchart', direction: 'LR', nodes: [{ id: 'a', label: 'Start', shape: 'pill' }, { id: 'b', label: 'Process' }, { id: 'c', label: 'OK?', shape: 'diamond' }, { id: 'd', label: 'Done', shape: 'pill' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd', label: 'Yes' }, { from: 'c', to: 'b', label: 'No' }], caption: 'New flowchart' }),
  chart: () => ({ type: 'chart', kind: 'bar', title: 'New chart', labels: ['A', 'B', 'C', 'D'], series: [{ name: 'Series 1', values: [12, 19, 8, 15] }] }),
  timeline: () => ({ type: 'timeline', items: [{ date: 'Step 1', title: 'Start', text: 'Kick things off' }, { date: 'Step 2', title: 'Finish', text: 'Wrap up' }] }),
  kpis: () => ({ type: 'kpis', items: [{ label: 'Metric', value: '42', delta: '+5%' }, { label: 'Metric 2', value: '87%', delta: '-2%' }] }),
  callout: () => ({ type: 'callout', tone: 'info', title: 'Note', text: 'Important information.' }),
  quote: () => ({ type: 'quote', text: 'A memorable quote.', author: 'Someone' }),
  columns: () => ({ type: 'columns', columns: [{ title: 'Left', text: 'Text' }, { title: 'Right', text: 'Text' }] }),
  code: () => ({ type: 'code', language: 'js', code: 'console.log("hello");' }),
  progress: () => ({ type: 'progress', items: [{ label: 'Progress', value: 60 }] }),
  signature: () => ({ type: 'signature', parties: [{ name: 'Name', role: 'Role' }] }),
  divider: () => ({ type: 'divider' }),
  pagebreak: () => ({ type: 'pagebreak' }),
};

interface Props {
  doc: DocSpec;
  onChange: (doc: DocSpec) => void;
}

export function OutlinePanel({ doc, onChange }: Props) {
  const [editing, setEditing] = useState<{ index: number; text: string; error?: string } | null>(null);
  const blocks = doc.blocks;
  const set = (bs: Block[]) => onChange({ ...doc, blocks: bs });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const bs = [...blocks];
    [bs[i], bs[j]] = [bs[j], bs[i]];
    set(bs);
  };
  const addBlock = (type: string, at = blocks.length) => {
    const b = normalizeBlock({ ...(TEMPLATES[type]() as object), id: uid() });
    if (!b) return;
    const bs = [...blocks];
    bs.splice(at, 0, b);
    set(bs);
  };
  const save = () => {
    if (!editing) return;
    try {
      const b = normalizeBlock(JSON.parse(editing.text));
      if (!b) throw new Error('Unknown block type');
      const bs = [...blocks];
      if (editing.index >= 0) bs[editing.index] = b;
      set(bs);
      setEditing(null);
    } catch (e) {
      setEditing({ ...editing, error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="outline">
      <div className="outline-head">
        <Text weight="semibold">{blocks.length} blocks</Text>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button size="small" appearance="primary" icon={<Add16Regular />}>
              Add block
            </Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {Object.keys(TEMPLATES).map((t) => (
                <MenuItem key={t} icon={BLOCK_ICONS[t as BlockType]} onClick={() => addBlock(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </MenuItem>
              ))}
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>
      {blocks.length === 0 ? <Caption1 className="muted pad">The document is empty — ask the AI to create something, or add blocks manually.</Caption1> : null}
      <ol className="outline-list">
        {blocks.map((b, i) => (
          <li key={b.id} className={`outline-item t-${b.type} ${b.type === 'heading' ? `lvl${b.level}` : ''}`}>
            <span className="o-icon">{BLOCK_ICONS[b.type]}</span>
            <div className="o-body" onDoubleClick={() => setEditing({ index: i, text: JSON.stringify(b, null, 2) })}>
              <Caption1 className="o-type">{b.type === 'heading' ? `Heading ${b.level}` : b.type}</Caption1>
              <span className="o-sum">{summarize(b) || '—'}</span>
            </div>
            <div className="o-actions">
              <Tooltip content="Edit" relationship="label">
                <Button size="small" appearance="subtle" icon={<Edit16Regular />} onClick={() => setEditing({ index: i, text: JSON.stringify(b, null, 2) })} />
              </Tooltip>
              <Tooltip content="Move up" relationship="label">
                <Button size="small" appearance="subtle" icon={<ArrowUp16Regular />} disabled={i === 0} onClick={() => move(i, -1)} />
              </Tooltip>
              <Tooltip content="Move down" relationship="label">
                <Button size="small" appearance="subtle" icon={<ArrowDown16Regular />} disabled={i === blocks.length - 1} onClick={() => move(i, 1)} />
              </Tooltip>
              <Tooltip content="Duplicate" relationship="label">
                <Button
                  size="small"
                  appearance="subtle"
                  icon={<Copy16Regular />}
                  onClick={() => {
                    const bs = [...blocks];
                    bs.splice(i + 1, 0, { ...structuredClone(b), id: uid() });
                    set(bs);
                  }}
                />
              </Tooltip>
              <Tooltip content="Delete" relationship="label">
                <Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => set(blocks.filter((_, j) => j !== i))} />
              </Tooltip>
            </div>
          </li>
        ))}
      </ol>

      <Dialog open={!!editing} onOpenChange={(_, d) => !d.open && setEditing(null)}>
        <DialogSurface className="wide-dialog">
          <DialogBody>
            <DialogTitle>Edit block</DialogTitle>
            <DialogContent>
              {editing?.error ? (
                <MessageBar intent="error" className="mb8">
                  <MessageBarBody>{editing.error}</MessageBarBody>
                </MessageBar>
              ) : null}
              <Textarea className="code-area" resize="vertical" value={editing?.text ?? ''} onChange={(_, d) => editing && setEditing({ ...editing, text: d.value, error: undefined })} rows={18} />
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={save}>
                Apply
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
