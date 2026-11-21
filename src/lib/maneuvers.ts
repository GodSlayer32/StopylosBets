import { EDGES, getNode } from '@/lib/routing';
import type { RouteResult } from '@/types';

const IMG_W = 1313;
const IMG_H = 980;

export type ManeuverType =
  | 'straight' | 'turn-left' | 'turn-right' | 'slight-left' | 'slight-right'
  | 'ramp-up' | 'ramp-down' | 'elevator' | 'enter' | 'exit' | 'arrive';

export type Maneuver = {
  type: ManeuverType;
  /** Frase completa y autónoma, p. ej. "En 40 m, gira a la derecha" */
  text: string;
  /** Solo la acción, p. ej. "gira a la derecha" (para componer "En X m" + acción) */
  verb: string;
  /**
   * Metros desde la maniobra anterior (o el inicio) hasta esta.
   * Excepción: la maniobra inicial 'straight' guarda el largo del primer tramo.
   */
  distanceM: number;
  /** Índice del punto de la polilínea donde ocurre */
  atIndex: number;
  level?: number;
  /** Nombre de MaterialCommunityIcons */
  icon: string;
};

const edgeById = new Map(EDGES.map((e) => [e.id, e]));

type Kind = 'walk' | 'ramp' | 'stairs' | 'elevator';

const TURN_ICON: Record<string, string> = {
  'turn-left': 'arrow-left', 'turn-right': 'arrow-right',
  'slight-left': 'arrow-top-left', 'slight-right': 'arrow-top-right',
};

const buildingName = (b?: string) => (b ? `Edificio ${b}` : 'el edificio');

function norm(a: number) {
  let d = a % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function turnOf(delta: number): { type: ManeuverType; verb: string; icon: string } | null {
  const a = Math.abs(delta);
  if (a < 25) return null;
  const left = delta < 0;
  if (a > 150) return { type: left ? 'turn-left' : 'turn-right', verb: 'da la vuelta', icon: 'arrow-u-down-left' };
  if (a >= 60) {
    const type = left ? 'turn-left' : 'turn-right';
    return { type, verb: `gira a la ${left ? 'izquierda' : 'derecha'}`, icon: TURN_ICON[type] };
  }
  const type = left ? 'slight-left' : 'slight-right';
  return { type, verb: `gira ligeramente a la ${left ? 'izquierda' : 'derecha'}`, icon: TURN_ICON[type] };
}

export function slopeLabel(pct: number) {
  return pct <= 6 ? 'suave' : pct <= 8 ? 'moderada' : 'empinada';
}

/** Metros acumulados en cada punto de la polilínea. */
export function cumulativeMeters(route: RouteResult): number[] {
  const cum = [0];
  route.steps.forEach((s) => s.edgeIds.forEach(() => cum.push(cum[cum.length - 1] + s.distanceM / s.edgeIds.length)));
  while (cum.length < route.polyline.length) cum.push(cum[cum.length - 1]);
  return cum;
}

export function buildManeuvers(route: RouteResult): Maneuver[] {
  const pts = route.polyline;
  const nSeg = pts.length - 1;
  if (nSeg < 1) return [];
  const cum = cumulativeMeters(route);

  // Rumbo (grados, 0 = norte, horario) y tipo de cada tramo
  const heading: (number | null)[] = [];
  for (let i = 0; i < nSeg; i++) {
    const dx = ((pts[i + 1].x - pts[i].x) / 100) * IMG_W;
    const dy = ((pts[i + 1].y - pts[i].y) / 100) * IMG_H;
    heading.push(Math.hypot(dx, dy) > 0.5 ? (Math.atan2(dx, -dy) * 180) / Math.PI : null);
  }
  const kind: Kind[] = [];
  route.steps.forEach((s) =>
    s.edgeIds.forEach(() =>
      kind.push(s.type === 'elevator' ? 'elevator' : s.type === 'stairs' ? 'stairs' : s.type === 'ramp' ? 'ramp' : 'walk'),
    ),
  );
  while (kind.length < nSeg) kind.push('walk');

  const events: Omit<Maneuver, 'distanceM'>[] = [];
  const push = (m: Omit<Maneuver, 'distanceM'>) => events.push(m);
  let ref: number | null = null; // rumbo de referencia (último tramo a pie)

  let i = 0;
  while (i < nSeg) {
    const k = kind[i];
    const from = getNode(route.nodeIds[i]);
    if (k === 'elevator' || k === 'ramp' || k === 'stairs') {
      let j = i;
      while (j + 1 < nSeg && kind[j + 1] === k) j++;
      const end = getNode(route.nodeIds[j + 1]);
      const len = Math.round(cum[j + 1] - cum[i]);
      const down = !!end?.floor && !!from?.floor && end.floor < from.floor;
      if (k === 'elevator') {
        const lvl = end?.floor;
        const verb = lvl ? `toma el ascensor al piso ${lvl}` : 'toma el ascensor';
        push({ type: 'elevator', verb, text: '', atIndex: i, level: lvl, icon: 'elevator-passenger' });
      } else if (k === 'ramp') {
        const pcts = route.steps.flatMap((s) => s.edgeIds).slice(i, j + 1).map((id) => edgeById.get(id)?.slopePct ?? 0);
        const pct = Math.max(0, ...pcts);
        const tail = pct > 0 ? `${len} m, ${slopeLabel(pct)}` : `${len} m`;
        push({
          type: down ? 'ramp-down' : 'ramp-up', verb: `${down ? 'baja' : 'sube'} por la rampa (${tail})`, text: '',
          atIndex: i, level: end?.floor, icon: down ? 'slope-downhill' : 'slope-uphill',
        });
      } else {
        const steps = route.steps.flatMap((s) => s.edgeIds).slice(i, j + 1).reduce((s, id) => s + (edgeById.get(id)?.steps ?? 0), 0);
        const what = steps ? `${steps} escalones` : 'la escalera';
        push({
          type: down ? 'ramp-down' : 'ramp-up', verb: `${down ? 'baja' : 'sube'} ${what}`, text: '',
          atIndex: i, level: end?.floor, icon: down ? 'stairs-down' : 'stairs-up',
        });
      }
      ref = null;
      i = j + 1;
      continue;
    }
    // Tramo a pie
    const h = heading[i];
    const bPrev = from?.building;
    if (i > 0) {
      const prevB = getNode(route.nodeIds[i - 1])?.building;
      if (bPrev !== prevB) {
        push(bPrev
          ? { type: 'enter', verb: `entra al ${buildingName(bPrev)}`, text: '', atIndex: i, level: from?.floor, icon: 'door-open' }
          : { type: 'exit', verb: `sal del ${buildingName(prevB)}`, text: '', atIndex: i, icon: 'exit-run' });
        ref = h ?? ref;
        i++;
        continue;
      }
    }
    if (h !== null) {
      if (ref !== null) {
        const t = turnOf(norm(h - ref));
        if (t) push({ ...t, text: '', atIndex: i });
      }
      ref = h;
    }
    i++;
  }

  // Llegada
  const last = getNode(route.nodeIds[route.nodeIds.length - 1]);
  push({
    type: 'arrive', verb: 'tu destino está frente a ti', text: '', atIndex: pts.length - 1,
    level: last?.floor, icon: 'flag-checkered',
  });

  // Maniobra inicial "Sigue recto" salvo que el primer evento ocurra en el punto 0
  const out: Maneuver[] = [];
  if (events[0].atIndex > 0) {
    const d = Math.round(cum[events[0].atIndex]);
    out.push({ type: 'straight', verb: 'sigue recto', text: `Sigue recto ${d} m`, distanceM: d, atIndex: 0, icon: 'arrow-up' });
  }
  let prevCum = 0;
  events.forEach((e) => {
    const d = Math.max(0, Math.round(cum[e.atIndex] - prevCum));
    prevCum = cum[e.atIndex];
    const text = e.type === 'arrive'
      ? 'Tu destino está frente a ti'
      : d < 5 ? capitalize(e.verb) : `En ${d} m, ${e.verb}`;
    out.push({ ...e, distanceM: d, text });
  });
  return out;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Zona legible de un nodo: node.zone si existe; si no, edificio y piso, o la etiqueta. */
export function zoneOfNode(nodeId: string): string {
  const n = getNode(nodeId) as ({ zone?: string } & NonNullable<ReturnType<typeof getNode>>) | undefined;
  if (!n) return '';
  if (n.zone) return n.zone;
  return n.building ? `Edificio ${n.building} · Piso ${n.floor ?? 1}` : n.label;
}
