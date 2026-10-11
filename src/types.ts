// ---------------------------------------------------------------------------
// Document model — a JSON description of a PDF that both the AI and the
// offline engine produce. The PDF compiler turns this into a real vector PDF.
// ---------------------------------------------------------------------------

export type ThemeName =
  | 'ocean'
  | 'emerald'
  | 'sunset'
  | 'royal'
  | 'graphite'
  | 'rose'
  | 'midnight';

export type FontName = 'sans' | 'serif' | 'mono';
export type PageSize = 'A4' | 'LETTER' | 'LEGAL' | 'A5';
export type Orientation = 'portrait' | 'landscape';
export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'note';
export type Align = 'left' | 'center' | 'right' | 'justify';

export interface DocMeta {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  pageSize: PageSize;
  orientation: Orientation;
  theme: ThemeName;
  font: FontName;
  cover: boolean;
  toc: boolean;
  header?: string;
  footer?: string;
  pageNumbers: boolean;
  numberedHeadings?: boolean;
}

export interface BaseBlock {
  id: string;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  level: 1 | 2 | 3;
  text: string;
}
export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  text: string; // inline markdown: **bold** *italic* `code` [link](url)
  align?: Align;
  lead?: boolean; // larger intro paragraph
}
export interface ListBlock extends BaseBlock {
  type: 'list';
  ordered?: boolean;
  checklist?: boolean;
  items: string[]; // prefix with two spaces per nesting level
}
export interface TableBlock extends BaseBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
  caption?: string;
  striped?: boolean;
  align?: Align[];
  totalRow?: boolean; // style last row as a total
}
export interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string; // data URL, http URL or "asset:<id>"
  caption?: string;
  width?: number; // percentage of content width (10-100)
  align?: 'left' | 'center' | 'right';
  rounded?: boolean;
}

export type NodeShape = 'rect' | 'round' | 'pill' | 'diamond' | 'circle' | 'hexagon' | 'parallelogram' | 'cylinder' | 'note';
export interface DiagramNode {
  id: string;
  label: string;
  shape?: NodeShape;
  color?: string; // optional hex, defaults to theme palette
  group?: number; // swimlane / column hint
}
export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
  bidirectional?: boolean;
}
export interface DiagramBlock extends BaseBlock {
  type: 'diagram';
  kind: 'flowchart' | 'mindmap' | 'sequence' | 'cycle';
  direction?: 'LR' | 'TB';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  caption?: string;
  height?: number; // max height in points
}

export interface ChartSeries {
  name: string;
  values: number[];
  color?: string;
}
export interface ChartBlock extends BaseBlock {
  type: 'chart';
  kind: 'bar' | 'hbar' | 'line' | 'area' | 'pie' | 'donut' | 'stacked';
  title?: string;
  labels: string[];
  series: ChartSeries[];
  unit?: string;
  caption?: string;
}
export interface TimelineBlock extends BaseBlock {
  type: 'timeline';
  items: { date: string; title: string; text?: string }[];
}
export interface QuoteBlock extends BaseBlock {
  type: 'quote';
  text: string;
  author?: string;
}
export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  tone: Tone;
  title?: string;
  text: string;
}
export interface CodeBlock extends BaseBlock {
  type: 'code';
  language?: string;
  code: string;
}
export interface KpiBlock extends BaseBlock {
  type: 'kpis';
  items: { label: string; value: string; delta?: string; trend?: 'up' | 'down' | 'flat' }[];
}
export interface ColumnsBlock extends BaseBlock {
  type: 'columns';
  columns: { title?: string; text: string }[];
}
export interface ProgressBlock extends BaseBlock {
  type: 'progress';
  items: { label: string; value: number }[]; // 0-100
}
export interface SignatureBlock extends BaseBlock {
  type: 'signature';
  parties: { name: string; role?: string }[];
}
export interface DividerBlock extends BaseBlock {
  type: 'divider';
}
export interface PageBreakBlock extends BaseBlock {
  type: 'pagebreak';
}
export interface SpacerBlock extends BaseBlock {
  type: 'spacer';
  size?: number;
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | ImageBlock
  | DiagramBlock
  | ChartBlock
  | TimelineBlock
  | QuoteBlock
  | CalloutBlock
  | CodeBlock
  | KpiBlock
  | ColumnsBlock
  | ProgressBlock
  | SignatureBlock
  | DividerBlock
  | PageBreakBlock
  | SpacerBlock;

export type BlockType = Block['type'];

export interface DocSpec {
  meta: DocMeta;
  blocks: Block[];
}

export interface Asset {
  id: string;
  name: string;
  dataUrl: string;
  width?: number;
  height?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  time: number;
  attachments?: string[]; // asset ids
  engine?: string;
  error?: boolean;
  changes?: string[];
}

export type ProviderId = 'local' | 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'custom';

export interface AiSettings {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
}
