// TeX → vector paths via MathJax (SVG output, no font cache) → a plain tree that
// MathSvg renders with react-pdf primitives. Works in node and in the browser/worker.
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';

export interface MathNode {
  tag: 'g' | 'path' | 'rect' | 'line';
  attrs: Record<string, string>;
  children?: MathNode[];
}
export interface MathTree {
  vb: [number, number, number, number];
  nodes: MathNode[];
}

type Doc = { convert: (tex: string, opts: Record<string, unknown>) => unknown };
let doc: Doc | null = null;
let adaptor: ReturnType<typeof liteAdaptor> | null = null;

function init() {
  if (doc) return doc;
  adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const packages = AllPackages.filter((p: string) => !['bussproofs', 'autoload', 'require', 'setoptions'].includes(p));
  const tex = new TeX({
    packages,
    formatError: (_jax: unknown, err: Error) => {
      throw err;
    },
  });
  const svg = new SVG({ fontCache: 'none' });
  doc = mathjax.document('', { InputJax: tex, OutputJax: svg }) as unknown as Doc;
  return doc;
}

const KEEP = new Set(['transform', 'd', 'x', 'y', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'x1', 'y1', 'x2', 'y2', 'stroke-dasharray']);
type LiteNode = unknown;

function walk(node: LiteNode): MathNode[] {
  const a = adaptor!;
  const kids = (a.childNodes(node as never) ?? []) as LiteNode[];
  const out: MathNode[] = [];
  for (const k of kids) {
    const kind = a.kind(k as never);
    if (kind !== 'g' && kind !== 'path' && kind !== 'rect' && kind !== 'line' && kind !== 'svg') continue;
    const attrs: Record<string, string> = {};
    for (const at of a.allAttributes(k as never) as { name: string; value: string }[]) if (KEEP.has(at.name)) attrs[at.name] = String(at.value);
    if (kind === 'svg') {
      // nested svg (e.g. \cancel, \boxed): flatten by translating to its x/y
      const x = parseFloat(attrs.x ?? '0') || 0;
      const y = parseFloat(attrs.y ?? '0') || 0;
      out.push({ tag: 'g', attrs: { transform: `translate(${x},${y})` }, children: walk(k) });
      continue;
    }
    const node: MathNode = { tag: kind, attrs };
    if (kind === 'g') node.children = walk(k);
    if (kind === 'path' && !attrs.d) continue;
    out.push(node);
  }
  return out;
}

const cache = new Map<string, MathTree | Error>();

/** Returns the vector tree for a display formula, or throws a readable error. */
export function texToTree(tex: string, display = true): MathTree {
  const key = (display ? 'D:' : 'I:') + tex;
  const hit = cache.get(key);
  if (hit instanceof Error) throw hit;
  if (hit) return hit;
  try {
    const d = init();
    const container = d.convert(tex, { display, em: 16, ex: 8, containerWidth: 80 * 16 });
    const a = adaptor!;
    const svg = (a.childNodes(container as never) as LiteNode[]).find((n) => a.kind(n as never) === 'svg');
    if (!svg) throw new Error('MathJax produced no output');
    const vb = String(a.getAttribute(svg as never, 'viewBox') ?? '0 0 1000 1000')
      .split(/[\s,]+/)
      .map(Number) as [number, number, number, number];
    const tree: MathTree = { vb, nodes: walk(svg) };
    if (cache.size > 400) cache.clear();
    cache.set(key, tree);
    return tree;
  } catch (e) {
    const msg = (e as { message?: unknown })?.message;
    const err = new Error(typeof msg === 'string' ? msg : String(e));
    cache.set(key, err);
    throw err;
  }
}
