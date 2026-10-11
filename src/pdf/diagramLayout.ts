import type { DiagramBlock, DiagramEdge, DiagramNode, NodeShape } from '../types';
import type { PdfTheme } from '../themes';
import { type Label, type Scene, type Shape, fmt, isHex, luminance, shade, textWidth, tint, wrapText } from './scene';

const FONT = 9.5;
const LINE_H = FONT * 1.3;

interface Box {
  node: DiagramNode;
  idx: number;
  lines: string[];
  w: number;
  h: number;
  x: number; // center
  y: number; // center
  layer: number;
  order: number;
  color: string;
  shape: NodeShape;
}

export function layoutDiagram(block: DiagramBlock, theme: PdfTheme, natural = true): Scene {
  const nodes = dedupeNodes(block.nodes ?? []);
  if (!nodes.length) return { width: 10, height: 10, shapes: [], labels: [] };
  const ids = new Set(nodes.map((n) => n.id));
  const edges = (block.edges ?? []).filter((e) => ids.has(e.from) && ids.has(e.to));
  switch (block.kind) {
    case 'mindmap':
      return mindmap(nodes, edges, theme);
    case 'sequence':
      return sequence(nodes, edges, theme);
    case 'cycle':
      return cycle(nodes, edges, theme);
    default:
      return flowchart(nodes, edges, block.direction === 'LR' ? 'LR' : 'TB', theme, natural);
  }
}

function dedupeNodes(nodes: DiagramNode[]): DiagramNode[] {
  const seen = new Set<string>();
  const out: DiagramNode[] = [];
  for (const n of nodes) {
    if (!n || n.id == null) continue;
    const id = String(n.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...n, id, label: String(n.label ?? id) });
  }
  return out;
}

function measure(n: DiagramNode, shape: NodeShape) {
  const maxChars = shape === 'diamond' ? 14 : shape === 'circle' ? 12 : 20;
  const lines = wrapText(n.label, maxChars);
  const longest = Math.max(...lines.map((l) => textWidth(l, FONT, true)));
  let w = Math.max(78, Math.min(170, longest + 26));
  let h = Math.max(34, lines.length * LINE_H + 18);
  if (shape === 'diamond') {
    w = Math.max(96, longest * 1.5 + 28);
    h = Math.max(58, lines.length * LINE_H * 1.7 + 26);
  } else if (shape === 'circle') {
    const d = Math.max(56, Math.max(longest + 18, lines.length * LINE_H + 18));
    w = d;
    h = d;
  } else if (shape === 'hexagon' || shape === 'parallelogram') {
    w += 22;
  } else if (shape === 'cylinder') {
    h += 12;
  }
  return { lines, w, h };
}

// ----------------------------------------------------------------- shapes
function drawNode(b: Box, shapes: Shape[], labels: Label[], natural: boolean) {
  const { x, y, w, h, color, shape } = b;
  const x0 = x - w / 2;
  const y0 = y - h / 2;
  // Natural documents use restrained, paper-like tints rather than glossy UI cards.
  const solid = !natural && (shape === 'pill' || shape === 'circle');
  const fill = solid ? color : tint(color, natural ? 0.93 : 0.88);
  const stroke = solid ? shade(color, 0.08) : natural ? tint(color, 0.28) : color;
  const sw = natural ? 0.85 : 1.3;
  const shadow = { fill: '#2c2924', opacity: natural ? 0 : 0.06 };
  switch (shape) {
    case 'diamond': {
      const pts: [number, number][] = [
        [x, y0],
        [x0 + w, y],
        [x, y0 + h],
        [x0, y],
      ];
      shapes.push({ kind: 'polygon', points: pts.map(([a, c]) => [a + 1.5, c + 2] as [number, number]), ...shadow });
      shapes.push({ kind: 'polygon', points: pts, fill, stroke, sw });
      break;
    }
    case 'circle':
      shapes.push({ kind: 'circle', cx: x + 1.5, cy: y + 2, r: w / 2, ...shadow });
      shapes.push({ kind: 'circle', cx: x, cy: y, r: w / 2, fill, stroke, sw });
      break;
    case 'hexagon': {
      const k = 14;
      const pts: [number, number][] = [
        [x0 + k, y0],
        [x0 + w - k, y0],
        [x0 + w, y],
        [x0 + w - k, y0 + h],
        [x0 + k, y0 + h],
        [x0, y],
      ];
      shapes.push({ kind: 'polygon', points: pts.map(([a, c]) => [a + 1.5, c + 2] as [number, number]), ...shadow });
      shapes.push({ kind: 'polygon', points: pts, fill, stroke, sw });
      break;
    }
    case 'parallelogram': {
      const k = 14;
      const pts: [number, number][] = [
        [x0 + k, y0],
        [x0 + w, y0],
        [x0 + w - k, y0 + h],
        [x0, y0 + h],
      ];
      shapes.push({ kind: 'polygon', points: pts.map(([a, c]) => [a + 1.5, c + 2] as [number, number]), ...shadow });
      shapes.push({ kind: 'polygon', points: pts, fill, stroke, sw });
      break;
    }
    case 'cylinder': {
      const e = 6;
      const d = `M ${fmt(x0)} ${fmt(y0 + e)} A ${fmt(w / 2)} ${e} 0 0 1 ${fmt(x0 + w)} ${fmt(y0 + e)} L ${fmt(x0 + w)} ${fmt(y0 + h - e)} A ${fmt(w / 2)} ${e} 0 0 1 ${fmt(x0)} ${fmt(y0 + h - e)} Z`;
      shapes.push({ kind: 'path', d, fill, stroke, sw });
      shapes.push({ kind: 'ellipse', cx: x, cy: y0 + e, rx: w / 2, ry: e, fill: tint(color, 0.7), stroke, sw });
      break;
    }
    case 'note': {
      const f = 10;
      const d = `M ${fmt(x0)} ${fmt(y0)} L ${fmt(x0 + w - f)} ${fmt(y0)} L ${fmt(x0 + w)} ${fmt(y0 + f)} L ${fmt(x0 + w)} ${fmt(y0 + h)} L ${fmt(x0)} ${fmt(y0 + h)} Z`;
      shapes.push({ kind: 'path', d, fill: '#fff8db', stroke: '#e0b800', sw });
      shapes.push({ kind: 'path', d: `M ${fmt(x0 + w - f)} ${fmt(y0)} L ${fmt(x0 + w - f)} ${fmt(y0 + f)} L ${fmt(x0 + w)} ${fmt(y0 + f)}`, stroke: '#e0b800', sw, fill: '#f5e08a' });
      break;
    }
    default: {
      const rx = shape === 'pill' ? h / 2 : shape === 'round' ? 10 : 4;
      shapes.push({ kind: 'rect', x: x0 + 1.5, y: y0 + 2, w, h, rx, ...shadow });
      shapes.push({ kind: 'rect', x: x0, y: y0, w, h, rx, fill, stroke, sw });
      if (shape === 'rect') shapes.push({ kind: 'rect', x: x0, y: y0, w: 4, h, rx: 2, fill: color });
    }
  }
  const textColor = solid ? (luminance(color) > 0.7 ? '#111827' : '#ffffff') : shape === 'note' ? '#5c4a00' : shade(color, 0.55);
  const th = b.lines.length * LINE_H;
  labels.push({
    x: x0 + 4,
    y: y - th / 2 - 1,
    w: w - 8,
    h: th + 2,
    text: b.lines.join('\n'),
    size: FONT,
    color: textColor,
    weight: 600,
    align: 'center',
    valign: 'middle',
  });
}

function arrowHead(x: number, y: number, angle: number, color: string, size = 6.5): Shape {
  const a1 = angle + Math.PI - 0.42;
  const a2 = angle + Math.PI + 0.42;
  return {
    kind: 'polygon',
    points: [
      [x, y],
      [x + Math.cos(a1) * size, y + Math.sin(a1) * size],
      [x + Math.cos(a2) * size, y + Math.sin(a2) * size],
    ],
    fill: color,
  };
}

function edgeLabel(text: string, cx: number, cy: number, labels: Label[], color: string) {
  const lines = wrapText(text, 18);
  const w = Math.max(...lines.map((l) => textWidth(l, 8, false))) + 10;
  const h = lines.length * 10.5 + 4;
  labels.push({ x: cx - w / 2, y: cy - h / 2, w, h, text: lines.join('\n'), size: 8, color, align: 'center', valign: 'middle', bg: '#ffffff' });
}

/** orthogonal polyline with rounded corners */
function roundedPath(pts: [number, number][], r = 8): string {
  if (pts.length < 2) return '';
  let d = `M ${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const d1 = Math.hypot(cx - px, cy - py);
    const d2 = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    if (rr < 0.5) {
      d += ` L ${fmt(cx)} ${fmt(cy)}`;
      continue;
    }
    const ax = cx - ((cx - px) / d1) * rr;
    const ay = cy - ((cy - py) / d1) * rr;
    const bx = cx + ((nx - cx) / d2) * rr;
    const by = cy + ((ny - cy) / d2) * rr;
    d += ` L ${fmt(ax)} ${fmt(ay)} Q ${fmt(cx)} ${fmt(cy)} ${fmt(bx)} ${fmt(by)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${fmt(last[0])} ${fmt(last[1])}`;
  return d;
}

// --------------------------------------------------------------- flowchart
function flowchart(nodes: DiagramNode[], edges: DiagramEdge[], dir: 'LR' | 'TB', theme: PdfTheme, natural: boolean): Scene {
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const out = new Map<string, string[]>();
  nodes.forEach((n) => out.set(n.id, []));
  edges.forEach((e) => out.get(e.from)!.push(e.to));

  // 1. break cycles with DFS (back edges ignored for layering)
  const back = new Set<DiagramEdge>();
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const e of edges) {
      if (e.from !== id) continue;
      const s = state.get(e.to) ?? 0;
      if (s === 1) back.add(e);
      else if (s === 0) visit(e.to);
    }
    state.set(id, 2);
  };
  // start from sources first, then anything left
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  edges.forEach((e) => indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1));
  nodes.filter((n) => indeg.get(n.id) === 0).forEach((n) => (state.get(n.id) ? null : visit(n.id)));
  nodes.forEach((n) => (state.get(n.id) ? null : visit(n.id)));
  const fwd = edges.filter((e) => !back.has(e) && e.from !== e.to);

  // 2. longest-path layering
  const layer = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let iter = 0; iter < nodes.length; iter++) {
    let changed = false;
    for (const e of fwd) {
      const l = layer.get(e.from)! + 1;
      if (l > layer.get(e.to)!) {
        layer.set(e.to, l);
        changed = true;
      }
    }
    if (!changed) break;
  }
  // pull sinks/leaves closer to their parents
  for (const n of nodes) {
    const outs = fwd.filter((e) => e.from === n.id);
    if (outs.length) {
      const minChild = Math.min(...outs.map((e) => layer.get(e.to)!));
      if (minChild - 1 > layer.get(n.id)! && fwd.every((e) => e.to !== n.id)) layer.set(n.id, minChild - 1);
    }
  }

  const nLayers = Math.max(...layer.values()) + 1;
  const layers: string[][] = Array.from({ length: nLayers }, () => []);
  nodes.forEach((n) => layers[layer.get(n.id)!].push(n.id));

  // 3. barycentric ordering
  const pos = new Map<string, number>();
  const refresh = () => layers.forEach((L) => L.forEach((id, i) => pos.set(id, i)));
  refresh();
  for (let sweep = 0; sweep < 6; sweep++) {
    const down = sweep % 2 === 0;
    const range = down ? [...Array(nLayers).keys()].slice(1) : [...Array(nLayers).keys()].reverse().slice(1);
    for (const li of range) {
      const L = layers[li];
      const bary = new Map<string, number>();
      for (const id of L) {
        const nb = fwd.filter((e) => (down ? e.to === id : e.from === id)).map((e) => pos.get(down ? e.from : e.to)!);
        bary.set(id, nb.length ? nb.reduce((a, b) => a + b, 0) / nb.length : pos.get(id)!);
      }
      L.sort((a, b) => bary.get(a)! - bary.get(b)! || idx.get(a)! - idx.get(b)!);
      refresh();
    }
  }

  // 4. measure + place
  const boxes = new Map<string, Box>();
  nodes.forEach((n, i) => {
    const shape: NodeShape = n.shape ?? (i === 0 && edges.length ? 'pill' : 'round');
    const m = measure(n, shape);
    boxes.set(n.id, {
      node: n,
      idx: i,
      ...m,
      x: 0,
      y: 0,
      layer: layer.get(n.id)!,
      order: pos.get(n.id)!,
      color: isHex(n.color) ? n.color! : typeof n.group === 'number' ? theme.palette[Math.abs(n.group) % theme.palette.length] : theme.palette[layer.get(n.id)! % theme.palette.length],
      shape,
    });
  });

  const hasLabels = edges.some((e) => e.label);
  const MAIN_GAP = dir === 'TB' ? (hasLabels ? 50 : 36) : hasLabels ? 70 : 40;
  const CROSS_GAP = dir === 'TB' ? 26 : 18;
  const main = (b: Box) => (dir === 'TB' ? b.h : b.w);
  const cross = (b: Box) => (dir === 'TB' ? b.w : b.h);

  const layerMain = layers.map((L) => Math.max(...L.map((id) => main(boxes.get(id)!))));
  const layerCross = layers.map((L) => L.reduce((s, id) => s + cross(boxes.get(id)!), 0) + CROSS_GAP * (L.length - 1));
  const maxCross = Math.max(...layerCross);

  let cursor = 0;
  const backCount = back.size;
  const PAD = 10;
  layers.forEach((L, li) => {
    // initial centered placement
    let c = (maxCross - layerCross[li]) / 2;
    const centers: number[] = [];
    L.forEach((id) => {
      const b = boxes.get(id)!;
      centers.push(c + cross(b) / 2);
      c += cross(b) + CROSS_GAP;
    });
    // nudge toward parents' centers when there is room (keeps chains straight)
    if (li > 0) {
      const desired = L.map((id, i) => {
        const parents = fwd.filter((e) => e.to === id).map((e) => boxes.get(e.from)!);
        if (!parents.length) return centers[i];
        return parents.reduce((s, p) => s + (dir === 'TB' ? p.x : p.y), 0) / parents.length - PAD;
      });
      // resolve overlaps left→right while staying close to desired
      const res = [...desired];
      for (let i = 0; i < L.length; i++) {
        const minC = i === 0 ? cross(boxes.get(L[0])!) / 2 : res[i - 1] + cross(boxes.get(L[i - 1])!) / 2 + CROSS_GAP + cross(boxes.get(L[i])!) / 2;
        res[i] = Math.max(res[i], minC);
      }
      // shift back if overflowing to the right
      const overflow = res[L.length - 1] + cross(boxes.get(L[L.length - 1])!) / 2 - maxCross;
      if (overflow > 0) for (let i = L.length - 1; i >= 0; i--) {
        const maxC = i === L.length - 1 ? maxCross - cross(boxes.get(L[i])!) / 2 : res[i + 1] - cross(boxes.get(L[i + 1])!) / 2 - CROSS_GAP - cross(boxes.get(L[i])!) / 2;
        res[i] = Math.min(res[i], maxC);
      }
      res.forEach((v, i) => (centers[i] = v));
    }
    L.forEach((id, i) => {
      const b = boxes.get(id)!;
      const m = cursor + layerMain[li] / 2;
      if (dir === 'TB') {
        b.x = centers[i] + PAD;
        b.y = m + PAD;
      } else {
        b.x = m + PAD;
        b.y = centers[i] + PAD;
      }
    });
    cursor += layerMain[li] + MAIN_GAP;
  });
  const totalMain = cursor - MAIN_GAP + PAD * 2;
  const backRoom = backCount ? 24 + backCount * 10 : 0;
  // normalize: minimum cross coordinate could be negative after nudging
  const all = [...boxes.values()];
  const minCross = Math.min(...all.map((b) => (dir === 'TB' ? b.x - b.w / 2 : b.y - b.h / 2)));
  if (minCross < PAD) all.forEach((b) => (dir === 'TB' ? (b.x += PAD - minCross) : (b.y += PAD - minCross)));
  const maxC = Math.max(...all.map((b) => (dir === 'TB' ? b.x + b.w / 2 : b.y + b.h / 2)));

  const width = dir === 'TB' ? maxC + PAD + backRoom : totalMain;
  const height = dir === 'TB' ? totalMain : maxC + PAD + backRoom;

  const shapes: Shape[] = [];
  const labels: Label[] = [];
  const edgeColor = '#64748b';

  // ports: spread multiple edges along a side
  const outPorts = new Map<string, DiagramEdge[]>();
  const inPorts = new Map<string, DiagramEdge[]>();
  fwd.forEach((e) => {
    (outPorts.get(e.from) ?? outPorts.set(e.from, []).get(e.from)!).push(e);
    (inPorts.get(e.to) ?? inPorts.set(e.to, []).get(e.to)!).push(e);
  });
  const crossOf = (b: Box) => (dir === 'TB' ? b.x : b.y);
  outPorts.forEach((list) => list.sort((a, b) => crossOf(boxes.get(a.to)!) - crossOf(boxes.get(b.to)!)));
  inPorts.forEach((list) => list.sort((a, b) => crossOf(boxes.get(a.from)!) - crossOf(boxes.get(b.from)!)));
  const portOffset = (b: Box, list: DiagramEdge[] | undefined, e: DiagramEdge) => {
    if (!list || list.length < 2 || b.shape === 'diamond' || b.shape === 'circle') return 0;
    const i = list.indexOf(e);
    const span = Math.min(cross(b) * 0.6, (list.length - 1) * 16);
    return -span / 2 + (span * i) / (list.length - 1);
  };

  const edgeShapes: Shape[] = [];
  fwd.forEach((e) => {
    const s = boxes.get(e.from)!;
    const t = boxes.get(e.to)!;
    const so = portOffset(s, outPorts.get(e.from), e);
    const to = portOffset(t, inPorts.get(e.to), e);
    const span = t.layer - s.layer;
    let pts: [number, number][];
    let d: string;
    let lx: number;
    let ly: number;
    let angle: number;
    if (dir === 'TB') {
      const sx = s.x + so;
      const sy = s.y + s.h / 2;
      const tx = t.x + to;
      const ty = t.y - t.h / 2;
      if (span <= 1) {
        const midY = sy + (ty - sy) / 2;
        pts = Math.abs(sx - tx) < 1 ? [[sx, sy], [tx, ty]] : [[sx, sy], [sx, midY], [tx, midY], [tx, ty]];
        d = roundedPath(pts);
        lx = Math.abs(sx - tx) < 1 ? sx : (sx + tx) / 2;
        ly = midY;
        if (Math.abs(sx - tx) < 1) ly = midY;
      } else {
        const k = (ty - sy) / 2;
        d = `M ${fmt(sx)} ${fmt(sy)} C ${fmt(sx)} ${fmt(sy + k)} ${fmt(tx)} ${fmt(ty - k)} ${fmt(tx)} ${fmt(ty)}`;
        lx = (sx + tx) / 2;
        ly = (sy + ty) / 2;
      }
      angle = Math.PI / 2;
      edgeShapes.push({ kind: 'path', d, stroke: edgeColor, sw: 1.2, dash: e.dashed ? '4 3' : undefined, cap: 'round' });
      edgeShapes.push(arrowHead(tx, ty, angle, edgeColor));
      if (e.bidirectional) edgeShapes.push(arrowHead(sx, sy, -Math.PI / 2, edgeColor));
    } else {
      const sx = s.x + s.w / 2;
      const sy = s.y + so;
      const tx = t.x - t.w / 2;
      const ty = t.y + to;
      if (span <= 1) {
        const midX = sx + (tx - sx) / 2;
        pts = Math.abs(sy - ty) < 1 ? [[sx, sy], [tx, ty]] : [[sx, sy], [midX, sy], [midX, ty], [tx, ty]];
        d = roundedPath(pts);
        lx = midX;
        ly = Math.abs(sy - ty) < 1 ? sy : (sy + ty) / 2;
      } else {
        const k = (tx - sx) / 2;
        d = `M ${fmt(sx)} ${fmt(sy)} C ${fmt(sx + k)} ${fmt(sy)} ${fmt(tx - k)} ${fmt(ty)} ${fmt(tx)} ${fmt(ty)}`;
        lx = (sx + tx) / 2;
        ly = (sy + ty) / 2;
      }
      angle = 0;
      edgeShapes.push({ kind: 'path', d, stroke: edgeColor, sw: 1.2, dash: e.dashed ? '4 3' : undefined, cap: 'round' });
      edgeShapes.push(arrowHead(tx, ty, angle, edgeColor));
      if (e.bidirectional) edgeShapes.push(arrowHead(sx, sy, Math.PI, edgeColor));
    }
    if (e.label) edgeLabel(e.label, lx, ly, labels, '#334155');
  });

  // back edges route around the far side
  let bi = 0;
  back.forEach((e) => {
    const s = boxes.get(e.from)!;
    const t = boxes.get(e.to)!;
    const off = 16 + bi * 10;
    bi++;
    let pts: [number, number][];
    let angle: number;
    if (dir === 'TB') {
      const rx = maxC + off;
      pts = [
        [s.x + s.w / 2, s.y],
        [rx, s.y],
        [rx, t.y],
        [t.x + t.w / 2, t.y],
      ];
      angle = Math.PI;
    } else {
      const ry = maxC + off;
      pts = [
        [s.x, s.y + s.h / 2],
        [s.x, ry],
        [t.x, ry],
        [t.x, t.y + t.h / 2],
      ];
      angle = -Math.PI / 2;
    }
    if (e.from === e.to) {
      // self loop
      const b = s;
      const x1 = b.x + b.w / 2;
      const d = `M ${fmt(x1)} ${fmt(b.y - 6)} C ${fmt(x1 + 30)} ${fmt(b.y - 26)} ${fmt(x1 + 30)} ${fmt(b.y + 26)} ${fmt(x1)} ${fmt(b.y + 6)}`;
      edgeShapes.push({ kind: 'path', d, stroke: edgeColor, sw: 1.2, dash: '4 3' });
      edgeShapes.push(arrowHead(x1, b.y + 6, Math.PI * 0.85, edgeColor));
      if (e.label) edgeLabel(e.label, x1 + 26, b.y, labels, '#334155');
      return;
    }
    edgeShapes.push({ kind: 'path', d: roundedPath(pts, 10), stroke: edgeColor, sw: 1.2, dash: e.dashed === false ? undefined : '4 3', cap: 'round' });
    const end = pts[pts.length - 1];
    edgeShapes.push(arrowHead(end[0], end[1], angle, edgeColor));
    if (e.label) edgeLabel(e.label, (pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2, labels, '#334155');
  });

  shapes.push(...edgeShapes);
  const nodeLabels: Label[] = [];
  boxes.forEach((b) => drawNode(b, shapes, nodeLabels, natural));
  return { width, height, shapes, labels: [...nodeLabels, ...labels] };
}

// ------------------------------------------------------------------ mindmap
interface TNode {
  n: DiagramNode;
  children: TNode[];
  leaves: number;
  side: 1 | -1;
  color: string;
  depth: number;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
}

function mindmap(nodes: DiagramNode[], edges: DiagramEdge[], theme: PdfTheme): Scene {
  // root = node with no incoming edge and most outgoing, defaults to first node
  const incoming = new Set(edges.map((e) => e.to));
  const root = nodes.find((n) => !incoming.has(n.id)) ?? nodes[0];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const used = new Set<string>([root.id]);
  const build = (n: DiagramNode, depth: number): TNode => {
    const kids = edges
      .filter((e) => e.from === n.id && !used.has(e.to))
      .map((e) => {
        used.add(e.to);
        return byId.get(e.to)!;
      });
    const size = depth === 0 ? 12 : depth === 1 ? 10 : 9;
    const lines = wrapText(n.label, depth === 0 ? 16 : 22);
    const w = Math.max(...lines.map((l) => textWidth(l, size, depth < 2))) + (depth === 0 ? 30 : 20);
    const h = lines.length * size * 1.3 + (depth === 0 ? 22 : 12);
    const t: TNode = { n, children: [], leaves: 1, side: 1, color: theme.primary, depth, x: 0, y: 0, w, h, lines };
    t.children = kids.map((k) => build(k, depth + 1));
    return t;
  };
  const tree = build(root, 0);
  // orphans attach to root
  nodes.filter((n) => !used.has(n.id)).forEach((n) => {
    used.add(n.id);
    tree.children.push(build(n, 1));
  });
  const count = (t: TNode): number => (t.leaves = t.children.length ? t.children.reduce((s, c) => s + count(c), 0) : 1);
  count(tree);

  // split level-1 children into right/left groups balancing leaf counts
  const right: TNode[] = [];
  const left: TNode[] = [];
  let rs = 0;
  let ls = 0;
  tree.children.forEach((c, i) => {
    c.color = isHex(c.n.color) ? c.n.color! : theme.palette[i % theme.palette.length];
    if (rs <= ls) {
      right.push(c);
      rs += c.leaves;
    } else {
      left.push(c);
      ls += c.leaves;
    }
  });
  const ROW = 30;
  const GAPX = 46;
  const setColor = (t: TNode, color: string, side: 1 | -1) => {
    t.color = color;
    t.side = side;
    t.children.forEach((c) => setColor(c, color, side));
  };
  right.forEach((c) => setColor(c, c.color, 1));
  left.forEach((c) => setColor(c, c.color, -1));

  // depth widths per side
  const depthW = (list: TNode[]) => {
    const ws: number[] = [];
    const walk = (t: TNode) => {
      ws[t.depth] = Math.max(ws[t.depth] ?? 0, t.w);
      t.children.forEach(walk);
    };
    list.forEach(walk);
    return ws;
  };
  const rw = depthW(right);
  const lw = depthW(left);
  const place = (list: TNode[], side: 1 | -1, ws: number[]) => {
    const total = list.reduce((s, c) => s + c.leaves, 0) * ROW;
    let y = -total / 2;
    const xAt = (depth: number) => {
      let x = tree.w / 2 + GAPX;
      for (let d = 1; d < depth; d++) x += (ws[d] ?? 0) + GAPX;
      return x;
    };
    const walk = (t: TNode, top: number) => {
      const hgt = t.leaves * ROW;
      t.y = top + hgt / 2;
      t.x = side * (xAt(t.depth) + t.w / 2);
      let cy = top;
      t.children.forEach((c) => {
        walk(c, cy);
        cy += c.leaves * ROW;
      });
    };
    list.forEach((c) => {
      walk(c, y);
      y += c.leaves * ROW;
    });
  };
  place(right, 1, rw);
  place(left, -1, lw);

  const all: TNode[] = [];
  const collect = (t: TNode) => {
    all.push(t);
    t.children.forEach(collect);
  };
  collect(tree);
  const minX = Math.min(...all.map((t) => t.x - t.w / 2)) - 10;
  const maxX = Math.max(...all.map((t) => t.x + t.w / 2)) + 10;
  const minY = Math.min(...all.map((t) => t.y - t.h / 2)) - 10;
  const maxY = Math.max(...all.map((t) => t.y + t.h / 2)) + 10;
  all.forEach((t) => {
    t.x -= minX;
    t.y -= minY;
  });

  const shapes: Shape[] = [];
  const labels: Label[] = [];
  // connectors
  const connect = (p: TNode) => {
    p.children.forEach((c) => {
      const sx = p.x + c.side * (p.w / 2);
      const sy = p.y;
      const tx = c.x - c.side * (c.w / 2);
      const ty = c.y;
      const k = (tx - sx) / 2;
      shapes.push({ kind: 'path', d: `M ${fmt(sx)} ${fmt(sy)} C ${fmt(sx + k)} ${fmt(sy)} ${fmt(tx - k)} ${fmt(ty)} ${fmt(tx)} ${fmt(ty)}`, stroke: c.color, sw: c.depth === 1 ? 2.4 : 1.4, cap: 'round' });
      connect(c);
    });
  };
  connect(tree);
  all.forEach((t) => {
    const x0 = t.x - t.w / 2;
    const y0 = t.y - t.h / 2;
    const size = t.depth === 0 ? 12 : t.depth === 1 ? 10 : 9;
    if (t.depth === 0) {
      shapes.push({ kind: 'rect', x: x0 + 2, y: y0 + 3, w: t.w, h: t.h, rx: t.h / 2, fill: '#0f172a', opacity: 0.08 });
      shapes.push({ kind: 'rect', x: x0, y: y0, w: t.w, h: t.h, rx: t.h / 2, fill: theme.primaryDark });
    } else if (t.depth === 1) {
      shapes.push({ kind: 'rect', x: x0, y: y0, w: t.w, h: t.h, rx: t.h / 2, fill: t.color });
    } else {
      shapes.push({ kind: 'rect', x: x0, y: y0, w: t.w, h: t.h, rx: 6, fill: tint(t.color, 0.88), stroke: tint(t.color, 0.4), sw: 0.8 });
    }
    const th = t.lines.length * size * 1.3;
    labels.push({
      x: x0 + 3,
      y: t.y - th / 2 - 1,
      w: t.w - 6,
      h: th + 2,
      text: t.lines.join('\n'),
      size,
      weight: t.depth < 2 ? 700 : 400,
      color: t.depth < 2 ? '#ffffff' : shade(t.color, 0.55),
      align: 'center',
      valign: 'middle',
    });
  });
  return { width: maxX - minX, height: maxY - minY, shapes, labels };
}

// ----------------------------------------------------------------- sequence
function sequence(nodes: DiagramNode[], edges: DiagramEdge[], theme: PdfTheme): Scene {
  const COLW = Math.max(110, Math.min(150, 520 / Math.max(1, nodes.length)));
  const TOP = 44;
  const STEP = 34;
  const shapes: Shape[] = [];
  const labels: Label[] = [];
  const xOf = new Map(nodes.map((n, i) => [n.id, COLW / 2 + i * COLW + 6]));
  const height = TOP + 18 + edges.length * STEP + 40;
  const width = nodes.length * COLW + 12;
  nodes.forEach((n, i) => {
    const x = xOf.get(n.id)!;
    const color = isHex(n.color) ? n.color! : theme.palette[i % theme.palette.length];
    shapes.push({ kind: 'line', x1: x, y1: TOP, x2: x, y2: height - 30, stroke: '#94a3b8', sw: 1, dash: '3 3' });
    for (const y of [4, height - 34]) {
      shapes.push({ kind: 'rect', x: x - COLW / 2 + 10, y, w: COLW - 20, h: 30, rx: 6, fill: tint(color, 0.85), stroke: color, sw: 1.2 });
      labels.push({ x: x - COLW / 2 + 12, y: y + 2, w: COLW - 24, h: 26, text: wrapText(n.label, 18).slice(0, 2).join('\n'), size: 9, weight: 700, color: shade(color, 0.5), align: 'center', valign: 'middle' });
    }
  });
  edges.forEach((e, i) => {
    const y = TOP + 26 + i * STEP;
    const x1 = xOf.get(e.from)!;
    const x2 = xOf.get(e.to)!;
    const color = '#475569';
    // activation bar
    shapes.push({ kind: 'rect', x: x1 - 3, y: y - 8, w: 6, h: 16, fill: tint(theme.primary, 0.7), stroke: theme.primary, sw: 0.6 });
    if (e.from === e.to) {
      const d = `M ${fmt(x1 + 3)} ${fmt(y - 4)} L ${fmt(x1 + 36)} ${fmt(y - 4)} L ${fmt(x1 + 36)} ${fmt(y + 10)} L ${fmt(x1 + 5)} ${fmt(y + 10)}`;
      shapes.push({ kind: 'path', d, stroke: color, sw: 1.1, dash: e.dashed ? '4 3' : undefined });
      shapes.push(arrowHead(x1 + 4, y + 10, Math.PI, color, 5.5));
      if (e.label) labels.push({ x: x1 + 40, y: y - 6, w: COLW, h: 12, text: e.label, size: 8, color: '#1f2937', align: 'left' });
      return;
    }
    const dirn = x2 > x1 ? 1 : -1;
    shapes.push({ kind: 'line', x1: x1 + dirn * 3, y1: y, x2: x2 - dirn * 2, y2: y, stroke: color, sw: 1.1, dash: e.dashed ? '4 3' : undefined });
    shapes.push(arrowHead(x2 - dirn * 2, y, dirn > 0 ? 0 : Math.PI, color, 6));
    if (e.label) {
      const w = Math.abs(x2 - x1) - 12;
      labels.push({ x: Math.min(x1, x2) + 6, y: y - 13, w, h: 11, text: e.label, size: 8, color: '#1f2937', align: 'center', valign: 'bottom', weight: 600 });
    }
    // step number
    shapes.push({ kind: 'circle', cx: 8, cy: y, r: 6, fill: theme.primary });
    labels.push({ x: 2, y: y - 5, w: 12, h: 10, text: String(i + 1), size: 6.5, color: '#fff', weight: 700, align: 'center', valign: 'middle' });
  });
  return { width, height, shapes, labels };
}

// -------------------------------------------------------------------- cycle
function cycle(nodes: DiagramNode[], _edges: DiagramEdge[], theme: PdfTheme): Scene {
  const n = nodes.length;
  const R = Math.max(90, n * 26);
  const boxes = nodes.map((nd, i) => {
    const lines = wrapText(nd.label, 16);
    const w = Math.max(84, Math.max(...lines.map((l) => textWidth(l, 9.5, true))) + 24);
    const h = lines.length * 12.5 + 18;
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { nd, lines, w, h, a, x: Math.cos(a) * R, y: Math.sin(a) * R, color: isHex(nd.color) ? nd.color! : theme.palette[i % theme.palette.length] };
  });
  const minX = Math.min(...boxes.map((b) => b.x - b.w / 2)) - 12;
  const maxX = Math.max(...boxes.map((b) => b.x + b.w / 2)) + 12;
  const minY = Math.min(...boxes.map((b) => b.y - b.h / 2)) - 12;
  const maxY = Math.max(...boxes.map((b) => b.y + b.h / 2)) + 12;
  const cx = -minX;
  const cy = -minY;
  const shapes: Shape[] = [];
  const labels: Label[] = [];
  // ring arrows between consecutive nodes
  boxes.forEach((b, i) => {
    const nb = boxes[(i + 1) % n];
    const gap = Math.min(0.5, (Math.PI / n) * 0.55);
    const a1 = b.a + gap;
    const a2 = nb.a - gap + (i === n - 1 ? 2 * Math.PI : 0);
    const x1 = cx + Math.cos(a1) * R;
    const y1 = cy + Math.sin(a1) * R;
    const x2 = cx + Math.cos(a2) * R;
    const y2 = cy + Math.sin(a2) * R;
    const large = a2 - a1 > Math.PI ? 1 : 0;
    shapes.push({ kind: 'path', d: `M ${fmt(x1)} ${fmt(y1)} A ${fmt(R)} ${fmt(R)} 0 ${large} 1 ${fmt(x2)} ${fmt(y2)}`, stroke: tint(b.color, 0.25), sw: 2.2, cap: 'round' });
    shapes.push(arrowHead(x2, y2, a2 + Math.PI / 2, tint(b.color, 0.25), 8));
  });
  boxes.forEach((b, i) => {
    const x = cx + b.x;
    const y = cy + b.y;
    shapes.push({ kind: 'rect', x: x - b.w / 2 + 1.5, y: y - b.h / 2 + 2, w: b.w, h: b.h, rx: b.h / 2, fill: '#0f172a', opacity: 0.07 });
    shapes.push({ kind: 'rect', x: x - b.w / 2, y: y - b.h / 2, w: b.w, h: b.h, rx: b.h / 2, fill: b.color });
    const th = b.lines.length * 12.5;
    labels.push({ x: x - b.w / 2 + 4, y: y - th / 2 - 1, w: b.w - 8, h: th + 2, text: b.lines.join('\n'), size: 9.5, weight: 700, color: '#ffffff', align: 'center', valign: 'middle' });
    shapes.push({ kind: 'circle', cx: x - b.w / 2 + 2, cy: y - b.h / 2 + 2, r: 7, fill: '#ffffff', stroke: b.color, sw: 1.2 });
    labels.push({ x: x - b.w / 2 - 5, y: y - b.h / 2 - 3, w: 14, h: 10, text: String(i + 1), size: 7, weight: 700, color: b.color, align: 'center', valign: 'middle' });
  });
  return { width: maxX - minX, height: maxY - minY, shapes, labels };
}

