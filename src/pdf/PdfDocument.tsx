import { Document, Ellipse, G, Image, Line, Link, Page, Path, Polygon, Rect, Circle, Svg, Text, View } from './prim';
import type { ReactNode } from 'react';
import type { Style } from '@react-pdf/types';
import type { Asset, Block, BoxBlock, BoxVariant, DocSpec, ListBlock, StepsBlock, TableBlock } from '../types';
import { THEMES, TONES, type PdfTheme } from '../themes';
import { FAMILY, MATH, MONO } from './fonts';
import { tokenizeInline } from '../inline';
import { layoutDiagram } from './diagramLayout';
import { layoutChart } from './chartLayout';
import { scaleScene, tint, shade } from './scene';
import { SceneView } from './SceneView';
import { MathSvg } from './MathSvg';
import { layoutPlot } from './plotLayout';
import { layoutFigure } from './figureLayout';
import { texToRuns } from './texInline';
import { grade, paperColor, setGrade } from './color';

export const PAGE_DIMS: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  LETTER: [612, 792],
  LEGAL: [612, 1008],
  A5: [419.53, 595.28],
};

export type PageMap = Record<string, number>;

interface Ctx {
  theme: PdfTheme;
  font: string[];
  academic: boolean;
  eq: { n: number };
  boxes: Record<string, number>;
  contentW: number;
  contentH: number;
  assets: Record<string, Asset>;
  pageMap?: PageMap; // filled during rendering
  knownPages?: PageMap; // from the previous pass
  figure: { n: number };
  table: { n: number };
  headingNums: Record<string, string>;
  numbered: boolean;
  minimal: boolean;
  vivid: boolean;
  paper: string;
  ty: { body: number; lh: number; para: number; k: number };
  /** book-style paragraphs: indent ids follow a paragraph, tight ids precede one */
  indent?: Set<string>;
  tight?: Set<string>;
}

const DENSITY = {
  // Measures tuned for ~65–75 characters per line, like a well-set book.
  compact: { body: 9.9, lh: 1.5, para: 5.5, k: 0.82, px: 52, py: 52 },
  comfortable: { body: 10.6, lh: 1.6, para: 8, k: 1, px: 70, py: 64 },
  airy: { body: 11.2, lh: 1.72, para: 11, k: 1.25, px: 80, py: 74 },
} as const;

// ------------------------------------------------------------------ inline
function MathRuns({ tex, size, ctx, color, bold }: { tex: string; size: number; ctx: Ctx; color?: string; bold?: boolean }) {
  const runs = texToRuns(tex);
  return (
    <>
      {runs.map((r, i) => {
        const lv = r.level ?? 0;
        const fs = lv ? size * (lv === 1 ? 0.72 : 0.6) : size * 1.06;
        return (
          <Text
            key={i}
            style={{
              fontFamily: r.upright ? ctx.font : MATH,
              fontStyle: r.italic ? 'italic' : 'normal',
              fontWeight: r.bold || bold ? 700 : 400,
              fontSize: fs,
              verticalAlign: r.va,
              color,
            }}
          >
            {r.text}
          </Text>
        );
      })}
    </>
  );
}

function Inline({ text, ctx, color, size: sizeIn }: { text: string; ctx: Ctx; color?: string; size?: number }) {
  const size = sizeIn ?? ctx.ty.body;
  const toks = tokenizeInline(String(text ?? ''));
  return (
    <>
      {toks.map((t, i) => {
        if (t.math) return <MathRuns key={i} tex={t.text} size={size} ctx={ctx} color={color} bold={t.bold} />;
        const style: Style = {};
        if (t.bold) style.fontWeight = 700;
        if (t.italic) style.fontStyle = 'italic';
        if (t.strike) style.textDecoration = 'line-through';
        if (t.code) {
          style.fontFamily = MONO;
          style.backgroundColor = tint(ctx.theme.primary, 0.9);
          style.color = shade(ctx.theme.primary, 0.35);
        }
        if (t.mark) style.backgroundColor = ctx.vivid ? '#fef08a' : '#f3e6b3';
        if (color && !t.code) style.color = color;
        if (t.href) {
          return (
            <Link key={i} src={t.href} style={{ ...style, color: ctx.theme.primary, textDecoration: 'underline' }}>
              {t.text}
            </Link>
          );
        }
        return Object.keys(style).length ? (
          <Text key={i} style={style}>
            {t.code ? ` ${t.text} ` : t.text}
          </Text>
        ) : (
          t.text
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------- blocks
function Heading({ b, ctx }: { b: Extract<Block, { type: 'heading' }>; ctx: Ctx }) {
  const { theme } = ctx;
  const num = ctx.numbered ? ctx.headingNums[b.id] : undefined;
  const tracker = (
    <Text
      style={{ fontSize: 1, color: '#ffffff', height: 0.1, fontFamily: ctx.font, fontWeight: 400 }}
      render={({ pageNumber }) => {
        if (ctx.pageMap) ctx.pageMap[b.id] = pageNumber;
        return ' ';
      }}
    />
  );
  const k = ctx.ty.k;
  if (ctx.minimal) {
    const sz = b.level === 1 ? 15.5 : b.level === 2 ? 12.2 : 10.8;
    return (
      <View id={b.id} minPresenceAhead={60} style={{ marginTop: (b.level === 1 ? 24 : 15) * k, marginBottom: (b.level === 1 ? 7 : 4.5) * k }}>
        {tracker}
        <Text style={{ fontSize: sz, fontWeight: 600, color: b.level === 3 ? theme.muted : theme.text, lineHeight: 1.3, letterSpacing: b.level === 1 ? -0.2 : 0 }}>
          {num ? <Text style={{ color: theme.muted, fontWeight: 400 }}>{num.replace(/\.$/, '')}{'   '}</Text> : null}
          <Inline text={b.text} ctx={ctx} size={sz} />
        </Text>
      </View>
    );
  }
  if (ctx.academic) {
    const sz = b.level === 1 ? 15 : b.level === 2 ? 12.2 : 10.8;
    return (
      <View id={b.id} minPresenceAhead={60} style={{ marginTop: (b.level === 1 ? 22 : 14) * k, marginBottom: (b.level === 1 ? 7 : 4.5) * k }}>
        {tracker}
        <Text style={{ fontSize: sz, fontWeight: 600, fontStyle: b.level === 3 ? 'italic' : 'normal', color: b.level === 1 ? theme.primaryDark : theme.text, lineHeight: 1.3 }}>
          {num ? <Text style={{ color: b.level === 1 ? theme.primary : theme.muted }}>{num.replace(/\.$/, '')}{'   '}</Text> : null}
          <Inline text={b.text} ctx={ctx} size={sz} />
        </Text>
      </View>
    );
  }
  if (b.level === 1)
    return (
      <View id={b.id} minPresenceAhead={80} style={{ marginTop: 22 * k, marginBottom: 10 * k }}>
        {tracker}
        <Text style={{ fontSize: 19, fontWeight: 700, color: theme.primaryDark, lineHeight: 1.25, letterSpacing: -0.2 }}>
          {num ? <Text style={{ color: theme.primary, fontWeight: 600 }}>{num}  </Text> : null}
          <Inline text={b.text} ctx={ctx} size={19} />
        </Text>
        {ctx.vivid ? (
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <View style={{ width: 36, height: 3, backgroundColor: theme.primary, borderRadius: 2 }} />
            <View style={{ width: 10, height: 3, backgroundColor: theme.accent, borderRadius: 2, marginLeft: 3 }} />
          </View>
        ) : (
          <View style={{ width: 28, height: 1.6, backgroundColor: theme.primary, borderRadius: 1, marginTop: 7, opacity: 0.8 }} />
        )}
      </View>
    );
  if (b.level === 2)
    return (
      <View id={b.id} minPresenceAhead={60} style={{ marginTop: 15 * k, marginBottom: 6 * k }}>
        {tracker}
        <Text style={{ fontSize: 13.5, fontWeight: 700, color: theme.text, lineHeight: 1.3 }}>
          {num ? <Text style={{ color: theme.primary }}>{num}  </Text> : null}
          <Inline text={b.text} ctx={ctx} size={ctx.academic ? 12.5 : 14} />
        </Text>
      </View>
    );
  return (
    <View id={b.id} minPresenceAhead={50} style={{ marginTop: 11 * k, marginBottom: 4 * k }}>
      {tracker}
      <Text style={{ fontSize: 11.5, fontWeight: 700, color: theme.primary, lineHeight: 1.3 }}>
        <Inline text={b.text} ctx={ctx} size={11.5} />
      </Text>
    </View>
  );
}

function ListView({ b, ctx }: { b: ListBlock; ctx: Ctx }) {
  const { theme } = ctx;
  const counters: number[] = [];
  return (
    <View style={{ marginBottom: ctx.ty.para, marginTop: 2 }}>
      {(b.items ?? []).map((raw, i) => {
        const str = String(raw ?? '');
        const depth = Math.min(3, Math.floor((str.match(/^\s*/)?.[0].length ?? 0) / 2));
        let text = str.trim().replace(/^[-*•]\s+/, '');
        let checked = false;
        const cm = /^\[( |x|X)\]\s*/.exec(text);
        if (cm) {
          checked = cm[1].toLowerCase() === 'x';
          text = text.slice(cm[0].length);
        }
        counters.length = depth + 1;
        counters[depth] = (counters[depth] ?? 0) + 1;
        let marker: ReactNode;
        if (b.checklist || cm) {
          marker = (
            <Svg width={10} height={10} style={{ marginTop: 2.5 }}>
              <Rect x={0.6} y={0.6} width={8.8} height={8.8} rx={2} fill={checked ? theme.primary : '#ffffff'} stroke={theme.primary} strokeWidth={1.1} />
              {checked ? <Path d="M2.4 5.2 L4.3 7 L7.7 3.2" stroke="#ffffff" strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
            </Svg>
          );
        } else if (b.ordered) {
          const n = counters[depth];
          const label = depth === 1 ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : depth === 2 ? toRoman(n).toLowerCase() : String(n);
          marker = <Text style={{ fontSize: ctx.ty.body - 0.5, fontWeight: 600, color: theme.primary, lineHeight: 1.55 }}>{label}.</Text>;
        } else {
          marker =
            depth === 0 ? (
              <View style={{ width: 4.5, height: 4.5, borderRadius: 3, backgroundColor: theme.primary, marginTop: 5.8, opacity: ctx.vivid ? 1 : 0.75 }} />
            ) : (
              <View style={{ width: 5, height: 5, borderRadius: 3, borderWidth: 1, borderColor: theme.primary, marginTop: 5.5 }} />
            );
        }
        return (
          <View key={i} wrap={false} style={{ flexDirection: 'row', marginLeft: depth * 16, marginBottom: 3.5 * ctx.ty.k }}>
            <View style={{ width: b.ordered ? 18 : 14, alignItems: b.ordered ? 'flex-start' : 'flex-start', paddingTop: (ctx.ty.lh - 1.55) * ctx.ty.body * 0.5 }}>{marker}</View>
            <Text style={{ flex: 1, fontSize: ctx.ty.body, lineHeight: ctx.ty.lh, color: checked ? theme.muted : theme.text, textDecoration: checked ? 'line-through' : 'none' }}>
              <Inline text={text} ctx={ctx} />
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function toRoman(n: number) {
  const map: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let s = '';
  for (const [v, r] of map) while (n >= v) ((s += r), (n -= v));
  return s;
}

function TableView({ b, ctx }: { b: TableBlock; ctx: Ctx }) {
  const { theme } = ctx;
  const headers = (b.headers ?? []).map(String);
  const cols = Math.max(headers.length, ...(b.rows ?? []).map((r) => r.length), 1);
  // weight columns by content length
  const weights = Array.from({ length: cols }, (_, c) => {
    const lens = [headers[c] ?? '', ...(b.rows ?? []).map((r) => String(r[c] ?? ''))].map((s) => Math.min(40, s.length));
    return Math.max(4, Math.max(...lens));
  });
  const total = weights.reduce((a, c) => a + c, 0);
  const isNum = (s: string) => /^[\s$€£¥+\-−]*[\d.,]+\s*[%kKmMbB]?\s*$/.test(s);
  const alignFor = (c: number, s: string) => b.align?.[c] ?? (c > 0 && isNum(s) ? 'right' : 'left');
  ctx.table.n++;
  const rows = b.rows ?? [];
  if (ctx.academic) {
    const w = (c: number) => `${(weights[c] / total) * 100}%`;
    return (
      <View style={{ marginVertical: 10 }}>
        {b.caption ? (
          <Text style={{ fontSize: 9, color: theme.text, marginBottom: 5, textAlign: 'center' }}>
            <Text style={{ fontWeight: 700 }}>Table {ctx.table.n}: </Text>
            <Inline text={b.caption} ctx={ctx} size={9} />
          </Text>
        ) : null}
        <View style={{ borderTopWidth: 1.1, borderBottomWidth: 1.1, borderColor: theme.text }}>
          {headers.length ? (
            <View style={{ flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: theme.text }} wrap={false}>
              {Array.from({ length: cols }, (_, c) => (
                <Text key={c} style={{ width: w(c), paddingVertical: 4.5, paddingHorizontal: 6, fontSize: 9, fontWeight: 700, textAlign: alignFor(c, String(rows[0]?.[c] ?? '')) }}>
                  <Inline text={headers[c] ?? ''} ctx={ctx} size={9} />
                </Text>
              ))}
            </View>
          ) : null}
          {rows.map((r, ri) => {
            const isTotal = b.totalRow && ri === rows.length - 1;
            return (
              <View key={ri} wrap={false} style={{ flexDirection: 'row', borderTopWidth: isTotal ? 0.6 : 0, borderTopColor: theme.text }}>
                {Array.from({ length: cols }, (_, c) => (
                  <Text key={c} style={{ width: w(c), paddingVertical: 3.2, paddingHorizontal: 6, fontSize: 9, lineHeight: 1.4, fontWeight: isTotal ? 700 : 400, textAlign: alignFor(c, String(r[c] ?? '')) }}>
                    <Inline text={String(r[c] ?? '')} ctx={ctx} size={9} />
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      </View>
    );
  }
  return (
    <View style={{ marginVertical: 8 }}>
      <View style={{ borderRadius: ctx.vivid ? 6 : 2, borderTopWidth: 1, borderBottomWidth: 1, borderLeftWidth: ctx.vivid ? 1 : 0, borderRightWidth: ctx.vivid ? 1 : 0, borderColor: ctx.vivid ? theme.border : theme.muted, overflow: 'hidden' }}>
        {headers.length ? (
          <View style={{ flexDirection: 'row', backgroundColor: ctx.vivid ? theme.primary : 'transparent', borderBottomWidth: ctx.vivid ? 0 : 0.7, borderBottomColor: ctx.vivid ? theme.primary : theme.muted }} wrap={false}>
            {Array.from({ length: cols }, (_, c) => (
              <Text
                key={c}
                style={{
                  width: `${(weights[c] / total) * 100}%`,
                  paddingVertical: 6,
                  paddingHorizontal: 7,
                  fontSize: 8.8,
                  fontWeight: 700,
                  color: ctx.vivid ? '#ffffff' : theme.primaryDark,
                  textAlign: alignFor(c, String(rows[0]?.[c] ?? '')),
                }}
              >
                <Inline text={headers[c] ?? ''} ctx={ctx} size={8.8} color={ctx.vivid ? '#ffffff' : theme.primaryDark} />
              </Text>
            ))}
          </View>
        ) : null}
        {rows.map((r, ri) => {
          const isTotal = b.totalRow && ri === rows.length - 1;
          return (
            <View
              key={ri}
              wrap={false}
              style={{
                flexDirection: 'row',
                backgroundColor: isTotal ? theme.soft : ctx.vivid && b.striped !== false && ri % 2 === 1 ? theme.softer : 'transparent',
                borderTopWidth: ri === 0 && headers.length ? 0 : isTotal ? 1 : ctx.vivid ? 0.6 : 0.35,
                borderTopColor: isTotal ? theme.primary : theme.border,
              }}
            >
              {Array.from({ length: cols }, (_, c) => (
                <Text
                  key={c}
                  style={{
                    width: `${(weights[c] / total) * 100}%`,
                    paddingVertical: 5.5,
                    paddingHorizontal: 7,
                    fontSize: 9.2,
                    lineHeight: 1.45,
                    color: theme.text,
                    fontWeight: isTotal || (c === 0 && cols > 2) ? 600 : 400,
                    textAlign: alignFor(c, String(r[c] ?? '')),
                  }}
                >
                  <Inline text={String(r[c] ?? '')} ctx={ctx} size={9} />
                </Text>
              ))}
            </View>
          );
        })}
      </View>
      {b.caption ? (
        <Text style={{ fontSize: 8.5, color: theme.muted, marginTop: 4, textAlign: 'center' }}>
          <Text style={{ fontWeight: 600, color: theme.primary }}>Table {ctx.table.n}. </Text>
          <Inline text={b.caption} ctx={ctx} size={8.5} />
        </Text>
      ) : null}
    </View>
  );
}

function Caption({ text, ctx }: { text?: string; ctx: Ctx }) {
  if (!text) return null;
  ctx.figure.n++;
  if (ctx.academic)
    return (
      <Text style={{ fontSize: 9, color: ctx.theme.text, marginTop: 6, textAlign: 'center', lineHeight: 1.45, paddingHorizontal: 20 }}>
        <Text style={{ fontWeight: 700 }}>Figure {ctx.figure.n}: </Text>
        <Inline text={text} ctx={ctx} size={9} />
      </Text>
    );
  return (
    <Text style={{ fontSize: 8.5, color: ctx.theme.muted, marginTop: 6, textAlign: 'center', lineHeight: 1.45 }}>
      <Text style={{ fontWeight: 600, color: ctx.theme.primary }}>Figure {ctx.figure.n}. </Text>
      <Inline text={text} ctx={ctx} size={8.5} />
    </Text>
  );
}

function FigureCard({ children, ctx }: { children: ReactNode; ctx: Ctx }) {
  if (ctx.academic) return <View style={{ paddingVertical: 4, alignItems: 'center' }}>{children}</View>;
  return (
    <View style={{ borderWidth: ctx.vivid ? 1 : 0, borderColor: ctx.theme.border, borderRadius: ctx.vivid ? 8 : 0, paddingVertical: ctx.vivid ? 12 : 8, paddingHorizontal: ctx.vivid ? 12 : 4, backgroundColor: ctx.vivid ? '#ffffff' : 'transparent', alignItems: 'center' }}>{children}</View>
  );
}

const rich = (ctx: Ctx) => (text: string, size: number) => <Inline text={text} ctx={ctx} size={size} />;

function ToneIcon({ tone, color }: { tone: keyof typeof TONES; color: string }) {
  return (
    <Svg width={16} height={16}>
      <Circle cx={8} cy={8} r={8} fill={color} />
      {tone === 'info' ? (
        <>
          <Circle cx={8} cy={4.6} r={1.1} fill="#fff" />
          <Rect x={7.1} y={6.6} width={1.8} height={5.4} rx={0.9} fill="#fff" />
        </>
      ) : tone === 'success' ? (
        <Path d="M4.6 8.3 L7 10.6 L11.5 5.6" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : tone === 'warning' ? (
        <>
          <Rect x={7.1} y={3.8} width={1.8} height={5.6} rx={0.9} fill="#fff" />
          <Circle cx={8} cy={11.6} r={1.1} fill="#fff" />
        </>
      ) : tone === 'danger' ? (
        <Path d="M5.4 5.4 L10.6 10.6 M10.6 5.4 L5.4 10.6" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
      ) : (
        <Path d="M4.8 11.2 L5.4 8.9 L9.9 4.4 L11.6 6.1 L7.1 10.6 Z" fill="#fff" />
      )}
    </Svg>
  );
}

function resolveSrc(src: string, ctx: Ctx): string | null {
  if (!src) return null;
  if (src.startsWith('asset:')) return ctx.assets[src.slice(6)]?.dataUrl ?? null;
  if (ctx.assets[src]) return ctx.assets[src].dataUrl;
  if (/^data:image\/(png|jpe?g)/i.test(src) || /^https?:\/\//i.test(src)) return src;
  return null;
}

const KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|import|from|export|class|def|async|await|new|try|catch|public|private|static|void|int|string|bool|true|false|null|None|True|False|SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE|AND|OR|type|interface|extends|in|of)\b/;

function CodeLine({ line }: { line: string }) {
  // very small highlighter: comments, strings, numbers, keywords
  const parts: ReactNode[] = [];
  const re = /(\/\/.*$|#.*$|--.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]+\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    const t = m[0];
    let color: string | undefined;
    if (/^(\/\/|#|--)/.test(t)) color = '#7d8aa3';
    else if (/^["'`]/.test(t)) color = '#a5e075';
    else if (/^\d/.test(t)) color = '#f7a76c';
    else if (KEYWORDS.test(t) && t.match(KEYWORDS)?.[0] === t) color = '#c792ea';
    parts.push(
      color ? (
        <Text key={k++} style={{ color }}>
          {t}
        </Text>
      ) : (
        t
      ),
    );
    last = m.index + t.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return <Text style={{ fontFamily: MONO, fontSize: 8.4, lineHeight: 1.5, color: '#e2e8f0' }}>{parts.length ? parts : ' '}</Text>;
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  const color = trend === 'up' ? '#16a34a' : trend === 'down' ? '#dc2626' : '#64748b';
  return (
    <Svg width={7} height={7} style={{ marginRight: 3, marginTop: 1 }}>
      {trend === 'up' ? <Polygon points="3.5,0.5 6.8,6.3 0.2,6.3" fill={color} /> : trend === 'down' ? <Polygon points="0.2,0.7 6.8,0.7 3.5,6.5" fill={color} /> : <Rect x={0} y={2.8} width={7} height={1.6} fill={color} />}
    </Svg>
  );
}

// ------------------------------------------------------------ science boxes
const BOX_STYLE: Record<BoxVariant, { label: string; color?: string; numbered?: boolean }> = {
  definition: { label: 'Definition', numbered: true },
  theorem: { label: 'Theorem', color: '#7c3aed', numbered: true },
  law: { label: 'Law', color: '#0e7490', numbered: false },
  principle: { label: 'Principle', color: '#0f766e' },
  example: { label: 'Example', color: '#059669', numbered: true },
  problem: { label: 'Problem', color: '#ea580c', numbered: true },
  solution: { label: 'Solution', color: '#16a34a' },
  proof: { label: 'Proof', color: '#475569' },
  note: { label: 'Note', color: '#6366f1' },
  tip: { label: 'Tip', color: '#0284c7' },
  warning: { label: 'Caution', color: '#d97706' },
  summary: { label: 'Summary' },
  key: { label: 'Key idea', color: '#db2777' },
  formula: { label: 'Key formulas' },
  abstract: { label: 'Abstract' },
};

function boxContentLength(b: BoxBlock): number {
  let n = (b.text ?? '').length;
  for (const c of b.blocks ?? []) n += c.type === 'paragraph' ? c.text.length : c.type === 'list' ? c.items.join(' ').length + c.items.length * 40 : c.type === 'equation' ? 120 : c.type === 'table' ? 60 * (c.rows.length + 1) : c.type === 'plot' || c.type === 'figure' ? 700 : 200;
  return n;
}

function BoxView({ b, ctx }: { b: BoxBlock; ctx: Ctx }) {
  const { theme } = ctx;
  const st = BOX_STYLE[b.variant] ?? BOX_STYLE.note;
  const calm: Partial<Record<BoxVariant, string>> = { example: theme.accent, problem: theme.accent, solution: theme.accent, warning: '#a8742f', proof: theme.muted, summary: theme.primaryDark };
  const color = ctx.vivid ? st.color ?? (b.variant === 'summary' ? theme.primaryDark : theme.primary) : calm[b.variant] ?? theme.primary;
  let label = st.label;
  if (st.numbered) {
    ctx.boxes[b.variant] = (ctx.boxes[b.variant] ?? 0) + 1;
    label += ` ${ctx.boxes[b.variant]}`;
  }
  const inner: Ctx = { ...ctx, contentW: ctx.contentW - 30 };
  const body = (
    <>
      {b.text ? (
        <Text style={{ fontSize: ctx.ty.body - 0.3, lineHeight: ctx.ty.lh - 0.05, color: theme.text, marginBottom: b.blocks?.length ? 4 : 0, fontStyle: b.variant === 'theorem' && ctx.academic ? 'italic' : 'normal' }}>
          <Inline text={b.text} ctx={ctx} size={ctx.ty.body - 0.3} />
        </Text>
      ) : null}
      {(b.blocks ?? []).map((c) => (
        <BlockView key={c.id} b={c} ctx={inner} />
      ))}
    </>
  );
  const keep = boxContentLength(b) < 900;
  if (b.variant === 'abstract')
    return (
      <View wrap={keep ? false : undefined} style={{ marginHorizontal: ctx.academic ? 28 : 0, marginVertical: 10 }}>
        <Text style={{ fontSize: 9.5, fontWeight: 700, textAlign: ctx.academic ? 'center' : 'left', color: ctx.academic ? theme.text : theme.primary, letterSpacing: ctx.academic ? 0 : 1, marginBottom: 4 }}>
          {ctx.academic ? 'Abstract' : 'ABSTRACT'}
        </Text>
        <View style={{ paddingLeft: ctx.academic ? 0 : 10, borderLeftWidth: ctx.academic ? 0 : 2, borderLeftColor: theme.primary }}>{body}</View>
      </View>
    );
  if (b.variant === 'proof')
    return (
      <View wrap={keep ? false : undefined} style={{ marginVertical: 6 }}>
        <Text style={{ fontSize: 10.2, fontStyle: 'italic', fontWeight: 700, color: theme.text, marginBottom: 2 }}>
          Proof{b.title ? ` (${b.title})` : ''}.
        </Text>
        {body}
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ width: 6, height: 6, borderWidth: 0.8, borderColor: theme.text }} />
        </View>
      </View>
    );
  if (ctx.academic)
    return (
      <View wrap={keep ? false : undefined} style={{ marginVertical: 9 * ctx.ty.k, paddingVertical: 8, paddingHorizontal: 11, borderLeftWidth: ctx.minimal ? 1.5 : 2, borderLeftColor: ctx.minimal ? tint(color, 0.55) : color, backgroundColor: ctx.minimal ? 'transparent' : tint(color, ctx.vivid ? 0.95 : 0.93) }}>
        <Text style={{ fontSize: 10.2, fontWeight: 700, color: shade(color, 0.15), marginBottom: 3 }}>
          {!st.numbered && b.title ? (
            <Inline text={b.title} ctx={ctx} size={10.2} />
          ) : (
            <>
              {label}
              {b.title ? (
                <Text style={{ fontWeight: 400 }}>
                  {' ('}
                  <Inline text={b.title} ctx={ctx} size={10.2} />)
                </Text>
              ) : null}
            </>
          )}
          .
        </Text>
        {body}
      </View>
    );
  const formula = b.variant === 'formula' || b.variant === 'summary';
  // Natural modern documents use an editorial margin rule instead of a nested
  // card with a coloured title bar. It keeps every box type available while
  // making mixed study pages feel like one coherent printed document.
  if (!ctx.vivid)
    return (
      <View wrap={keep ? false : undefined} style={{ marginVertical: 9 * ctx.ty.k, paddingVertical: 6, paddingLeft: 12, paddingRight: 5, borderLeftWidth: formula ? 2.2 : 1.4, borderLeftColor: tint(color, formula ? 0.2 : 0.45), backgroundColor: formula ? tint(color, 0.96) : 'transparent' }}>
        <Text style={{ fontSize: 8.2, fontWeight: 700, letterSpacing: 0.75, color: shade(color, 0.1), marginBottom: 4 }}>
          {label.toUpperCase()}
          {b.title ? (
            <Text style={{ fontSize: 10.2, letterSpacing: 0, color: theme.text }}>
              {'  ·  '}<Inline text={b.title} ctx={ctx} size={10.2} />
            </Text>
          ) : null}
        </Text>
        {body}
      </View>
    );
  return (
    <View wrap={keep ? false : undefined} style={{ marginVertical: 10 * ctx.ty.k, borderRadius: 8, borderWidth: ctx.vivid ? 1 : 0.8, borderColor: tint(color, 0.7), backgroundColor: formula ? tint(color, 0.955) : ctx.vivid ? '#ffffff' : 'transparent', overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 6, backgroundColor: tint(color, 0.9), borderBottomWidth: 0.8, borderBottomColor: tint(color, 0.75) }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 7 }} />
        <Text style={{ fontSize: 7.8, fontWeight: 700, letterSpacing: 1.1, color: shade(color, 0.12) }}>{label.toUpperCase()}</Text>
        {b.title ? (
          <Text style={{ fontSize: 10, fontWeight: 700, color: theme.text, marginLeft: 8, flex: 1 }}>
            <Inline text={b.title} ctx={ctx} size={10} />
          </Text>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 13, paddingTop: 8, paddingBottom: 6 }}>{body}</View>
    </View>
  );
}

function StepsView({ b, ctx }: { b: StepsBlock; ctx: Ctx }) {
  const { theme } = ctx;
  const items = b.items ?? [];
  return (
    <View style={{ marginVertical: 8 }}>
      {b.title ? <Text style={{ fontSize: 10.5, fontWeight: 700, color: theme.primaryDark, marginBottom: 6 }}><Inline text={b.title} ctx={ctx} size={10.5} /></Text> : null}
      {items.map((it, i) => (
        <View key={i} wrap={false} style={{ flexDirection: 'row' }}>
          <View style={{ width: 24, alignItems: 'center' }}>
            <View style={{ width: 17, height: 17, borderRadius: 9, backgroundColor: ctx.academic || !ctx.vivid ? tint(theme.primary, 0.9) : theme.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: FAMILY.sans, fontSize: 8, lineHeight: 1, fontWeight: 700, color: ctx.academic || !ctx.vivid ? theme.primaryDark : '#ffffff' }}>{i + 1}</Text>
            </View>
            {i < items.length - 1 ? <View style={{ width: 1.2, flexGrow: 1, backgroundColor: ctx.academic || !ctx.vivid ? theme.border : tint(theme.primary, 0.6), marginVertical: 2 }} /> : null}
          </View>
          <View style={{ flex: 1, paddingLeft: 8, paddingBottom: 10, paddingTop: 1.5 }}>
            {it.text ? (
              <Text style={{ fontSize: ctx.ty.body - 0.3, lineHeight: ctx.ty.lh - 0.08, color: theme.text }}>
                <Inline text={it.text} ctx={ctx} size={ctx.ty.body - 0.3} />
              </Text>
            ) : null}
            {it.math ? (
              <View style={{ marginTop: it.text ? 4 : 0, alignItems: 'flex-start', paddingLeft: 6 }}>
                <MathSvg tex={it.math} size={11} color={theme.text} maxWidth={ctx.contentW - 50} />
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function BlockView({ b, ctx }: { b: Block; ctx: Ctx }): ReactNode {
  const { theme } = ctx;
  switch (b.type) {
    case 'heading':
      return <Heading b={b} ctx={ctx} />;
    case 'paragraph':
      return (
        <Text
          style={{
            fontSize: b.lead ? ctx.ty.body + 2 : ctx.ty.body,
            lineHeight: b.lead ? ctx.ty.lh - 0.05 : ctx.ty.lh,
            color: b.lead ? shade(theme.muted, 0.15) : theme.text,
            textAlign: b.align ?? 'left',
            textIndent: !b.lead && ctx.indent?.has(b.id) ? Math.round(ctx.ty.body * 1.5) : 0,
            marginBottom: b.lead ? ctx.ty.para + 5 : ctx.tight?.has(b.id) ? Math.round(ctx.ty.para * 0.3) : ctx.ty.para,
          }}
        >
          <Inline text={b.text} ctx={ctx} size={b.lead ? ctx.ty.body + 2 : ctx.ty.body} />
        </Text>
      );
    case 'list':
      return <ListView b={b} ctx={ctx} />;
    case 'table':
      return <TableView b={b} ctx={ctx} />;
    case 'image': {
      const src = resolveSrc(b.src, ctx);
      const pct = Math.max(10, Math.min(100, b.width ?? 100));
      const align = b.align === 'left' ? 'flex-start' : b.align === 'right' ? 'flex-end' : 'center';
      return (
        <View wrap={false} style={{ marginVertical: 10, alignItems: align }}>
          {src ? (
            <Image src={src} style={{ width: `${pct}%`, maxHeight: ctx.contentH * 0.62, objectFit: 'contain', borderRadius: b.rounded === false ? 0 : 8 }} />
          ) : (
            <View style={{ width: `${pct}%`, height: 120, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border, backgroundColor: theme.softer, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={34} height={26}>
                <Rect x={1} y={1} width={32} height={24} rx={4} stroke={theme.muted} strokeWidth={1.4} fill="none" />
                <Circle cx={10} cy={9} r={3} fill={theme.muted} />
                <Path d="M3 23 L13 13 L19 19 L24 15 L32 23" stroke={theme.muted} strokeWidth={1.4} fill="none" />
              </Svg>
              <Text style={{ fontSize: 8.5, color: theme.muted, marginTop: 6 }}>Image placeholder — attach an image in the chat</Text>
            </View>
          )}
          <View style={{ width: '100%' }}>
            <Caption text={b.caption} ctx={ctx} />
          </View>
        </View>
      );
    }
    case 'diagram': {
      const maxW = ctx.contentW - 26;
      const maxH = Math.min(b.height ?? 9999, ctx.contentH * 0.62);
      let scene0 = layoutDiagram(b, theme, !ctx.vivid);
      let k = Math.min(maxW / scene0.width, maxH / scene0.height, 1.1);
      if (b.kind === 'flowchart' && k < 0.68) {
        // too cramped: try the other direction and keep whichever reads better
        const alt = layoutDiagram({ ...b, direction: b.direction === 'LR' ? 'TB' : 'LR' }, theme, !ctx.vivid);
        const k2 = Math.min(maxW / alt.width, maxH / alt.height, 1.1);
        if (k2 > k * 1.15) {
          scene0 = alt;
          k = k2;
        }
      }
      const scene = scaleScene(scene0, k);
      return (
        <View wrap={false} style={{ marginVertical: 10 }}>
          <FigureCard ctx={ctx}>
            <SceneView scene={scene} font={ctx.font} rich={rich(ctx)} />
          </FigureCard>
          <Caption text={b.caption} ctx={ctx} />
        </View>
      );
    }
    case 'chart': {
      const scene = layoutChart(b, theme, ctx.contentW - 26);
      return (
        <View wrap={false} style={{ marginVertical: 10 }}>
          <FigureCard ctx={ctx}>
            <SceneView scene={scene} font={ctx.font} rich={rich(ctx)} />
          </FigureCard>
          <Caption text={b.caption} ctx={ctx} />
        </View>
      );
    }
    case 'timeline':
      return (
        <View style={{ marginVertical: 8, paddingLeft: 4 }}>
          {(b.items ?? []).map((it, i, arr) => (
            <View key={i} wrap={false} style={{ flexDirection: 'row' }}>
              <View style={{ width: 22, alignItems: 'center' }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#ffffff', borderWidth: 3, borderColor: theme.palette[i % theme.palette.length], marginTop: 1 }} />
                {i < arr.length - 1 ? <View style={{ width: 2, flexGrow: 1, backgroundColor: theme.border, marginVertical: 2 }} /> : null}
              </View>
              <View style={{ flex: 1, paddingLeft: 8, paddingBottom: 12 }}>
                <Text style={{ fontSize: 8.5, fontWeight: 700, color: theme.palette[i % theme.palette.length], letterSpacing: 0.6 }}>{String(it.date ?? '').toUpperCase()}</Text>
                <Text style={{ fontSize: 11, fontWeight: 700, color: theme.text, marginTop: 1 }}>
                  <Inline text={it.title} ctx={ctx} size={11} />
                </Text>
                {it.text ? (
                  <Text style={{ fontSize: 9.5, lineHeight: 1.5, color: theme.muted, marginTop: 2 }}>
                    <Inline text={it.text} ctx={ctx} size={9.5} />
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      );
    case 'quote':
      return (
        <View wrap={false} style={{ marginVertical: 10, flexDirection: 'row', backgroundColor: theme.softer, borderRadius: 8, padding: 14 }}>
          <Text style={{ fontSize: 34, color: theme.primary, fontWeight: 800, lineHeight: 1, marginRight: 8, marginTop: -2 }}>“</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12.5, fontStyle: 'italic', lineHeight: 1.55, color: theme.text }}>
              <Inline text={b.text} ctx={ctx} size={12.5} />
            </Text>
            {b.author ? <Text style={{ fontSize: 9.5, fontWeight: 700, color: theme.primary, marginTop: 6 }}>— {b.author}</Text> : null}
          </View>
        </View>
      );
    case 'callout': {
      const t = TONES[b.tone] ?? TONES.info;
      return (
        <View wrap={false} style={{ marginVertical: 9 * ctx.ty.k, flexDirection: 'row', backgroundColor: t.bg, borderLeftWidth: ctx.vivid ? 3 : 2, borderLeftColor: t.border, borderRadius: 6, padding: 12 }}>
          <View style={{ marginRight: 9, marginTop: 0.5 }}>
            <ToneIcon tone={b.tone in TONES ? b.tone : 'info'} color={t.border} />
          </View>
          <View style={{ flex: 1 }}>
            {b.title ? <Text style={{ fontSize: 10.5, fontWeight: 700, color: t.title, marginBottom: 2 }}>{b.title}</Text> : null}
            <Text style={{ fontSize: ctx.ty.body - 0.5, lineHeight: ctx.ty.lh - 0.08, color: theme.text }}>
              <Inline text={b.text} ctx={ctx} size={ctx.ty.body - 0.5} />
            </Text>
          </View>
        </View>
      );
    }
    case 'code': {
      const lines = String(b.code ?? '').replace(/\t/g, '  ').split('\n');
      return (
        <View style={{ marginVertical: 8, backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#1e293b' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginRight: 4 }} />
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b', marginRight: 4 }} />
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e', marginRight: 10 }} />
            <Text style={{ fontSize: 7.5, color: '#94a3b8', fontFamily: MONO }}>{b.language || 'code'}</Text>
          </View>
          <View style={{ paddingHorizontal: 12, paddingVertical: 9 }}>
            {lines.map((l, i) => (
              <View key={i} style={{ flexDirection: 'row' }} wrap={false}>
                <Text style={{ width: 18, fontFamily: MONO, fontSize: 8.4, lineHeight: 1.5, color: '#475569' }}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <CodeLine line={l} />
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }
    case 'kpis': {
      const items = b.items ?? [];
      return (
        <View wrap={false} style={{ flexDirection: 'row', marginVertical: 8, marginHorizontal: -4 }}>
          {items.map((it, i) => {
            const trend = it.trend ?? (String(it.delta ?? '').trim().startsWith('-') || String(it.delta ?? '').trim().startsWith('−') ? 'down' : it.delta ? 'up' : 'flat');
            return (
              <View key={i} style={{ flex: 1, marginHorizontal: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: ctx.vivid ? '#ffffff' : 'transparent', padding: 10, borderTopWidth: ctx.vivid ? 3 : 2, borderTopColor: ctx.vivid ? theme.palette[i % theme.palette.length] : theme.primary }}>
                <Text style={{ fontSize: 7.8, fontWeight: 700, color: theme.muted, letterSpacing: 0.5 }}>{String(it.label ?? '').toUpperCase()}</Text>
                <Text style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginTop: 4 }}>{it.value}</Text>
                {it.delta ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <TrendIcon trend={trend} />
                    <Text style={{ fontSize: 8, fontWeight: 700, color: trend === 'up' ? '#16a34a' : trend === 'down' ? '#dc2626' : theme.muted }}>{it.delta}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      );
    }
    case 'columns':
      return (
        <View style={{ flexDirection: 'row', marginVertical: 8, marginHorizontal: -6 }}>
          {(b.columns ?? []).map((c, i) => (
            <View key={i} style={{ flex: 1, marginHorizontal: 6, backgroundColor: theme.softer, borderRadius: 8, padding: 11 }}>
              {c.title ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.palette[i % theme.palette.length], marginRight: 6 }} />
                  <Text style={{ fontSize: 10.5, fontWeight: 700, color: theme.text }}>{c.title}</Text>
                </View>
              ) : null}
              <Text style={{ fontSize: 9.5, lineHeight: 1.5, color: shade(theme.muted, 0.2) }}>
                <Inline text={c.text} ctx={ctx} size={9.5} />
              </Text>
            </View>
          ))}
        </View>
      );
    case 'progress':
      return (
        <View style={{ marginVertical: 8 }}>
          {(b.items ?? []).map((it, i) => {
            const v = Math.max(0, Math.min(100, Number(it.value) || 0));
            return (
              <View key={i} wrap={false} style={{ marginBottom: 7 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={{ fontSize: 9.5, color: theme.text, fontWeight: 600 }}>{it.label}</Text>
                  <Text style={{ fontSize: 9, color: theme.muted, fontWeight: 700 }}>{Math.round(v)}%</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.soft }}>
                  <View style={{ width: `${v}%`, height: 6, borderRadius: 3, backgroundColor: theme.palette[i % theme.palette.length] }} />
                </View>
              </View>
            );
          })}
        </View>
      );
    case 'signature':
      return (
        <View wrap={false} style={{ flexDirection: 'row', marginTop: 30, marginBottom: 10, marginHorizontal: -10 }}>
          {(b.parties ?? []).map((p, i) => (
            <View key={i} style={{ flex: 1, marginHorizontal: 10 }}>
              <View style={{ height: 34 }} />
              <View style={{ borderTopWidth: 1, borderTopColor: theme.text, paddingTop: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: 700, color: theme.text }}>{p.name}</Text>
                {p.role ? <Text style={{ fontSize: 8.5, color: theme.muted, marginTop: 1 }}>{p.role}</Text> : null}
                <Text style={{ fontSize: 8.5, color: theme.muted, marginTop: 8 }}>Date: ____________________</Text>
              </View>
            </View>
          ))}
        </View>
      );
    case 'equation': {
      let tag = '';
      if (b.label) tag = `(${b.label})`;
      else if (b.numbered !== false) tag = `(${++ctx.eq.n})`;
      const tagW = tag ? 34 : 0;
      return (
        <View wrap={false} style={{ marginVertical: 8 * ctx.ty.k }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: tagW }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <MathSvg tex={b.latex} size={ctx.academic ? 11.5 : 11.8} color={theme.text} maxWidth={ctx.contentW - tagW * 2 - 4} />
            </View>
            <View style={{ width: tagW, alignItems: 'flex-end' }}>
              {tag ? <Text style={{ fontSize: 10, color: ctx.academic ? theme.text : theme.muted }}>{tag}</Text> : null}
            </View>
          </View>
          {b.caption ? (
            <Text style={{ fontSize: 8.5, color: theme.muted, textAlign: 'center', marginTop: 3 }}>
              <Inline text={b.caption} ctx={ctx} size={8.5} />
            </Text>
          ) : null}
        </View>
      );
    }
    case 'plot': {
      const scene = layoutPlot(b, theme, Math.min(ctx.contentW - 26, 470));
      return (
        <View wrap={false} style={{ marginVertical: 10 }}>
          <FigureCard ctx={ctx}>
            <SceneView scene={scene} font={ctx.font} rich={rich(ctx)} />
          </FigureCard>
          <Caption text={b.caption} ctx={ctx} />
        </View>
      );
    }
    case 'figure': {
      const scene = layoutFigure(b, theme, ctx.contentW - (b.fullPage ? 4 : 26), ctx.contentH * (b.fullPage ? 0.86 : 0.55), !ctx.vivid);
      return (
        <View wrap={false} style={{ marginVertical: 10 }}>
          <FigureCard ctx={ctx}>
            <SceneView scene={scene} font={ctx.font} rich={rich(ctx)} />
          </FigureCard>
          <Caption text={b.caption} ctx={ctx} />
        </View>
      );
    }
    case 'box':
      return <BoxView b={b} ctx={ctx} />;
    case 'steps':
      return <StepsView b={b} ctx={ctx} />;
    case 'divider':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12 }}>
          <View style={{ flex: 1, height: 0.8, backgroundColor: theme.border }} />
          <View style={{ width: 4, height: 4, backgroundColor: ctx.vivid ? theme.primary : theme.border, transform: 'rotate(45deg)', marginHorizontal: 8 }} />
          <View style={{ flex: 1, height: 0.8, backgroundColor: theme.border }} />
        </View>
      );
    case 'pagebreak':
      return <View break />;
    case 'spacer':
      return <View style={{ height: Math.max(2, Math.min(300, b.size ?? 16)) }} />;
    default:
      return null;
  }
}

// --------------------------------------------------------------- cover/TOC
function CoverArt({ style, theme, W, H }: { style: string; theme: PdfTheme; W: number; H: number }) {
  const c1 = theme.primary;
  const c2 = theme.accent;
  if (style === 'orbits') {
    const cx = W * 0.78;
    const cy = H * 0.24;
    return (
      <>
        <Circle cx={cx} cy={cy} r={W * 0.5} fill={c1} fillOpacity={0.16} />
        <Circle cx={cx} cy={cy} r={W * 0.32} fill={c1} fillOpacity={0.18} />
        {[0, 60, 120].map((a) => (
          <G key={a} transform={`rotate(${a} ${cx} ${cy})`}>
            <Ellipse cx={cx} cy={cy} rx={W * 0.3} ry={W * 0.1} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.1} fill="none" />
          </G>
        ))}
        <Circle cx={cx} cy={cy} r={W * 0.035} fill={c2} />
        <Circle cx={cx} cy={cy} r={W * 0.06} fill={c2} fillOpacity={0.25} />
        <Circle cx={cx + W * 0.3} cy={cy} r={4} fill="#ffffff" />
        <Circle cx={cx - W * 0.15} cy={cy - W * 0.26 * 0.866 * 0.8} r={3.5} fill={c2} />
        <Circle cx={cx - W * 0.12} cy={cy + W * 0.2} r={3} fill="#ffffff" fillOpacity={0.8} />
        {Array.from({ length: 70 }).map((_, i) => {
          const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
          const y = (Math.sin(i * 78.233) * 12345.678) % 1;
          return <Circle key={i} cx={Math.abs(x) * W} cy={Math.abs(y) * H} r={(i % 3) * 0.4 + 0.5} fill="#ffffff" fillOpacity={0.25 + (i % 4) * 0.12} />;
        })}
        <Path d={`M 0 ${H * 0.86} Q ${W * 0.5} ${H * 0.8} ${W} ${H * 0.9} L ${W} ${H} L 0 ${H} Z`} fill="#ffffff" fillOpacity={0.05} />
      </>
    );
  }
  if (style === 'waves') {
    return (
      <>
        <Circle cx={W * 0.9} cy={H * 0.1} r={W * 0.35} fill={c1} fillOpacity={0.3} />
        {Array.from({ length: 14 }).map((_, i) => {
          const y0 = H * 0.58 + i * 9;
          const amp = 14 + i * 2.2;
          const ph = i * 0.35;
          let d = `M 0 ${y0}`;
          for (let x = 0; x <= W; x += 6) d += ` L ${x} ${(y0 + amp * Math.sin((x / W) * Math.PI * 2.4 + ph)).toFixed(2)}`;
          return <Path key={i} d={d} stroke={i % 3 === 0 ? c2 : '#ffffff'} strokeOpacity={0.12 + (i / 14) * 0.45} strokeWidth={i % 3 === 0 ? 1.4 : 0.8} fill="none" />;
        })}
      </>
    );
  }
  if (style === 'grid') {
    const step = 18;
    const curve = Array.from({ length: 120 }, (_, i) => {
      const x = (i / 119) * W;
      const y = H * 0.82 - Math.exp(-((x - W * 0.62) ** 2) / (2 * (W * 0.12) ** 2)) * H * 0.3;
      return `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
    return (
      <>
        {Array.from({ length: Math.ceil(W / step) + 1 }).map((_, i) => (
          <Line key={`v${i}`} x1={i * step} y1={0} x2={i * step} y2={H} stroke="#ffffff" strokeOpacity={i % 5 === 0 ? 0.13 : 0.05} strokeWidth={0.6} />
        ))}
        {Array.from({ length: Math.ceil(H / step) + 1 }).map((_, i) => (
          <Line key={`h${i}`} x1={0} y1={i * step} x2={W} y2={i * step} stroke="#ffffff" strokeOpacity={i % 5 === 0 ? 0.13 : 0.05} strokeWidth={0.6} />
        ))}
        <Path d={`${curve} L ${W} ${H * 0.82} L 0 ${H * 0.82} Z`} fill={c2} fillOpacity={0.14} />
        <Path d={curve} stroke={c2} strokeWidth={2} fill="none" />
        <Line x1={0} y1={H * 0.82} x2={W} y2={H * 0.82} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.8} />
      </>
    );
  }
  // gradient (default)
  return (
    <>
      <Circle cx={W * 0.95} cy={H * 0.08} r={W * 0.42} fill={c1} fillOpacity={0.55} />
      <Circle cx={W * 0.78} cy={H * 0.02} r={W * 0.22} fill={c2} fillOpacity={0.35} />
      <Circle cx={W * 0.05} cy={H * 0.98} r={W * 0.3} fill={c1} fillOpacity={0.25} />
      <Path d={`M 0 ${H * 0.72} C ${W * 0.3} ${H * 0.64} ${W * 0.6} ${H * 0.8} ${W} ${H * 0.7} L ${W} ${H} L 0 ${H} Z`} fill="#ffffff" fillOpacity={0.05} />
      <Path d={`M 0 ${H * 0.78} C ${W * 0.35} ${H * 0.7} ${W * 0.65} ${H * 0.86} ${W} ${H * 0.76}`} stroke={c2} strokeWidth={1.2} strokeOpacity={0.6} fill="none" />
      {Array.from({ length: 6 }).map((_, r) => Array.from({ length: 6 }).map((__, c) => <Circle key={`${r}-${c}`} cx={54 + c * 12} cy={60 + r * 12} r={1.3} fill="#ffffff" fillOpacity={0.35} />))}
    </>
  );
}

function Cover({ doc, ctx, size }: { doc: DocSpec; ctx: Ctx; size: [number, number] }) {
  const { theme } = ctx;
  const [W, H] = size;
  const m = doc.meta;
  const style = m.coverStyle ?? (ctx.academic ? 'minimal' : 'gradient');
  if (style === 'minimal') {
    return (
      <Page size={[W, H]} style={{ backgroundColor: ctx.paper, fontFamily: ctx.font, color: grade(theme.text) as string }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 14, backgroundColor: theme.primary }} />
        <View style={{ position: 'absolute', left: 14, top: 0, bottom: 0, width: 4, backgroundColor: theme.accent }} />
        <View style={{ position: 'absolute', left: 64, right: 54, top: H * 0.3 }}>
          {m.kicker ? <Text style={{ fontSize: 9, letterSpacing: 2, fontWeight: 700, color: theme.primary, marginBottom: 14 }}>{m.kicker.toUpperCase()}</Text> : null}
          <Text style={{ fontSize: W < 500 ? 26 : 34, fontWeight: 700, lineHeight: 1.15, color: theme.primaryDark }}>{m.title}</Text>
          <View style={{ width: 60, height: 2, backgroundColor: theme.primary, marginTop: 18 }} />
          {m.subtitle ? <Text style={{ fontSize: W < 500 ? 12 : 14, lineHeight: 1.5, marginTop: 16, color: theme.muted }}>{m.subtitle}</Text> : null}
        </View>
        <View style={{ position: 'absolute', left: 64, right: 54, bottom: 60 }}>
          {m.author ? <Text style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>{m.author}</Text> : null}
          {m.date ? <Text style={{ fontSize: 10, color: theme.muted, marginTop: 4 }}>{m.date}</Text> : null}
        </View>
      </Page>
    );
  }
  return (
    <Page size={[W, H]} style={{ backgroundColor: grade(theme.coverBg) as string, fontFamily: ctx.font, color: grade(theme.coverText) as string }}>
      <Svg width={W} height={H - 1} style={{ position: 'absolute', left: 0, top: 0 }}>
        <CoverArt style={style} theme={theme} W={W} H={H} />
      </Svg>
      <View style={{ position: 'absolute', left: 54, right: style === 'orbits' ? 120 : 54, top: H * (style === 'waves' || style === 'grid' ? 0.2 : 0.4) }}>
        {m.kicker ? (
          <Text style={{ fontSize: 8.5, letterSpacing: 2.2, fontWeight: 700, color: theme.accent, marginBottom: 14 }}>{m.kicker.toUpperCase()}</Text>
        ) : (
          <View style={{ flexDirection: 'row', marginBottom: 18 }}>
            <View style={{ width: 44, height: 4, backgroundColor: theme.accent, borderRadius: 2 }} />
          </View>
        )}
        <Text style={{ fontSize: W < 500 ? 26 : 34, fontWeight: 800, lineHeight: 1.15, color: theme.coverText }}>{m.title}</Text>
        {m.subtitle ? <Text style={{ fontSize: W < 500 ? 12 : 14.5, lineHeight: 1.45, marginTop: 14, color: tint(theme.coverBg, 0.75) }}>{m.subtitle}</Text> : null}
      </View>
      <View style={{ position: 'absolute', left: 54, right: 54, bottom: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          {m.author ? (
            <>
              <Text style={{ fontSize: 7.5, letterSpacing: 1.2, color: tint(theme.coverBg, 0.6), fontWeight: 700 }}>PREPARED BY</Text>
              <Text style={{ fontSize: 11.5, fontWeight: 700, marginTop: 3, color: theme.coverText }}>{m.author}</Text>
            </>
          ) : null}
        </View>
        {m.date ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7.5, letterSpacing: 1.2, color: tint(theme.coverBg, 0.6), fontWeight: 700 }}>DATE</Text>
            <Text style={{ fontSize: 11.5, fontWeight: 700, marginTop: 3, color: theme.coverText }}>{m.date}</Text>
          </View>
        ) : null}
      </View>
    </Page>
  );
}

function Toc({ doc, ctx }: { doc: DocSpec; ctx: Ctx }) {
  const { theme } = ctx;
  const heads = doc.blocks.filter((b): b is Extract<Block, { type: 'heading' }> => b.type === 'heading' && b.level <= 2);
  if (!heads.length) return null;
  return (
    <View break={false} style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 21, fontWeight: 700, color: theme.primaryDark, letterSpacing: -0.2 }}>Contents</Text>
      {ctx.vivid ? (
        <View style={{ flexDirection: 'row', marginTop: 6, marginBottom: 16 }}>
          <View style={{ width: 36, height: 3, backgroundColor: theme.primary, borderRadius: 2 }} />
          <View style={{ width: 10, height: 3, backgroundColor: theme.accent, borderRadius: 2, marginLeft: 3 }} />
        </View>
      ) : (
        <View style={{ width: 28, height: 1.6, backgroundColor: theme.primary, borderRadius: 1, marginTop: 7, marginBottom: 18, opacity: 0.8 }} />
      )}
      {heads.map((h) => {
        const page = ctx.knownPages?.[h.id];
        const num = ctx.headingNums[h.id];
        const top = h.level === 1;
        return (
          <Link key={h.id} src={`#${h.id}`} style={{ textDecoration: 'none' }}>
            <View
              wrap={false}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                marginLeft: top ? 0 : 18,
                paddingVertical: top ? 5 : 3,
                borderBottomWidth: top ? 0.6 : 0,
                borderBottomColor: theme.border,
              }}
            >
              {num ? <Text style={{ width: top ? 22 : 30, fontSize: top ? 10.5 : 9.5, fontWeight: 700, color: theme.primary }}>{num}</Text> : null}
              <Text style={{ flex: 1, fontSize: top ? 10.5 : 9.5, fontWeight: top ? 700 : 400, color: top ? theme.text : theme.muted }}>{tokenizeInline(h.text).map((t) => t.text).join('')}</Text>
              <Text style={{ width: 30, textAlign: 'right', fontSize: top ? 10.5 : 9.5, fontWeight: top ? 700 : 400, color: top ? theme.text : theme.muted }}>{page ?? ''}</Text>
            </View>
          </Link>
        );
      })}
    </View>
  );
}

// Keep headings together with an unbreakable visual that follows them.
const ATOMIC = new Set(['diagram', 'chart', 'image', 'kpis', 'callout', 'quote', 'columns', 'signature', 'equation', 'plot', 'figure']);
const atomic = (x: Block) => ATOMIC.has(x.type) && !(x.type === 'figure' && x.side);
const SIDE_OK = new Set(['paragraph', 'list', 'box', 'equation', 'steps']);
function groupBlocks(blocks: Block[]): Block[][] {
  const out: Block[][] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    const isSide = (x?: Block) => !!x && x.type === 'figure' && !!x.side;
    if ((b.type === 'figure' && b.side && next && SIDE_OK.has(next.type)) || (b.type === 'heading' && isSide(next) && blocks[i + 2] && SIDE_OK.has(blocks[i + 2].type))) {
      // figure beside up to three following text blocks (optionally led by its heading)
      const g: Block[] = b.type === 'heading' ? [b, blocks[++i]] : [b];
      const f = g[g.length - 1] as Extract<Block, { type: 'figure' }>;
      const cap = g.length + Math.max(1, Math.min(3, Math.round(f.beside ?? 1)));
      while (g.length < cap && blocks[i + 1] && SIDE_OK.has(blocks[i + 1].type)) g.push(blocks[++i]);
      out.push(g);
    } else if (b.type === 'heading' && next && atomic(next)) {
      out.push([b, next]);
      i++;
    } else if (b.type === 'heading' && next?.type === 'box' && boxContentLength(next) < 700) {
      out.push([b, next]);
      i++;
    } else if (b.type === 'paragraph' && next?.type === 'equation' && b.text.length < 220 && blocks[i - 1]?.type !== 'heading') {
      out.push([b, next]);
      i++;
    } else out.push([b]);
  }
  return out;
}

// A figure set beside the text that follows it, like a textbook margin figure.
function SideFigure({ g, ctx }: { g: Block[]; ctx: Ctx }) {
  const f = g[0] as Extract<Block, { type: 'figure' }>;
  const gap = 18;
  const figW = Math.round(ctx.contentW * Math.min(0.55, Math.max(0.28, (f.scale ?? 42) / 100)));
  const textW = ctx.contentW - figW - gap;
  const scene = layoutFigure({ ...f, scale: 100 }, ctx.theme, figW, ctx.contentH * 0.5, !ctx.vivid);
  const figCol = (
    <View style={{ width: figW, alignItems: 'center' }}>
      <FigureCard ctx={ctx}>
        <SceneView scene={scene} font={ctx.font} rich={rich(ctx)} />
      </FigureCard>
      <Caption text={f.caption} ctx={{ ...ctx, contentW: figW }} />
    </View>
  );
  const tctx: Ctx = { ...ctx, contentW: textW };
  const textCol = (
    <View style={{ width: textW }}>
      {g.slice(1).map((b) => (
        <BlockView key={b.id} b={b} ctx={tctx} />
      ))}
    </View>
  );
  return (
    <View wrap={false} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6, justifyContent: 'space-between' }}>
      {f.side === 'left' ? figCol : textCol}
      {f.side === 'left' ? textCol : figCol}
    </View>
  );
}

// --------------------------------------------------------------- document
export interface RenderOpts {
  assets: Record<string, Asset>;
  pageMap?: PageMap;
  knownPages?: PageMap;
}

// Some subset fonts ship broken empty glyphs for U+2002/U+2009/U+200B (fontkit crashes on them).
const BAD_SPACES = /[\u2002\u2009\u200B\uFEFF]/g;
function sanitize<T>(v: T): T {
  if (typeof v === 'string') return v.replace(BAD_SPACES, (c) => (c === '\u2002' ? '\u2000' : c === '\u2009' ? '\u2006' : '')) as T;
  if (Array.isArray(v)) return v.map(sanitize) as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = k === 'dataUrl' || k === 'src' ? x : sanitize(x);
    return o as T;
  }
  return v;
}

export function PdfDocument({ doc: rawDoc, opts }: { doc: DocSpec; opts: RenderOpts }) {
  const doc = sanitize(rawDoc);
  const m = doc.meta;
  const masterclass = /MASTERCLASS EDITION/i.test(m.kicker ?? '');
  const theme = THEMES[m.theme] ?? THEMES.ink;
  const font = FAMILY[m.font] ?? FAMILY.sans;
  const base = PAGE_DIMS[m.pageSize] ?? PAGE_DIMS.A4;
  const size: [number, number] = m.orientation === 'landscape' ? [base[1], base[0]] : base;
  setGrade(m.paper, m.colors);
  const paper = paperColor(m.paper);
  const vivid = m.colors === 'vivid';
  const dens = DENSITY[m.density ?? 'comfortable'] ?? DENSITY.comfortable;
  const PX = size[0] < 500 ? Math.round(dens.px * 0.72) : dens.px;
  const PT = dens.py;
  const PB = dens.py;
  // heading numbers
  const headingNums: Record<string, string> = {};
  let h1 = 0;
  let h2 = 0;
  for (const b of doc.blocks) {
    if (b.type !== 'heading') continue;
    if (b.level === 1) {
      h1++;
      h2 = 0;
      headingNums[b.id] = `${h1}.`;
    } else if (b.level === 2) {
      if (h1 === 0) h1 = 1;
      h2++;
      headingNums[b.id] = `${h1}.${h2}`;
    }
  }
  const minimal = m.style === 'minimal';
  const academic = m.style === 'academic' || minimal;
  // Book-style paragraphing for serif academic text: consecutive paragraphs
  // sit close together and the second one gets a first-line indent.
  const indent = new Set<string>();
  const tight = new Set<string>();
  if (academic && m.font === 'serif') {
    doc.blocks.forEach((b, i) => {
      const nx = doc.blocks[i + 1];
      const isP = (x?: Block) => !!x && x.type === 'paragraph' && !x.lead && (x.align ?? 'left') !== 'center';
      if (isP(b) && isP(nx)) {
        tight.add(b.id);
        indent.add(nx!.id);
      }
    });
  }
  const ctx: Ctx = {
    minimal,
    vivid,
    paper,
    ty: { body: dens.body, lh: dens.lh, para: dens.para, k: dens.k },
    indent,
    tight,
    theme,
    font,
    academic,
    eq: { n: 0 },
    boxes: {},
    contentW: size[0] - PX * 2,
    contentH: size[1] - PT - PB,
    assets: opts.assets,
    pageMap: opts.pageMap,
    knownPages: opts.knownPages,
    figure: { n: 0 },
    table: { n: 0 },
    headingNums,
    numbered: !!m.numberedHeadings,
  };
  const headerText = m.header ?? (m.cover ? m.title : '');
  return (
    <Document title={m.title} author={m.author} subject={m.subtitle} creator="Fluent PDF Studio" producer="Fluent PDF Studio">
      {m.cover ? <Cover doc={doc} ctx={ctx} size={size} /> : null}
      <Page size={size} style={{ paddingTop: PT, paddingBottom: PB, paddingHorizontal: PX, fontFamily: font, color: grade(theme.text) as string, fontSize: dens.body, lineHeight: dens.lh, backgroundColor: paper }}>
        {/* page chrome */}
        {academic ? (
          <>
            {headerText ? (
              <View fixed style={{ position: 'absolute', top: 26, left: PX, right: PX, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.4, borderBottomColor: theme.border, paddingBottom: 4 }}>
                <Text style={{ fontSize: 8, color: theme.muted, fontStyle: 'italic' }}>{headerText}</Text>
                <Text style={{ fontSize: 8, color: theme.muted }}>{m.author ?? m.date ?? ''}</Text>
              </View>
            ) : null}
            <View fixed style={{ position: 'absolute', bottom: 26, left: PX, right: PX, flexDirection: 'row', justifyContent: 'center' }}>
              {m.footer ? <Text style={{ fontSize: 8, color: theme.muted, position: 'absolute', left: 0 }}>{m.footer}</Text> : null}
              {m.pageNumbers ? <Text style={{ fontSize: 9, color: theme.text }} render={({ pageNumber }) => `${pageNumber}`} /> : null}
            </View>
          </>
        ) : (
          <>
            {vivid ? (
              <>
                <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: theme.primary }} />
                <View fixed style={{ position: 'absolute', top: 0, left: 0, width: size[0] * 0.28, height: 5, backgroundColor: theme.accent }} />
              </>
            ) : (
              <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, backgroundColor: theme.primary, opacity: 0.85 }} />
            )}
            {headerText ? (
              <View fixed style={{ position: 'absolute', top: 22, left: PX, right: PX, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.6, borderBottomColor: theme.border, paddingBottom: 6 }}>
                <Text style={{ fontSize: 7.8, color: theme.muted, fontWeight: 600 }}>{headerText}</Text>
                <Text style={{ fontSize: 7.8, color: theme.muted }}>{m.date ?? ''}</Text>
              </View>
            ) : null}
            <View fixed style={{ position: 'absolute', bottom: 24, left: PX, right: PX, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 7.8, color: theme.muted }}>{m.footer ?? ''}</Text>
              {m.pageNumbers ? (
                <Text style={{ fontSize: 7.8, color: theme.muted, fontWeight: 600 }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
              ) : null}
            </View>
          </>
        )}

        {/* title block when there is no cover */}
        {!m.cover && minimal ? (
          <View style={{ marginBottom: 22 * dens.k }}>
            {m.kicker ? <Text style={{ fontSize: 8, letterSpacing: 1.6, color: theme.muted, fontWeight: 600, marginBottom: 10 }}>{m.kicker.toUpperCase()}</Text> : null}
            <Text style={{ fontSize: size[0] < 500 ? 21 : 24, fontWeight: 600, color: theme.text, lineHeight: 1.22, letterSpacing: -0.3 }}>{m.title}</Text>
            {m.subtitle ? <Text style={{ fontSize: 12, color: theme.muted, marginTop: 7, lineHeight: 1.45 }}>{m.subtitle}</Text> : null}
            {m.author || m.date ? (
              <Text style={{ fontSize: 9, color: theme.muted, marginTop: 12 }}>
                {[m.author, m.date].filter(Boolean).join('   ·   ')}
              </Text>
            ) : null}
            <View style={{ height: 0.6, backgroundColor: theme.border, marginTop: 16 }} />
          </View>
        ) : null}
        {!m.cover && academic && !minimal ? (
          <View style={{ marginBottom: masterclass ? 20 : 14, paddingTop: masterclass ? 10 : 0, paddingBottom: masterclass ? 12 : 0, alignItems: 'center', borderTopWidth: masterclass ? 1.4 : 0, borderTopColor: theme.primary }}>
            {masterclass ? (
              <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 22 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 32, height: 32, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>IAP</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 8.2, color: theme.text, fontWeight: 700, letterSpacing: 1.25 }}>INSTITUTE OF ADVANCED PHYSICS</Text>
                    <Text style={{ fontSize: 6.8, color: theme.muted, letterSpacing: 0.8, marginTop: 3 }}>COLLEGIATE STUDIES IN NATURAL PHILOSOPHY</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 7, color: theme.primary, fontWeight: 700, letterSpacing: 1 }}>MONOGRAPH 01</Text>
                  <Text style={{ fontSize: 6.5, color: theme.muted, marginTop: 3 }}>MASTERCLASS SERIES</Text>
                </View>
              </View>
            ) : null}
            {m.kicker ? <Text style={{ fontSize: masterclass ? 8.5 : 8, letterSpacing: masterclass ? 2.2 : 1.8, color: theme.primary, fontWeight: 700, marginBottom: masterclass ? 14 : 8 }}>{m.kicker.toUpperCase()}</Text> : null}
            <Text style={{ fontSize: masterclass ? (size[0] < 500 ? 24 : 29) : size[0] < 500 ? 19 : 22, fontWeight: masterclass ? 500 : 600, color: theme.text, lineHeight: masterclass ? 1.16 : 1.25, textAlign: 'center', letterSpacing: masterclass ? -0.45 : -0.2 }}>{m.title}</Text>
            {m.subtitle ? <Text style={{ maxWidth: masterclass ? '82%' : '100%', fontSize: masterclass ? 12 : 11.5, color: theme.muted, marginTop: masterclass ? 10 : 6, lineHeight: 1.4, textAlign: 'center', fontStyle: 'italic' }}>{m.subtitle}</Text> : null}
            {m.author ? <Text style={{ fontSize: 11, color: theme.text, marginTop: 10 }}>{m.author}</Text> : null}
            {m.date ? <Text style={{ fontSize: 9.5, color: theme.muted, marginTop: 3 }}>{m.date}</Text> : null}
            <View style={{ alignSelf: 'stretch', height: 0.5, backgroundColor: vivid ? theme.text : theme.border, marginTop: 16 }} />
          </View>
        ) : null}
        {!m.cover && !academic ? (
          <View style={{ marginBottom: 16 }}>
            {m.kicker ? (
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <Text style={{ fontSize: 7.8, letterSpacing: 1.6, color: theme.primary, fontWeight: 800, backgroundColor: theme.soft, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 }}>{m.kicker.toUpperCase()}</Text>
              </View>
            ) : null}
            <Text style={{ fontSize: size[0] < 500 ? 22 : 27, fontWeight: 700, color: theme.primaryDark, lineHeight: 1.2, letterSpacing: -0.3 }}>{m.title}</Text>
            {m.subtitle ? <Text style={{ fontSize: 12, color: theme.muted, marginTop: 6, lineHeight: 1.45 }}>{m.subtitle}</Text> : null}
            {m.author || m.date ? (
              <View style={{ flexDirection: 'row', marginTop: 10, alignItems: 'center' }}>
                {m.author ? (
                  <View style={{ backgroundColor: theme.soft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6 }}>
                    <Text style={{ fontSize: 8, color: theme.primaryDark, fontWeight: 700 }}>{m.author}</Text>
                  </View>
                ) : null}
                {m.date ? <Text style={{ fontSize: 8.5, color: theme.muted }}>{m.date}</Text> : null}
              </View>
            ) : null}
            <View style={{ height: 1, backgroundColor: theme.border, marginTop: 14 }} />
          </View>
        ) : null}

        {m.toc ? (
          <>
            <Toc doc={doc} ctx={ctx} />
            <View break />
          </>
        ) : null}

        {groupBlocks(doc.blocks).map((g) =>
          g[0].type === 'figure' && g[0].side && g.length > 1 ? (
            <SideFigure key={g[0].id} g={g} ctx={ctx} />
          ) : g[0].type === 'heading' && g[1]?.type === 'figure' && g[1].side ? (
            <View key={g[0].id} wrap={false}>
              <BlockView b={g[0]} ctx={ctx} />
              <SideFigure g={g.slice(1)} ctx={ctx} />
            </View>
          ) : g.length === 1 ? (
            <BlockView key={g[0].id} b={g[0]} ctx={ctx} />
          ) : (
            <View key={g[0].id} wrap={false}>
              {g.map((b) => (
                <BlockView key={b.id} b={b} ctx={ctx} />
              ))}
            </View>
          ),
        )}
      </Page>
    </Document>
  );
}

export { BlockView };
