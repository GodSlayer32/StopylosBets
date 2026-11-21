import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Polygon, Polyline } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { useAppTheme } from '@/hooks/use-app-theme';
import { NODES } from '@/lib/routing';
import type { RouteResult } from '@/types';

const IMG_W = 1313;
const IMG_H = 980;
/** Pantalla px por px de plano */
const ZOOM = 2;
/** Posición vertical de la flecha (fracción del alto) */
const ANCHOR_Y = 0.5;
const LABEL_SIZE = 36;
const BIG = 100000;

type Pt = { x: number; y: number };
const px = (p: Pt): Pt => ({ x: (p.x / 100) * IMG_W, y: (p.y / 100) * IMG_H });

const BUILDING_POS = (() => {
  const acc = new Map<string, { x: number; y: number; n: number }>();
  for (const n of NODES) {
    if (!n.building) continue;
    const a = acc.get(n.building) ?? { x: 0, y: 0, n: 0 };
    acc.set(n.building, { x: a.x + n.x, y: a.y + n.y, n: a.n + 1 });
  }
  return [...acc.entries()].map(([id, a]) => ({ id, ...px({ x: a.x / a.n, y: a.y / a.n }) }));
})();

type Props = {
  route: RouteResult;
  point: Pt;
  heading: number;
  segIndex: number;
  width: number;
  height: number;
  /** Px del borde inferior tapados por la tarjeta */
  bottomInset?: number;
  accessibleMode?: boolean;
  label: string;
};

export function NearbyMap({ route, point, heading, segIndex, width, height, bottomInset = 0, accessibleMode = false, label }: Props) {
  const t = useAppTheme(accessibleMode);

  // Heading suavizado por el camino más corto (sin dar la vuelta larga)
  const unwrapped = useRef(heading);
  const [anim] = useState(() => new Animated.Value(heading));
  useEffect(() => {
    let diff = ((heading - unwrapped.current) % 360 + 540) % 360 - 180;
    if (Math.abs(diff) < 0.01) diff = 0;
    unwrapped.current += diff;
    Animated.timing(anim, { toValue: unwrapped.current, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [heading, anim]);

  const groupRot = anim.interpolate({ inputRange: [-BIG, BIG], outputRange: [`${BIG}deg`, `${-BIG}deg`] });
  const labelRot = anim.interpolate({ inputRange: [-BIG, BIG], outputRange: [`${-BIG}deg`, `${BIG}deg`] });

  const ax = width / 2;
  const ay = Math.max(40, (height - bottomInset) * ANCHOR_Y);
  const S = Math.ceil(2 * Math.hypot(Math.max(ax, width - ax), Math.max(ay, height - ay)));
  const view = S / ZOOM; // unidades de plano visibles en el grupo
  const c = px(point);
  const u = 1 / ZOOM;

  const { walked, ahead } = useMemo(() => {
    const pts = route.polyline.map(px);
    const cur = px(point);
    const w = [...pts.slice(0, segIndex + 1), cur].map((p) => `${p.x},${p.y}`).join(' ');
    const a = [cur, ...pts.slice(segIndex + 1)].map((p) => `${p.x},${p.y}`).join(' ');
    return { walked: w, ahead: a };
  }, [route, point, segIndex]);

  const end = px(route.polyline[route.polyline.length - 1]);
  const labels = BUILDING_POS.filter((b) => Math.hypot(b.x - c.x, b.y - c.y) < view * 0.62);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.frame, { width, height, borderColor: t.colors.border, backgroundColor: t.colors.surfaceAlt }]}>
      <Animated.View
        style={{
          position: 'absolute',
          width: S,
          height: S,
          left: ax - S / 2,
          top: ay - S / 2,
          transform: [{ rotate: groupRot }],
        }}>
        <Image
          source={require('../../assets/images/campus-plan.jpg')}
          style={{
            position: 'absolute',
            width: IMG_W * ZOOM,
            height: IMG_H * ZOOM,
            left: S / 2 - c.x * ZOOM,
            top: S / 2 - c.y * ZOOM,
            opacity: 0.5,
          }}
        />
        <Svg width={S} height={S} viewBox={`${c.x - view / 2} ${c.y - view / 2} ${view} ${view}`}>
          <Polyline points={ahead} fill="none" stroke={t.colors.surface} strokeWidth={16 * u} strokeLinecap="round" strokeLinejoin="round" />
          <Polyline points={walked} fill="none" stroke={t.colors.textMuted} strokeOpacity={0.45} strokeWidth={9 * u} strokeLinecap="round" strokeLinejoin="round" />
          <Polyline points={ahead} fill="none" stroke={t.colors.primary} strokeWidth={11 * u} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={end.x} cy={end.y} r={16 * u} fill={t.colors.text} stroke={t.colors.surface} strokeWidth={4 * u} />
          <Circle cx={end.x} cy={end.y} r={5 * u} fill={t.colors.surface} />
        </Svg>
        {labels.map((b) => (
          <Animated.View
            key={b.id}
            pointerEvents="none"
            style={[
              styles.badge,
              {
                width: LABEL_SIZE,
                height: LABEL_SIZE,
                borderRadius: t.radius.pill,
                backgroundColor: t.colors.text,
                borderColor: t.colors.surface,
                left: S / 2 + (b.x - c.x) * ZOOM - LABEL_SIZE / 2,
                top: S / 2 + (b.y - c.y) * ZOOM - LABEL_SIZE / 2,
                transform: [{ rotate: labelRot }],
              },
            ]}>
            <AppText variant="label" style={{ color: t.colors.bg }}>{b.id}</AppText>
          </Animated.View>
        ))}
      </Animated.View>

      {/* Flecha fija: el mundo gira, no la flecha */}
      <View pointerEvents="none" style={[styles.arrowWrap, { left: ax - 28, top: ay - 28 }]}>
        <View style={[styles.halo, { backgroundColor: t.colors.surface, borderColor: t.colors.primary }]} />
        <Svg width={56} height={56} viewBox="0 0 56 56">
          <Polygon points="28,10 42,42 28,35 14,42" fill={t.colors.primary} stroke={t.colors.surface} strokeWidth={3} strokeLinejoin="round" />
        </Svg>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderTopWidth: 1 },
  badge: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  arrowWrap: { position: 'absolute', width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 56, height: 56, borderRadius: 28, opacity: 0.75, borderWidth: 2 },
});
