import { Circle, Ellipse, Line, Path, Polygon, Rect, Svg, Text, View } from './prim';
import type { ReactNode } from 'react';
import type { Scene } from './scene';

export function SceneView({ scene, font, rich }: { scene: Scene; font: string | string[]; rich?: (text: string, size: number) => ReactNode }) {
  const finite = (n: number, fallback = 0) => (Number.isFinite(n) ? n : fallback);
  const width = Math.max(1, Math.min(5000, finite(scene.width, 1)));
  const height = Math.max(1, Math.min(5000, finite(scene.height, 1)));
  // Provider-authored curves and field-line integration can occasionally
  // diverge. Keep every coordinate near the scene instead of merely making it
  // finite: PDFKit rejects syntactically valid but astronomically large values.
  const limit = Math.max(1000, width * 8, height * 8);
  const safe = (n: number, fallback = 0) => Number.isFinite(n) ? Math.max(-limit, Math.min(limit, n)) : fallback;
  const path = (d: string) => d.replace(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi, (token) => String(safe(Number(token))));
  return (
    <View style={{ width, height, position: 'relative' }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        {scene.shapes.map((s, i) => {
          switch (s.kind) {
            case 'rect':
              return (
                <Rect key={i} x={safe(s.x)} y={safe(s.y)} width={Math.max(0, safe(s.w))} height={Math.max(0, safe(s.h))} rx={Math.max(0, safe(s.rx ?? 0))} ry={Math.max(0, safe(s.rx ?? 0))} fill={s.fill ?? 'none'} stroke={s.stroke ?? 'none'} strokeWidth={s.sw ?? 0} strokeDasharray={s.dash} fillOpacity={s.opacity ?? 1} />
              );
            case 'circle':
              return <Circle key={i} cx={safe(s.cx)} cy={safe(s.cy)} r={Math.max(0, safe(s.r))} fill={s.fill ?? 'none'} stroke={s.stroke ?? 'none'} strokeWidth={s.sw ?? 0} fillOpacity={s.opacity ?? 1} />;
            case 'ellipse':
              return <Ellipse key={i} cx={safe(s.cx)} cy={safe(s.cy)} rx={Math.max(0, safe(s.rx))} ry={Math.max(0, safe(s.ry))} fill={s.fill ?? 'none'} stroke={s.stroke ?? 'none'} strokeWidth={s.sw ?? 0} fillOpacity={s.opacity ?? 1} />;
            case 'polygon':
              return (
                <Polygon key={i} points={s.points.map((p) => `${safe(p[0])},${safe(p[1])}`).join(' ')} fill={s.fill ?? 'none'} stroke={s.stroke ?? 'none'} strokeWidth={s.sw ?? 0} fillOpacity={s.opacity ?? 1} strokeLinejoin="round" />
              );
            case 'line':
              return <Line key={i} x1={safe(s.x1)} y1={safe(s.y1)} x2={safe(s.x2)} y2={safe(s.y2)} stroke={s.stroke} strokeWidth={s.sw ?? 1} strokeDasharray={s.dash} strokeOpacity={s.opacity ?? 1} />;
            case 'path':
              return (
                <Path
                  key={i}
                  d={path(s.d)}
                  fill={s.fill ?? 'none'}
                  stroke={s.stroke ?? 'none'}
                  strokeWidth={s.sw ?? 0}
                  strokeDasharray={s.dash}
                  fillOpacity={s.opacity ?? 1}
                  strokeLinecap={s.cap ?? 'butt'}
                  strokeLinejoin="round"
                />
              );
          }
        })}
      </Svg>
      {scene.labels.map((l, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: safe(l.x),
            top: safe(l.y),
            width: Math.max(0, safe(l.w)),
            height: Math.max(0, safe(l.h)),
            justifyContent: l.valign === 'top' ? 'flex-start' : l.valign === 'bottom' ? 'flex-end' : 'center',
            backgroundColor: l.bg,
            borderRadius: l.bg ? 3 : 0,
          }}
        >
          <Text
            style={{
              fontFamily: font,
              fontSize: Math.max(1, safe(l.size, 9)),
              lineHeight: 1.3,
              color: l.color,
              fontWeight: l.weight ?? 400,
              fontStyle: l.italic ? 'italic' : 'normal',
              textAlign: l.align ?? 'left',
            }}
          >
            {l.rich && rich ? rich(l.text, l.size) : l.text}
          </Text>
        </View>
      ))}
    </View>
  );
}
