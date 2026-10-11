import { Circle, Ellipse, Line, Path, Polygon, Rect, Svg, Text, View } from '@react-pdf/renderer';
import type { Scene } from './scene';

export function SceneView({ scene, font }: { scene: Scene; font: string }) {
  const { width, height } = scene;
  return (
    <View style={{ width, height, position: 'relative' }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        {scene.shapes.map((s, i) => {
          switch (s.kind) {
            case 'rect':
              return (
                <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx ?? 0} ry={s.rx ?? 0} fill={s.fill ?? 'none'} stroke={s.stroke ?? 'none'} strokeWidth={s.sw ?? 0} strokeDasharray={s.dash} fillOpacity={s.opacity ?? 1} />
              );
            case 'circle':
              return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ?? 'none'} stroke={s.stroke ?? 'none'} strokeWidth={s.sw ?? 0} fillOpacity={s.opacity ?? 1} />;
            case 'ellipse':
              return <Ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.fill ?? 'none'} stroke={s.stroke ?? 'none'} strokeWidth={s.sw ?? 0} fillOpacity={s.opacity ?? 1} />;
            case 'polygon':
              return (
                <Polygon key={i} points={s.points.map((p) => p.join(',')).join(' ')} fill={s.fill ?? 'none'} stroke={s.stroke ?? 'none'} strokeWidth={s.sw ?? 0} fillOpacity={s.opacity ?? 1} strokeLinejoin="round" />
              );
            case 'line':
              return <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.sw ?? 1} strokeDasharray={s.dash} strokeOpacity={s.opacity ?? 1} />;
            case 'path':
              return (
                <Path
                  key={i}
                  d={s.d}
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
            left: l.x,
            top: l.y,
            width: l.w,
            height: l.h,
            justifyContent: l.valign === 'top' ? 'flex-start' : l.valign === 'bottom' ? 'flex-end' : 'center',
            backgroundColor: l.bg,
            borderRadius: l.bg ? 3 : 0,
          }}
        >
          <Text
            style={{
              fontFamily: font,
              fontSize: l.size,
              lineHeight: 1.3,
              color: l.color,
              fontWeight: l.weight ?? 400,
              fontStyle: l.italic ? 'italic' : 'normal',
              textAlign: l.align ?? 'left',
            }}
          >
            {l.text}
          </Text>
        </View>
      ))}
    </View>
  );
}
