import { Document, Image, Link, Page, Path, Polygon, Rect, Circle, Svg, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { Style } from '@react-pdf/types';
import type { Asset, Block, DocSpec, ListBlock, TableBlock } from '../types';
import { THEMES, TONES, type PdfTheme } from '../themes';
import { FAMILY, MONO } from './fonts';
import { tokenizeInline } from '../inline';
import { layoutDiagram } from './diagramLayout';
import { layoutChart } from './chartLayout';
import { scaleScene, tint, shade } from './scene';
import { SceneView } from './SceneView';

export const PAGE_DIMS: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  LETTER: [612, 792],
  LEGAL: [612, 1008],
  A5: [419.53, 595.28],
};

export type PageMap = Record<string, number>;

interface Ctx {
  theme: PdfTheme;
  font: string;
  contentW: number;
  contentH: number;
  assets: Record<string, Asset>;
  pageMap?: PageMap; // filled during rendering
  knownPages?: PageMap; // from the previous pass
  figure: { n: number };
  table: { n: number };
  headingNums: Record<string, string>;
  numbered: boolean;
}

// ------------------------------------------------------------------ inline
function Inline({ text, ctx, color }: { text: string; ctx: Ctx; color?: string }) {
  const toks = tokenizeInline(String(text ?? ''));
  return (
    <>
      {toks.map((t, i) => {
        const style: Style = {};
        if (t.bold) style.fontWeight = 700;
        if (t.italic) style.fontStyle = 'italic';
        if (t.strike) style.textDecoration = 'line-through';
        if (t.code) {
          style.fontFamily = MONO;
          style.backgroundColor = tint(ctx.theme.primary, 0.9);
          style.color = shade(ctx.theme.primary, 0.35);
        }
        if (t.mark) style.backgroundColor = '#fef08a';
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
  if (b.level === 1)
    return (
      <View id={b.id} minPresenceAhead={80} style={{ marginTop: 20, marginBottom: 10 }}>
        {tracker}
        <Text style={{ fontSize: 20, fontWeight: 800, color: theme.primaryDark, lineHeight: 1.25 }}>
          {num ? <Text style={{ color: theme.primary }}>{num}  </Text> : null}
          <Inline text={b.text} ctx={ctx} />
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          <View style={{ width: 36, height: 3, backgroundColor: theme.primary, borderRadius: 2 }} />
          <View style={{ width: 10, height: 3, backgroundColor: theme.accent, borderRadius: 2, marginLeft: 3 }} />
        </View>
      </View>
    );
  if (b.level === 2)
    return (
      <View id={b.id} minPresenceAhead={60} style={{ marginTop: 14, marginBottom: 6 }}>
        {tracker}
        <Text style={{ fontSize: 14, fontWeight: 700, color: theme.text, lineHeight: 1.3 }}>
          {num ? <Text style={{ color: theme.primary }}>{num}  </Text> : null}
          <Inline text={b.text} ctx={ctx} />
        </Text>
      </View>
    );
  return (
    <View id={b.id} minPresenceAhead={50} style={{ marginTop: 10, marginBottom: 4 }}>
      {tracker}
      <Text style={{ fontSize: 11.5, fontWeight: 700, color: theme.primary, lineHeight: 1.3 }}>
        <Inline text={b.text} ctx={ctx} />
      </Text>
    </View>
  );
}

function ListView({ b, ctx }: { b: ListBlock; ctx: Ctx }) {
  const { theme } = ctx;
  const counters: number[] = [];
  return (
    <View style={{ marginBottom: 8, marginTop: 2 }}>
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
          marker = <Text style={{ fontSize: 10, fontWeight: 700, color: theme.primary, lineHeight: 1.55 }}>{label}.</Text>;
        } else {
          marker =
            depth === 0 ? (
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: theme.primary, marginTop: 5.5 }} />
            ) : (
              <View style={{ width: 5, height: 5, borderRadius: 3, borderWidth: 1, borderColor: theme.primary, marginTop: 5.5 }} />
            );
        }
        return (
          <View key={i} wrap={false} style={{ flexDirection: 'row', marginLeft: depth * 16, marginBottom: 3.5 }}>
            <View style={{ width: b.ordered ? 18 : 14, alignItems: b.ordered ? 'flex-start' : 'flex-start' }}>{marker}</View>
            <Text style={{ flex: 1, fontSize: 10.5, lineHeight: 1.55, color: checked ? theme.muted : theme.text, textDecoration: checked ? 'line-through' : 'none' }}>
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
  return (
    <View style={{ marginVertical: 8 }}>
      <View style={{ borderRadius: 6, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
        {headers.length ? (
          <View style={{ flexDirection: 'row', backgroundColor: theme.primary }} wrap={false}>
            {Array.from({ length: cols }, (_, c) => (
              <Text
                key={c}
                style={{
                  width: `${(weights[c] / total) * 100}%`,
                  paddingVertical: 6,
                  paddingHorizontal: 7,
                  fontSize: 8.8,
                  fontWeight: 700,
                  color: '#ffffff',
                  textAlign: alignFor(c, String(rows[0]?.[c] ?? '')),
                }}
              >
                {headers[c] ?? ''}
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
                backgroundColor: isTotal ? theme.soft : b.striped !== false && ri % 2 === 1 ? theme.softer : '#ffffff',
                borderTopWidth: ri === 0 && headers.length ? 0 : isTotal ? 1.2 : 0.6,
                borderTopColor: isTotal ? theme.primary : theme.border,
              }}
            >
              {Array.from({ length: cols }, (_, c) => (
                <Text
                  key={c}
                  style={{
                    width: `${(weights[c] / total) * 100}%`,
                    paddingVertical: 5,
                    paddingHorizontal: 7,
                    fontSize: 9,
                    lineHeight: 1.4,
                    color: theme.text,
                    fontWeight: isTotal || (c === 0 && cols > 2) ? 600 : 400,
                    textAlign: alignFor(c, String(r[c] ?? '')),
                  }}
                >
                  <Inline text={String(r[c] ?? '')} ctx={ctx} />
                </Text>
              ))}
            </View>
          );
        })}
      </View>
      {b.caption ? (
        <Text style={{ fontSize: 8.5, color: theme.muted, marginTop: 4, textAlign: 'center' }}>
          <Text style={{ fontWeight: 700, color: theme.primary }}>Table {ctx.table.n}. </Text>
          {b.caption}
        </Text>
      ) : null}
    </View>
  );
}

function Caption({ text, ctx }: { text?: string; ctx: Ctx }) {
  if (!text) return null;
  ctx.figure.n++;
  return (
    <Text style={{ fontSize: 8.5, color: ctx.theme.muted, marginTop: 6, textAlign: 'center' }}>
      <Text style={{ fontWeight: 700, color: ctx.theme.primary }}>Figure {ctx.figure.n}. </Text>
      {text}
    </Text>
  );
}

function FigureCard({ children, ctx }: { children: ReactNode; ctx: Ctx }) {
  return (
    <View style={{ borderWidth: 1, borderColor: ctx.theme.border, borderRadius: 8, padding: 12, backgroundColor: '#ffffff', alignItems: 'center' }}>{children}</View>
  );
}

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

function BlockView({ b, ctx }: { b: Block; ctx: Ctx }): ReactNode {
  const { theme } = ctx;
  switch (b.type) {
    case 'heading':
      return <Heading b={b} ctx={ctx} />;
    case 'paragraph':
      return (
        <Text
          style={{
            fontSize: b.lead ? 12.5 : 10.5,
            lineHeight: b.lead ? 1.55 : 1.6,
            color: b.lead ? shade(theme.muted, 0.15) : theme.text,
            textAlign: b.align ?? 'left',
            marginBottom: b.lead ? 12 : 8,
          }}
        >
          <Inline text={b.text} ctx={ctx} />
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
      let scene0 = layoutDiagram(b, theme);
      let k = Math.min(maxW / scene0.width, maxH / scene0.height, 1.1);
      if (b.kind === 'flowchart' && k < 0.68) {
        // too cramped: try the other direction and keep whichever reads better
        const alt = layoutDiagram({ ...b, direction: b.direction === 'LR' ? 'TB' : 'LR' }, theme);
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
            <SceneView scene={scene} font={ctx.font} />
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
            <SceneView scene={scene} font={ctx.font} />
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
                  <Inline text={it.title} ctx={ctx} />
                </Text>
                {it.text ? (
                  <Text style={{ fontSize: 9.5, lineHeight: 1.5, color: theme.muted, marginTop: 2 }}>
                    <Inline text={it.text} ctx={ctx} />
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
              <Inline text={b.text} ctx={ctx} />
            </Text>
            {b.author ? <Text style={{ fontSize: 9.5, fontWeight: 700, color: theme.primary, marginTop: 6 }}>— {b.author}</Text> : null}
          </View>
        </View>
      );
    case 'callout': {
      const t = TONES[b.tone] ?? TONES.info;
      return (
        <View wrap={false} style={{ marginVertical: 8, flexDirection: 'row', backgroundColor: t.bg, borderLeftWidth: 3, borderLeftColor: t.border, borderRadius: 6, padding: 11 }}>
          <View style={{ marginRight: 9, marginTop: 0.5 }}>
            <ToneIcon tone={b.tone in TONES ? b.tone : 'info'} color={t.border} />
          </View>
          <View style={{ flex: 1 }}>
            {b.title ? <Text style={{ fontSize: 10.5, fontWeight: 700, color: t.title, marginBottom: 2 }}>{b.title}</Text> : null}
            <Text style={{ fontSize: 9.8, lineHeight: 1.5, color: '#1f2937' }}>
              <Inline text={b.text} ctx={ctx} />
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
              <View key={i} style={{ flex: 1, marginHorizontal: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: '#ffffff', padding: 10, borderTopWidth: 3, borderTopColor: theme.palette[i % theme.palette.length] }}>
                <Text style={{ fontSize: 7.8, fontWeight: 700, color: theme.muted, letterSpacing: 0.5 }}>{String(it.label ?? '').toUpperCase()}</Text>
                <Text style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginTop: 4 }}>{it.value}</Text>
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
                <Inline text={c.text} ctx={ctx} />
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
    case 'divider':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12 }}>
          <View style={{ flex: 1, height: 0.8, backgroundColor: theme.border }} />
          <View style={{ width: 5, height: 5, backgroundColor: theme.primary, transform: 'rotate(45deg)', marginHorizontal: 8 }} />
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
function Cover({ doc, ctx, size }: { doc: DocSpec; ctx: Ctx; size: [number, number] }) {
  const { theme } = ctx;
  const [W, H] = size;
  const m = doc.meta;
  return (
    <Page size={[W, H]} style={{ backgroundColor: theme.coverBg, fontFamily: ctx.font, color: theme.coverText }}>
      <Svg width={W} height={H - 1} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Circle cx={W * 0.95} cy={H * 0.08} r={W * 0.42} fill={theme.primary} fillOpacity={0.55} />
        <Circle cx={W * 0.78} cy={H * 0.02} r={W * 0.22} fill={theme.accent} fillOpacity={0.35} />
        <Circle cx={W * 0.05} cy={H * 0.98} r={W * 0.3} fill={theme.primary} fillOpacity={0.25} />
        <Path d={`M 0 ${H * 0.72} C ${W * 0.3} ${H * 0.64} ${W * 0.6} ${H * 0.8} ${W} ${H * 0.7} L ${W} ${H} L 0 ${H} Z`} fill="#ffffff" fillOpacity={0.05} />
        <Path d={`M 0 ${H * 0.78} C ${W * 0.35} ${H * 0.7} ${W * 0.65} ${H * 0.86} ${W} ${H * 0.76}`} stroke={theme.accent} strokeWidth={1.2} strokeOpacity={0.6} fill="none" />
        {Array.from({ length: 6 }).map((_, r) =>
          Array.from({ length: 6 }).map((__, c) => <Circle key={`${r}-${c}`} cx={54 + c * 12} cy={60 + r * 12} r={1.3} fill="#ffffff" fillOpacity={0.35} />),
        )}
      </Svg>
      <View style={{ position: 'absolute', left: 54, right: 54, top: H * 0.34 }}>
        <View style={{ flexDirection: 'row', marginBottom: 18 }}>
          <View style={{ width: 44, height: 4, backgroundColor: theme.accent, borderRadius: 2 }} />
        </View>
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
      <Text style={{ fontSize: 22, fontWeight: 800, color: theme.primaryDark }}>Contents</Text>
      <View style={{ flexDirection: 'row', marginTop: 6, marginBottom: 16 }}>
        <View style={{ width: 36, height: 3, backgroundColor: theme.primary, borderRadius: 2 }} />
        <View style={{ width: 10, height: 3, backgroundColor: theme.accent, borderRadius: 2, marginLeft: 3 }} />
      </View>
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
const ATOMIC = new Set(['diagram', 'chart', 'image', 'kpis', 'callout', 'quote', 'columns', 'signature']);
function groupBlocks(blocks: Block[]): Block[][] {
  const out: Block[][] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    if (b.type === 'heading' && next && ATOMIC.has(next.type)) {
      out.push([b, next]);
      i++;
    } else if (b.type === 'heading' && next?.type === 'paragraph' && blocks[i + 2] && ATOMIC.has(blocks[i + 2].type) && next.text.length < 260) {
      out.push([b, next, blocks[i + 2]]);
      i += 2;
    } else out.push([b]);
  }
  return out;
}

// --------------------------------------------------------------- document
export interface RenderOpts {
  assets: Record<string, Asset>;
  pageMap?: PageMap;
  knownPages?: PageMap;
}

export function PdfDocument({ doc, opts }: { doc: DocSpec; opts: RenderOpts }) {
  const m = doc.meta;
  const theme = THEMES[m.theme] ?? THEMES.ocean;
  const font = FAMILY[m.font] ?? FAMILY.sans;
  const base = PAGE_DIMS[m.pageSize] ?? PAGE_DIMS.A4;
  const size: [number, number] = m.orientation === 'landscape' ? [base[1], base[0]] : base;
  const PX = size[0] < 500 ? 40 : 54;
  const PT = 58;
  const PB = 58;
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
  const ctx: Ctx = {
    theme,
    font,
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
      <Page size={size} style={{ paddingTop: PT, paddingBottom: PB, paddingHorizontal: PX, fontFamily: font, color: theme.text, fontSize: 10.5 }}>
        {/* page chrome */}
        <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: theme.primary }} />
        <View fixed style={{ position: 'absolute', top: 0, left: 0, width: size[0] * 0.28, height: 5, backgroundColor: theme.accent }} />
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

        {/* title block when there is no cover */}
        {!m.cover ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: size[0] < 500 ? 22 : 27, fontWeight: 800, color: theme.primaryDark, lineHeight: 1.2 }}>{m.title}</Text>
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
          g.length === 1 ? (
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
