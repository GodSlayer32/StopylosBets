import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildManeuvers, cumulativeMeters, zoneOfNode, type Maneuver } from '@/lib/maneuvers';
import { amenitiesAlongRoute, nextAmenitiesWithin } from '@/lib/amenities';
import { getNode } from '@/lib/routing';
import type { RouteAmenity, RouteResult } from '@/types';

const IMG_W = 1313;
const IMG_H = 980;
/** Duración total de la simulación (demo) */
const TOTAL_SECONDS = 27;
/** Segundos que dura un tramo de ascensor */
const ELEVATOR_SECONDS = 4.5;
const TICK_MS = 66;
/** Distancia máxima a la que se avisa del próximo servicio */
const AMENITY_ALERT_M = 60;

type Pt = { x: number; y: number };
const toPx = (p: Pt): Pt => ({ x: (p.x / 100) * IMG_W, y: (p.y / 100) * IMG_H });

export type SimState = {
  stepIndex: number;
  /** Posición actual en % del plano */
  point: Pt;
  /** Grados 0-360; 0 = norte (arriba del plano), sentido horario */
  heading: number;
  /** Índice del tramo (segmento de polilínea) actual */
  segIndex: number;
  nodeId: string;
  building?: string;
  level?: number;
  /** true si el paso actual ocurre dentro de un edificio o ascensor */
  inside: boolean;
  /** 0..1 avance dentro del paso actual */
  stepProgress: number;
  /** 0..1 avance sobre toda la ruta */
  progress: number;
  /** Metros que faltan */
  remainingM: number;
  /** Maniobras de la ruta (estilo GPS) */
  maneuvers: Maneuver[];
  /** Índice de la maniobra próxima (la que se muestra) */
  maneuverIndex: number;
  currentManeuver: Maneuver | null;
  nextManeuver: Maneuver | null;
  /** Metros que faltan hasta ejecutar la maniobra próxima (en vivo) */
  distanceToManeuverM: number;
  /** Servicios (uno por tipo) a ≤60 m por delante, más cercano primero */
  nextAmenities: (RouteAmenity & { distM: number })[];
  /** Zona legible del nodo más cercano */
  zone: string;
  playing: boolean;
  finished: boolean;
  next: () => void;
  prev: () => void;
  play: () => void;
  pause: () => void;
};

export function useRouteSimulation(route: RouteResult | null): SimState {
  const geo = useMemo(() => {
    if (!route) return null;
    const pts = route.polyline;
    // primer segmento de cada paso
    const stepStartSeg: number[] = [];
    const stepOfSeg: number[] = [];
    let seg = 0;
    route.steps.forEach((s, si) => {
      stepStartSeg.push(seg);
      for (let k = 0; k < s.edgeIds.length; k++) stepOfSeg[seg + k] = si;
      seg += s.edgeIds.length;
    });
    const lens: number[] = [];
    const headings: number[] = [];
    let lastHeading = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = toPx(pts[i]);
      const b = toPx(pts[i + 1]);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      lens.push(len);
      if (len > 0.5) lastHeading = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;
      headings.push(lastHeading);
    }
    const firstReal = headings.find((_, i) => lens[i] > 0.5) ?? 0;
    for (let i = 0; i < headings.length && lens[i] <= 0.5; i++) headings[i] = firstReal;
    // Pesos en segundos: ascensor fijo, caminata reparte el resto
    const isElev = lens.map((_, i) => route.steps[stepOfSeg[i]]?.type === 'elevator');
    const nElev = isElev.filter(Boolean).length;
    const walkTotal = lens.reduce((sum, l, i) => sum + (isElev[i] ? 0 : l), 0) || 1;
    const walkSeconds = Math.max(8, TOTAL_SECONDS - nElev * ELEVATOR_SECONDS);
    const weights = lens.map((l, i) => (isElev[i] ? ELEVATOR_SECONDS : Math.max(0.3, (l / walkTotal) * walkSeconds)));
    const edgeM = route.steps.flatMap((s) => s.edgeIds.map(() => s.distanceM / s.edgeIds.length));
    const cum = [0];
    weights.forEach((w) => cum.push(cum[cum.length - 1] + w));
    const maneuvers = buildManeuvers(route);
    const ptM = cumulativeMeters(route);
    return { pts, weights, headings, cum, total: cum[cum.length - 1], stepStartSeg, stepOfSeg, edgeM, maneuvers, ptM };
  }, [route]);

  const amenities = useMemo(() => (route ? amenitiesAlongRoute(route) : []), [route]);

  const [prog, setProg] = useState(0); // en unidades de peso
  const [playing, setPlaying] = useState(false);
  const progRef = useRef(0);
  const setP = useCallback((v: number) => {
    progRef.current = v;
    setProg(v);
  }, []);

  const total = geo?.total ?? 0;
  const finished = !!geo && prog >= total - 0.01;

  useEffect(() => {
    if (!playing || !geo) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const next = Math.min(geo.total, progRef.current + ((now - last) / 1000) * 1);
      last = now;
      setP(next);
      if (next >= geo.total) setPlaying(false);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, geo, setP]);

  const segAt = useCallback(
    (p: number) => {
      if (!geo) return 0;
      let k = 0;
      while (k < geo.weights.length - 1 && geo.cum[k + 1] <= p) k++;
      return k;
    },
    [geo],
  );

  const stepIndexOf = useCallback(
    (p: number) => (geo && geo.stepOfSeg.length ? geo.stepOfSeg[segAt(p)] ?? 0 : 0),
    [geo, segAt],
  );

  const goStep = useCallback(
    (i: number) => {
      if (!geo || !route) return;
      setPlaying(false);
      if (i >= route.steps.length) return setP(geo.total);
      const s = Math.max(0, i);
      setP(geo.cum[geo.stepStartSeg[s]]);
    },
    [geo, route, setP],
  );

  const next = useCallback(() => goStep(finished ? 0 : stepIndexOf(progRef.current) + 1), [goStep, finished, stepIndexOf]);
  const prev = useCallback(() => {
    if (!geo) return;
    const cur = stepIndexOf(progRef.current);
    // Si ya avanzó dentro del paso, vuelve a su inicio; si no, al anterior.
    const atStart = progRef.current - geo.cum[geo.stepStartSeg[cur]] < 1 && !finished;
    goStep(finished ? cur : atStart ? cur - 1 : cur);
  }, [geo, finished, goStep, stepIndexOf]);
  const play = useCallback(() => {
    if (!geo) return;
    if (progRef.current >= geo.total - 0.01) setP(0);
    setPlaying(true);
  }, [geo, setP]);
  const pause = useCallback(() => setPlaying(false), []);

  return useMemo<SimState>(() => {
    if (!geo || !route || geo.weights.length === 0) {
      return {
        stepIndex: 0, point: { x: 50, y: 50 }, heading: 0, segIndex: 0, nodeId: '', inside: false, stepProgress: 0, progress: 0,
        remainingM: 0, maneuvers: [], maneuverIndex: 0, currentManeuver: null, nextManeuver: null, distanceToManeuverM: 0,
        nextAmenities: [], zone: '', playing: false, finished: false, next, prev, play, pause,
      };
    }
    const k = segAt(prog);
    const frac = Math.min(1, Math.max(0, (prog - geo.cum[k]) / geo.weights[k]));
    const a = geo.pts[k];
    const b = geo.pts[k + 1];
    const point = { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
    const nodeId = route.nodeIds[frac >= 0.5 ? k + 1 : k];
    const node = getNode(nodeId);
    const stepIndex = finished ? route.steps.length - 1 : geo.stepOfSeg[k] ?? 0;
    const step = route.steps[stepIndex];
    const inside =
      step.type === 'elevator' || !!getNode(route.nodeIds[k])?.building || !!getNode(route.nodeIds[k + 1])?.building;
    const sStart = geo.cum[geo.stepStartSeg[stepIndex]];
    const sEnd = geo.cum[stepIndex + 1 < route.steps.length ? geo.stepStartSeg[stepIndex + 1] : geo.weights.length];
    const stepProgress = finished ? 1 : Math.min(1, Math.max(0, (prog - sStart) / Math.max(1, sEnd - sStart)));
    let done = 0;
    for (let i = 0; i < k; i++) done += geo.edgeM[i] ?? 0;
    done += (geo.edgeM[k] ?? 0) * frac;
    const ms = geo.maneuvers;
    let mi = ms.length - 1;
    if (!finished && ms.length) {
      if (step.type === 'elevator') {
        // Dentro del ascensor se mantiene "Toma el ascensor"
        const e = ms.findIndex((m, idx) => m.type === 'elevator' && m.atIndex <= k && (ms[idx + 1]?.atIndex ?? Infinity) > k);
        mi = e >= 0 ? e : mi;
      } else {
        const found = ms.findIndex((m) => geo.ptM[m.atIndex] >= done - 1.5);
        mi = found >= 0 ? found : mi;
      }
    }
    const cur = ms[mi] ?? null;
    return {
      maneuvers: ms,
      maneuverIndex: mi,
      currentManeuver: cur,
      nextManeuver: ms[mi + 1] ?? null,
      distanceToManeuverM: cur && !finished ? Math.max(0, Math.round(geo.ptM[cur.atIndex] - done)) : 0,
      nextAmenities: finished ? [] : nextAmenitiesWithin(amenities, done, AMENITY_ALERT_M),
      zone: zoneOfNode(nodeId),
      stepIndex,
      point,
      heading: geo.headings[k],
      segIndex: k,
      nodeId,
      building: node?.building,
      level: node?.floor,
      inside,
      stepProgress,
      progress: geo.total ? prog / geo.total : 0,
      remainingM: Math.max(0, Math.round(route.distanceM - done)),
      playing,
      finished,
      next, prev, play, pause,
    };
  }, [geo, route, amenities, prog, playing, finished, segAt, next, prev, play, pause]);
}
