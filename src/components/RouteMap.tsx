import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Polyline, Text as SvgText } from 'react-native-svg';

import { useAppTheme } from '@/hooks/use-app-theme';
import type { RouteResult } from '@/types';

const IMG_W = 1313;
const IMG_H = 980;
const px = (p: { x: number; y: number }) => ({ x: (p.x / 100) * IMG_W, y: (p.y / 100) * IMG_H });

export type MapBarrier = { id: string; x: number; y: number };

type Props = {
  route: RouteResult;
  width: number;
  height: number;
  barriers: MapBarrier[];
  /** Posición (en %) del paso actual */
  current?: { x: number; y: number };
  accessibleMode?: boolean;
  label: string;
};

export function RouteMap({ route, width, height, barriers, current, accessibleMode = false, label }: Props) {
  const t = useAppTheme(accessibleMode);
  const crop = useMemo(() => {
    const pts = route.polyline.map(px);
    const ar = width / height;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const pad = 90;
    const spanX = Math.max(...xs) - Math.min(...xs) + pad * 2;
    const spanY = Math.max(...ys) - Math.min(...ys) + pad * 2;
    let w = Math.max(spanX, spanY * ar, 360);
    let h = w / ar;
    if (w > IMG_W) { w = IMG_W; h = w / ar; }
    if (h > IMG_H) { h = IMG_H; w = h * ar; }
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const l = Math.min(Math.max(cx - w / 2, 0), IMG_W - w);
    const tp = Math.min(Math.max(cy - h / 2, 0), IMG_H - h);
    return { l, t: tp, w, h, scale: width / w };
  }, [route, width, height]);

  const u = 1 / crop.scale; // unidades svg por px de pantalla
  const line = route.polyline.map(px).map((p) => `${p.x},${p.y}`).join(' ');
  const start = px(route.polyline[0]);
  const end = px(route.polyline[route.polyline.length - 1]);
  const cur = current ? px(current) : null;
  const inside = (p: { x: number; y: number }) =>
    p.x >= crop.l && p.x <= crop.l + crop.w && p.y >= crop.t && p.y <= crop.t + crop.h;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.frame, { width, height, borderRadius: t.radius.lg, borderColor: t.colors.border, backgroundColor: t.colors.surfaceAlt }]}>
      <Image
        source={require('../../assets/images/campus-plan.jpg')}
        style={{
          position: 'absolute',
          width: IMG_W * crop.scale,
          height: IMG_H * crop.scale,
          left: -crop.l * crop.scale,
          top: -crop.t * crop.scale,
          opacity: 0.45,
        }}
      />
      <Svg width={width} height={height} viewBox={`${crop.l} ${crop.t} ${crop.w} ${crop.h}`}>
        <Polyline points={line} fill="none" stroke={t.colors.surface} strokeWidth={11 * u} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={line} fill="none" stroke={t.colors.primary} strokeWidth={7 * u} strokeLinecap="round" strokeLinejoin="round" />
        {barriers.map((b) => {
          const p = px(b);
          if (!inside(p)) return null;
          return (
            <G key={b.id}>
              <Circle cx={p.x} cy={p.y} r={14 * u} fill={t.colors.danger} stroke={t.colors.surface} strokeWidth={3 * u} />
              <SvgText x={p.x} y={p.y + 6 * u} fontSize={18 * u} fontWeight="800" fill={t.colors.surface} textAnchor="middle">!</SvgText>
            </G>
          );
        })}
        {cur ? (
          <Circle cx={cur.x} cy={cur.y} r={9 * u} fill={t.colors.surface} stroke={t.colors.primary} strokeWidth={4 * u} />
        ) : null}
        <Circle cx={start.x} cy={start.y} r={11 * u} fill={t.colors.success} stroke={t.colors.surface} strokeWidth={4 * u} />
        <Circle cx={end.x} cy={end.y} r={13 * u} fill={t.colors.text} stroke={t.colors.surface} strokeWidth={4 * u} />
        <Circle cx={end.x} cy={end.y} r={4 * u} fill={t.colors.surface} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderWidth: 1 },
});
