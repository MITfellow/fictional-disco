import { G, Line, Path, Rect, Svg, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { texToTree, type MathNode } from './mathjax';
import { MONO } from './fonts';

function paint(v: string | undefined, color: string) {
  if (!v) return undefined;
  if (v === 'currentColor') return color;
  return v;
}

type Inh = { fill: string; stroke: string; sw: number };
function renderNodes(nodes: MathNode[], color: string, inh: Inh, key = 'n'): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}${i}`;
    const a = n.attrs;
    const fill = paint(a.fill, color) ?? inh.fill;
    const sw = a['stroke-width'] ? parseFloat(a['stroke-width']) : inh.sw;
    const strokePaint = paint(a.stroke, color) ?? inh.stroke;
    const stroke = sw === 0 ? 'none' : strokePaint;
    if (n.tag === 'g')
      return (
        <G key={k} transform={a.transform} fill={fill} stroke={stroke} strokeWidth={sw}>
          {renderNodes(n.children ?? [], color, { fill, stroke: strokePaint, sw }, k)}
        </G>
      );
    if (n.tag === 'path') return <Path key={k} d={a.d} transform={a.transform} fill={fill} stroke={stroke} strokeWidth={sw} />;
    if (n.tag === 'line')
      return <Line key={k} x1={+a.x1 || 0} y1={+a.y1 || 0} x2={+a.x2 || 0} y2={+a.y2 || 0} stroke={stroke ?? color} strokeWidth={sw ?? 40} strokeDasharray={a['stroke-dasharray']} />;
    return <Rect key={k} x={+a.x || 0} y={+a.y || 0} width={+a.width || 0} height={+a.height || 0} transform={a.transform} fill={fill} stroke={stroke} strokeWidth={sw} />;
  });
}

/** Renders a TeX formula as vector paths. `size` is the font size in pt. Falls back to raw TeX on error. */
export function MathSvg({ tex, size = 12, color = '#0f172a', maxWidth }: { tex: string; size?: number; color?: string; maxWidth?: number }) {
  let tree;
  try {
    tree = texToTree(tex, true);
  } catch (e) {
    return (
      <View style={{ borderWidth: 0.6, borderColor: '#fca5a5', borderRadius: 4, padding: 6, backgroundColor: '#fff5f5' }}>
        <Text style={{ fontFamily: MONO, fontSize: 8.5, color: '#991b1b' }}>{tex}</Text>
        <Text style={{ fontSize: 7, color: '#b91c1c', marginTop: 2 }}>TeX error: {mathError(e)}</Text>
      </View>
    );
  }
  const [x, y, w, h] = tree.vb;
  let k = size / 1000;
  if (maxWidth && w * k > maxWidth) k = maxWidth / w;
  return (
    <Svg width={w * k} height={h * k} viewBox={`${x} ${y} ${w} ${h}`}>
      <G fill={color} stroke="none">
        {renderNodes(tree.nodes, color, { fill: color, stroke: color, sw: 0 })}
      </G>
    </Svg>
  );
}

export function mathError(e: unknown): string {
  const m = (e as { message?: unknown })?.message;
  return typeof m === 'string' ? m : String(e);
}
