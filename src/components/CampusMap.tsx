import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, G, Path, Polyline, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/hooks/use-theme';
import { CAMPUS_MAP, getFloorPlan } from '@/lib/campus-map';

type XY = [number, number];
type Pt = { x: number; y: number };
type Box = { minX: number; minY: number; maxX: number; maxY: number };
type View3 = { cx: number; cy: number; s: number; rot: number };
type RoomKind = 'room' | 'lab' | 'wc' | 'elevator' | 'stairs' | 'service';

export type CampusMapMode = 'macro' | 'floor' | 'closeup';
export type MapBarrier = { x: number; y: number; kind: 'incident' | 'stairs' };

export type CampusMapProps = {
  mode: CampusMapMode;
  routePoints: XY[];
  donePoints?: XY[];
  position?: Pt;
  /** Grados, 0 = arriba/norte del plano, horario */
  heading?: number;
  origin?: Pt;
  destination?: Pt;
  barriers?: MapBarrier[];
  activeBuildingId?: string;
  level?: number;
  destRoomId?: string;
  height: number;
  /** closeup: fracción vertical (0-1) donde se ancla la flecha */
  anchorY?: number;
  /** Rótulo superior izquierdo, p. ej. "Mapa | Piso 1" */
  title?: string;
  /** floor: px del borde derecho tapados (p. ej. FloorRail) */
  insetRight?: number;
  /** floor: px del borde superior tapados (rótulo, botones) */
  insetTop?: number;
  /** Cámara manual (sobrescribe el encuadre automático en macro/floor). zoom 1 = todo el campus */
  camera?: MapCamera | null;
  /** Si se pasa, el mapa acepta pan/pinch y reporta la cámara al terminar el gesto */
  onCameraChange?: (c: MapCamera) => void;
  /** Tap sobre un edificio (macro/floor) */
  onBuildingPress?: (id: string) => void;
  accessibilityLabel?: string;
};

export type MapCamera = { cx: number; cy: number; zoom: number };

// Plano en unidades de imagen original para conservar la proporción de los %
const PLAN_W = 1313;
const PLAN_H = 980;
const CLOSEUP_ZOOM = 4;
const LABEL_PX = 10;

const toPlan = (p: XY): XY => [(p[0] / 100) * PLAN_W, (p[1] / 100) * PLAN_H];
const ptPlan = (p: Pt): XY => toPlan([p.x, p.y]);

const bboxPts = (pts: XY[]): Box => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
};

const polyD = (polys: XY[][]) =>
  polys
    .map((poly) => 'M' + poly.map((p) => toPlan(p).map((n) => n.toFixed(1)).join(' ')).join('L') + 'Z')
    .join('');

const inPoly = (pt: XY, poly: XY[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

type Building = { id: string; name: string; polygon: XY[]; holes?: XY[][]; labelAt: XY };
type Area = { id: string; name: string; kind: string; polygon: XY[]; labelAt?: XY };
type Room = { id: string; name: string; polygon: XY[]; kind: string };
const BUILDINGS = CAMPUS_MAP.buildings as unknown as Building[];
const AREAS = CAMPUS_MAP.areas as unknown as Area[];
const BOUNDS = CAMPUS_MAP.bounds as Box;

const boundsBox = (b: Box): Box => {
  const [minX, minY] = toPlan([b.minX, b.minY]);
  const [maxX, maxY] = toPlan([b.maxX, b.maxY]);
  return { minX, minY, maxX, maxY };
};

const fitScale = (box: Box, w: number, h: number, margin: number) =>
  Math.max(0.01, Math.min((w - 2 * margin) / (box.maxX - box.minX || 1), (h - 2 * margin) / (box.maxY - box.minY || 1)));

const shortLabel = (b: Building) => (b.id.length <= 2 ? b.id : b.name.charAt(0));

export function CampusMap(props: CampusMapProps) {
  const {
    mode, routePoints, donePoints, position, heading = 0, origin, destination, barriers,
    activeBuildingId, level, destRoomId, height, anchorY = 0.6, title, insetRight = 0, insetTop = 0,
    camera, onCameraChange, onBuildingPress, accessibilityLabel,
  } = props;
  const t = useTheme();
  const m = t.map;
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  // ---- Escena: qué se dibuja según modo/posición
  const posXY = position ? ptPlan(position) : undefined;
  const activeB = BUILDINGS.find((b) => b.id === activeBuildingId);
  const closeupB = useMemo(() => {
    if (mode !== 'closeup' || !position || level === undefined) return undefined;
    return BUILDINGS.find((b) => getFloorPlan(b.id, level) && inPoly([position.x, position.y], b.polygon));
  }, [mode, position, level]);

  const indoorB = mode === 'floor' ? activeB : closeupB;
  const indoorLevel = level ?? 0;
  const plan = indoorB ? (getFloorPlan(indoorB.id, indoorLevel) as { rooms: Room[]; corridors: XY[][] } | undefined) : undefined;
  const noPlan = mode === 'floor' && !!activeB && !plan;

  // ---- Encuadre objetivo
  const anchorPx = mode === 'closeup' ? Math.round(height * anchorY) : height / 2;
  const target = useMemo<View3 | undefined>(() => {
    if (width <= 0) return undefined;
    const macroBox = boundsBox(BOUNDS);
    const macroFit = fitScale(macroBox, width, height, 12);
    const widthFit = (width - 24) / (macroBox.maxX - macroBox.minX || 1);
    const centerOf = (b: Box) => ({ cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2 });
    if (mode === 'closeup' && posXY) {
      return { cx: posXY[0], cy: posXY[1], s: widthFit * CLOSEUP_ZOOM, rot: -heading };
    }
    if (camera && mode !== 'closeup') {
      return { cx: camera.cx, cy: camera.cy, s: macroFit * camera.zoom, rot: 0 };
    }
    if (mode === 'floor' && activeB) {
      const box = bboxPts(activeB.polygon.map(toPlan));
      const usableW = width - insetRight;
      const s = Math.min((usableW * 0.7) / (box.maxX - box.minX || 1), ((height - insetTop) * 0.8) / (box.maxY - box.minY || 1));
      const c = centerOf(box);
      return { cx: c.cx + insetRight / (2 * s), cy: c.cy - insetTop / (2 * s), s, rot: 0 };
    }
    if (routePoints.length >= 2) {
      const box = bboxPts(routePoints.map(toPlan));
      const padX = Math.max(PLAN_W * 0.08, (box.maxX - box.minX) * 0.15);
      const padY = Math.max(PLAN_H * 0.08, (box.maxY - box.minY) * 0.15);
      const padded = { minX: box.minX - padX, minY: box.minY - padY, maxX: box.maxX + padX, maxY: box.maxY + padY };
      const s = Math.min(fitScale(padded, width, height, 12) * 0.85, macroFit * 2.2);
      return { ...centerOf(padded), s, rot: 0 };
    }
    return { ...centerOf(macroBox), s: macroFit * 0.85, rot: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, width, height, insetRight, insetTop, camera?.cx, camera?.cy, camera?.zoom, activeB, posXY?.[0], posXY?.[1], heading, routePoints.length]);

  // ---- Transición suave del encuadre
  const [view, setView] = useState<View3 | undefined>(undefined);
  const viewRef = useRef<View3 | undefined>(undefined);
  const anim = useRef(new Animated.Value(0)).current;
  const modeRef = useRef(mode);

  useEffect(() => {
    if (!target) return;
    const from = viewRef.current;
    if (!from) {
      viewRef.current = target;
      setView(target);
      return;
    }
    let dRot = ((((target.rot - from.rot) % 360) + 540) % 360) - 180;
    const to: View3 = { ...target, rot: from.rot + dRot };
    const modeChanged = modeRef.current !== mode;
    modeRef.current = mode;
    anim.stopAnimation();
    anim.setValue(0);
    const id = anim.addListener(({ value }) => {
      const v: View3 = {
        cx: from.cx + (to.cx - from.cx) * value,
        cy: from.cy + (to.cy - from.cy) * value,
        s: from.s * Math.pow(to.s / from.s, value),
        rot: from.rot + (to.rot - from.rot) * value,
      };
      viewRef.current = v;
      setView(v);
    });
    Animated.timing(anim, {
      toValue: 1,
      duration: modeChanged ? 600 : 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        viewRef.current = to;
        setView(to);
      }
    });
    return () => anim.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.cx, target?.cy, target?.s, target?.rot]);

  // ---- Geometría memoizada
  const routeStr = useMemo(() => routePoints.map((p) => toPlan(p).join(',')).join(' '), [routePoints]);
  const doneStr = useMemo(() => (donePoints ?? []).map((p) => toPlan(p).join(',')).join(' '), [donePoints]);

  // Capa estática: usa escala/rotación "asentadas" (objetivo); el tween solo mueve el transform del grupo
  const sK = target?.s ?? 1;
  const rotQ = Math.round((target?.rot ?? 0) / 3) * 3;
  const layers = useMemo<React.ReactNode[]>(() => {
  const k = 1 / sK;
  const px = (n: number) => n * k;
  const unrot = (x: number, y: number) => `rotate(${-rotQ},${x},${y})`;
  // Etiqueta con halo, contra-rotada y de tamaño constante en pantalla
  const label = (key: string, x: number, y: number, text: string, size: number, fill: string, weight: '600' | '800' = '600') => (
    <G key={key} transform={unrot(x, y)}>
      <SvgText x={x} y={y + px(size) * 0.35} fontSize={px(size)} fontWeight={weight} textAnchor="middle"
        fill={m.halo} stroke={m.halo} strokeWidth={px(3.5)} strokeLinejoin="round">{text}</SvgText>
      <SvgText x={x} y={y + px(size) * 0.35} fontSize={px(size)} fontWeight={weight} textAnchor="middle" fill={fill}>{text}</SvgText>
    </G>
  );

  const areaFill = (kind: string) =>
    ({ green: m.green, patio: m.patio, court: m.court, street: m.street, plaza: m.plaza } as Record<string, string>)[kind] ?? m.plaza;

  const indoor = !!indoorB;
  const dim = indoor || mode === 'floor';

  const layers: React.ReactNode[] = [];

  // Áreas
  AREAS.forEach((a) =>
    layers.push(<Path key={`a-${a.id}`} d={polyD([a.polygon])} fill={areaFill(a.kind)} opacity={dim ? 0.6 : 1} />),
  );
  if (!dim) {
    AREAS.forEach((a) => {
      if (a.labelAt && a.kind !== 'street' && mode !== 'macro') {
        const [x, y] = toPlan(a.labelAt);
        layers.push(label(`al-${a.id}`, x, y, a.name, LABEL_PX, m.roomText));
      }
    });
  }

  // Edificios
  BUILDINGS.forEach((b) => {
    const isActive = b.id === activeBuildingId;
    const isIndoor = indoorB?.id === b.id;
    const fill = isIndoor ? m.building : dim ? m.buildingDim : isActive ? m.buildingActive : m.building;
    layers.push(
      <Path key={`b-${b.id}`} d={polyD([b.polygon, ...(b.holes ?? [])])} fillRule="evenodd" fill={fill}
        stroke={m.outline} strokeWidth={px(isIndoor ? 2 : 1)} strokeLinejoin="round" />,
    );
  });

  // Planta interior
  if (indoorB && plan) {
    plan.corridors.forEach((c, i) =>
      layers.push(<Path key={`c-${i}`} d={polyD([c])} fill={m.corridor} />),
    );
    const kindFill: Record<RoomKind, string> = {
      room: m.room, lab: m.room, wc: m.wc, elevator: m.elevator, stairs: m.stairs, service: m.service,
    };
    plan.rooms.forEach((r) => {
      const isDest = r.id === destRoomId;
      layers.push(
        <Path key={`r-${r.id}`} d={polyD([r.polygon])} strokeLinejoin="round"
          fill={isDest ? m.roomActive : kindFill[r.kind as RoomKind] ?? m.room}
          stroke={isDest ? m.buildingActive : m.outline} strokeWidth={px(isDest ? 2.5 : 1)} />,
      );
    });
    plan.rooms.forEach((r) => {
      const box = bboxPts(r.polygon.map(toPlan));
      const cx = (box.minX + box.maxX) / 2;
      const cy = (box.minY + box.maxY) / 2;
      const wPx = (box.maxX - box.minX) * sK;
      const hPx = (box.maxY - box.minY) * sK;
      if (r.kind === 'elevator' || r.kind === 'stairs') {
        if (wPx < 14 || hPx < 14) return;
        const d = r.kind === 'elevator' ? 'M-4 -1L0 -5L4 -1Z M-4 1L0 5L4 1Z' : 'M-6 5H-2V2H2V-1H6V-4';
        layers.push(
          <G key={`i-${r.id}`} transform={`translate(${cx},${cy}) scale(${k}) rotate(${-rotQ})`}>
            <Path d={d} fill={r.kind === 'elevator' ? m.roomText : 'none'} stroke={m.roomText} strokeWidth={1.8} strokeLinejoin="round" />
          </G>,
        );
        return;
      }
      const digits = r.name.replace(/\D/g, '');
      const candidates = r.kind === 'wc' ? ['WC'] : [r.name, digits].filter((x) => x);
      const txt = candidates.find((c) => c.length * LABEL_PX * 0.62 + 6 <= wPx && hPx >= LABEL_PX + 4);
      if (txt) layers.push(label(`rl-${r.id}`, cx, cy, txt, LABEL_PX, m.roomText, r.id === destRoomId ? '800' : '600'));
    });
  }

  // Letras de edificios (modo exterior)
  if (!indoor && mode !== 'floor') {
    type R = { l: number; t: number; r: number; b: number };
    const hit = (a: R, c: R) => a.l < c.r && a.r > c.l && a.t < c.b && a.b > c.t;
    const placed: R[] = [origin, destination]
      .filter((p): p is Pt => !!p)
      .map((p) => {
        const [x, y] = ptPlan(p);
        return { l: x * sK - 14, t: y * sK - 30, r: x * sK + 14, b: y * sK + 14 };
      });
    const sized = BUILDINGS.map((b) => {
      const bb = bboxPts(b.polygon.map(toPlan));
      const wPx = (bb.maxX - bb.minX) * sK;
      const hPx = (bb.maxY - bb.minY) * sK;
      return { b, area: wPx * hPx, size: Math.max(10, Math.min(22, Math.min(wPx, hPx) * 0.45)) };
    }).sort((a, c) => c.area - a.area);
    sized.forEach(({ b, size }) => {
      const [x, y] = toPlan(b.labelAt);
      const txt = shortLabel(b);
      const w = txt.length * size * 0.7;
      const rect: R = { l: x * sK - w / 2 - 2, t: y * sK - size / 2 - 2, r: x * sK + w / 2 + 2, b: y * sK + size / 2 + 2 };
      if (placed.some((q) => hit(rect, q))) return;
      placed.push(rect);
      const isActive = b.id === activeBuildingId;
      layers.push(
        <G key={`bl-${b.id}`} transform={unrot(x, y)}>
          <SvgText x={x} y={y + px(size) * 0.35} fontSize={px(size)} fontWeight="800" textAnchor="middle"
            fill={isActive ? m.buildingActiveText : m.buildingText}>{txt}</SvgText>
        </G>,
      );
    });
  } else if (mode === 'floor' && indoorB && !plan) {
    const [x, y] = toPlan(indoorB.labelAt);
    layers.push(label('fl-name', x, y, indoorB.name, 12, m.roomText, '800'));
  }

  return layers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sK, rotQ, mode, activeBuildingId, indoorB, plan, destRoomId, m, level, origin, destination]);

  // ---- Gestos (pan / pinch / tap) con cámara manual
  const macroFitG = useMemo(() => fitScale(boundsBox(BOUNDS), width || 1, height, 12), [width, height]);
  const gs = useRef({ cx: 0, cy: 0, s: 1, fx: 0, fy: 0, tx: 0, ty: 0, sc: 1, lx: 0, ly: 0, bx: 0, by: 0, n: 0 }).current;
  const gestureEnabled = !!onCameraChange && mode !== 'closeup';
  /* eslint-disable react-hooks/refs -- los callbacks de gesto leen refs al ejecutarse, no al renderizar */
  const gesture = useMemo(() => {
    const rebase = () => {
      const v = viewRef.current;
      if (!v) return;
      anim.stopAnimation();
      gs.cx = v.cx; gs.cy = v.cy; gs.s = v.s; gs.bx = gs.lx; gs.by = gs.ly;
      gs.tx = 0; gs.ty = 0; gs.sc = 1; gs.fx = 0; gs.fy = 0;
    };
    const apply = () => {
      const s = Math.min(macroFitG * 9, Math.max(macroFitG * 0.9, gs.s * gs.sc));
      const v: View3 = {
        cx: gs.cx + gs.fx / gs.s - (gs.fx + gs.tx) / s,
        cy: gs.cy + gs.fy / gs.s - (gs.fy + gs.ty) / s,
        s,
        rot: 0,
      };
      viewRef.current = v;
      setView(v);
    };
    const start = () => { if (gs.n === 0) { gs.lx = 0; gs.ly = 0; } rebase(); gs.n++; };
    const end = () => {
      gs.n = Math.max(0, gs.n - 1);
      if (gs.n > 0) { rebase(); return; }
      const v = viewRef.current;
      if (v) onCameraChange?.({ cx: v.cx, cy: v.cy, zoom: v.s / macroFitG });
    };
    const pan = Gesture.Pan().runOnJS(true).minDistance(6)
      .onStart(() => { gs.lx = 0; gs.ly = 0; start(); })
      .onUpdate((e) => { gs.lx = e.translationX; gs.ly = e.translationY; gs.tx = gs.lx - gs.bx; gs.ty = gs.ly - gs.by; apply(); })
      .onFinalize((_e, ok) => { if (ok) end(); });
    const pinch = Gesture.Pinch().runOnJS(true)
      .onStart((e) => { start(); gs.fx = e.focalX - width / 2; gs.fy = e.focalY - anchorPx; })
      .onUpdate((e) => { gs.sc = e.scale; gs.tx = gs.lx - gs.bx; gs.ty = gs.ly - gs.by; apply(); })
      .onFinalize((_e, ok) => { if (ok) end(); });
    const tap = Gesture.Tap().runOnJS(true).maxDistance(10)
      .onEnd((e, ok) => {
        const v = viewRef.current;
        if (!ok || !v || !onBuildingPress) return;
        const wx = v.cx + (e.x - width / 2) / v.s;
        const wy = v.cy + (e.y - anchorPx) / v.s;
        const hit = BUILDINGS.find((b) => inPoly([(wx / PLAN_W) * 100, (wy / PLAN_H) * 100], b.polygon));
        if (hit) onBuildingPress(hit.id);
      });
    return Gesture.Race(tap, Gesture.Simultaneous(pan, pinch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [macroFitG, width, anchorPx, onCameraChange, onBuildingPress]);
  /* eslint-enable react-hooks/refs */

  const container = [styles.container, { height, backgroundColor: m.bg }];
  if (!view) return <View style={container} onLayout={onLayout} />;

  const k = 1 / view.s;
  const px = (n: number) => n * k;
  const groupT = `translate(${width / 2},${anchorPx}) rotate(${view.rot}) scale(${view.s}) translate(${-view.cx},${-view.cy})`;

  // Marcadores en el grupo del plano
  const pin = (key: string, p: XY, color: string) => (
    <G key={key} transform={`translate(${p[0]},${p[1]}) scale(${k}) rotate(${-view.rot})`}>
      <Path d="M0 0C-3-8-9-12-9-19A9 9 0 1 1 9-19C9-12 3-8 0 0Z" fill={color} stroke={m.routeCasing} strokeWidth={2} />
      <Circle cx={0} cy={-19} r={3.5} fill={m.routeCasing} />
    </G>
  );

  const posMarker = (transform: string, angle: number, key: string) => (
    <G key={key} transform={transform}>
      <Circle r={18} fill={m.position} opacity={0.22} />
      {(heading !== undefined || mode === 'closeup') && (
        <Path d="M0 -26L-10 -8L10 -8Z" fill={m.position} stroke={m.routeCasing} strokeWidth={1.5} strokeLinejoin="round"
          transform={`rotate(${angle})`} />
      )}
      <Circle r={8} fill={m.position} stroke={m.routeCasing} strokeWidth={3} />
    </G>
  );

  const barrierMarks = (barriers ?? []).map((b, i) => {
    const [x, y] = toPlan([b.x, b.y]);
    return (
      <G key={`bar-${i}`} transform={`translate(${x},${y}) scale(${k}) rotate(${-view.rot})`}>
        <Circle r={11} fill={b.kind === 'incident' ? m.barrier : m.stairsMark} stroke={m.routeCasing} strokeWidth={2} />
        {b.kind === 'incident' ? (
          <SvgText y={5} fontSize={14} fontWeight="800" textAnchor="middle" fill={m.routeCasing === '#000000' ? '#000000' : '#FFFFFF'}>!</SvgText>
        ) : (
          <Path d="M-5 4H-2V1H1V-2H5V-5" stroke={m.routeCasing === '#000000' ? '#000000' : '#FFFFFF'} strokeWidth={1.8} fill="none" />
        )}
      </G>
    );
  });

  const destRoom = indoorB && plan ? plan.rooms.find((r) => r.id === destRoomId) : undefined;
  const destRoomPin = destRoom
    ? (() => {
        const b = bboxPts(destRoom.polygon.map(toPlan));
        return pin('dest-room', [(b.minX + b.maxX) / 2, b.minY], m.pin);
      })()
    : null;

  return (
    <View style={container} onLayout={onLayout} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} accessibilityRole="image">
      <GestureDetector gesture={gesture}>
      <View collapsable={false} style={{ width, height }} pointerEvents={gestureEnabled ? 'auto' : 'none'}>
      <Svg width={width} height={height}>
        <G transform={groupT}>
          {layers}
          {routePoints.length >= 2 && (
            <>
              <Polyline points={routeStr} fill="none" stroke={m.routeCasing} strokeWidth={px(10)} strokeLinecap="round" strokeLinejoin="round" />
              <Polyline points={routeStr} fill="none" stroke={m.route} strokeWidth={px(5.5)} strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
          {donePoints && donePoints.length >= 2 && (
            <Polyline points={doneStr} fill="none" stroke={m.routeDone} strokeWidth={px(5.5)} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {barrierMarks}
          {origin && (
            <G transform={`translate(${ptPlan(origin)[0]},${ptPlan(origin)[1]}) scale(${k})`}>
              <Circle r={8} fill={m.routeCasing} stroke={m.route} strokeWidth={3.5} />
            </G>
          )}
          {destination && !destRoomPin && !indoorB && pin('dest', ptPlan(destination), m.pin)}
          {destRoomPin}
          {position && mode !== 'closeup' &&
            posMarker(`translate(${posXY![0]},${posXY![1]}) scale(${k})`, heading, 'pos')}
        </G>
        {position && mode === 'closeup' && posMarker(`translate(${width / 2},${anchorPx})`, 0, 'pos-fixed')}
      </Svg>
      </View>
      </GestureDetector>
      {title ? (
        <View style={[styles.title, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.sm, left: t.spacing.sm, top: t.spacing.sm, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.xs }]}>
          <AppText variant="caption" style={{ fontSize: 13, lineHeight: 17, fontWeight: '700' }}>{title}</AppText>
        </View>
      ) : null}
      {noPlan ? (
        <View style={[styles.note, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.pill, bottom: t.spacing.sm, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.xs }]}>
          <AppText variant="caption" color="textMuted">Sin plano detallado de este piso</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden' },
  title: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth },
  note: { position: 'absolute', alignSelf: 'center', borderWidth: StyleSheet.hairlineWidth },
});
