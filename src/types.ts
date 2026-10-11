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
  | 'midnight'
  | 'ink'
  | 'sage'
  | 'clay'
  | 'stone'
  | 'lake'
  | 'plum';

export type FontName = 'sans' | 'serif' | 'mono';
export type DocStyle = 'modern' | 'academic' | 'minimal';
export type PaperTone = 'natural' | 'cream' | 'white';
export type ColorMode = 'natural' | 'vivid' | 'mono';
export type Density = 'compact' | 'comfortable' | 'airy';
export type CoverStyle = 'gradient' | 'orbits' | 'waves' | 'grid' | 'minimal';
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
  style?: DocStyle;
  coverStyle?: CoverStyle;
  kicker?: string; // small label above the title, e.g. "PHYSICS · LECTURE NOTES"
  paper?: PaperTone; // page colour (default natural: soft warm off-white)
  colors?: ColorMode; // colour grading (default natural: muted, eye-friendly)
  density?: Density; // spacing / type size (default comfortable)
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
export interface EquationBlock extends BaseBlock {
  type: 'equation';
  latex: string;
  numbered?: boolean;
  label?: string; // custom tag instead of automatic number
  caption?: string;
}

export interface PlotFunction {
  expr: string; // e.g. "sin(x)", "0.5*9.8*x^2"
  label?: string;
  color?: string;
  dashed?: boolean;
  domain?: [number, number];
}
export interface PlotBlock extends BaseBlock {
  type: 'plot';
  title?: string;
  functions?: PlotFunction[];
  parametric?: { x: string; y: string; t?: [number, number]; label?: string; color?: string; dashed?: boolean }[];
  data?: { points: [number, number][]; label?: string; color?: string; line?: boolean }[];
  points?: { x: number; y: number; label?: string }[];
  vlines?: { x: number; label?: string }[];
  hlines?: { y: number; label?: string }[];
  shade?: { expr: string; from: number; to: number; label?: string; color?: string }[];
  xRange?: [number, number];
  yRange?: [number, number];
  xLabel?: string;
  yLabel?: string;
  height?: number;
  caption?: string;
}

export type Pt = [number, number];
export interface FigElement {
  type: string; // line | arrow | vector | rect | circle | ellipse | polygon | polyline | curve | arc | angle | text | label | dot | spring | ground | wire | resistor | capacitor | battery | inductor | bulb | switch | source | meter | lens | mirror | wave | axes | dimension | pulley | block | magnet | solenoid
  from?: Pt;
  to?: Pt;
  at?: Pt;
  center?: Pt;
  points?: Pt[];
  size?: Pt;
  r?: number;
  rx?: number;
  ry?: number;
  startAngle?: number;
  endAngle?: number;
  rotate?: number;
  text?: string;
  label?: string;
  labelPos?: 'above' | 'below' | 'left' | 'right' | 'center' | 'start' | 'end';
  color?: string;
  fill?: string;
  dashed?: boolean;
  width?: number;
  arrow?: 'end' | 'start' | 'both' | 'none';
  fontSize?: number;
  kind?: string;
  amplitude?: number;
  wavelength?: number;
  coils?: number;
  /** magnet: number of field lines drawn on each side */
  lines?: number;
  height?: number;
  length?: Pt;
  smooth?: boolean;
  closed?: boolean;
}
export interface FigureBlock extends BaseBlock {
  type: 'figure';
  width: number; // coordinate system width (y axis points up)
  height: number;
  elements: FigElement[];
  caption?: string;
  scale?: number; // 10-100 percent of content width
  /** place the figure beside the following text (paragraph / list / box / equation) */
  side?: 'left' | 'right';
  /** how many following blocks sit beside a side figure (default 1, max 3) */
  beside?: number;
}

export type BoxVariant = 'definition' | 'theorem' | 'law' | 'principle' | 'example' | 'problem' | 'solution' | 'proof' | 'note' | 'tip' | 'warning' | 'summary' | 'key' | 'formula' | 'abstract';
export interface BoxBlock extends BaseBlock {
  type: 'box';
  variant: BoxVariant;
  title?: string;
  text?: string;
  blocks?: Block[];
}
export interface StepsBlock extends BaseBlock {
  type: 'steps';
  title?: string;
  items: { text?: string; math?: string }[];
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
  | SpacerBlock
  | EquationBlock
  | PlotBlock
  | FigureBlock
  | BoxBlock
  | StepsBlock;

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

export type ProviderId = 'local' | 'gemini' | 'openai' | 'anthropic' | 'groq' | 'openrouter' | 'custom';

export interface AiSettings {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
}
