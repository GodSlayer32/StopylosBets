import { EDGES, getNode } from '@/lib/routing';
import { floorLabel } from '@/lib/buildings';
import type { EdgeCue, RouteResult } from '@/types';

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
  /** Pista breve de referencia (p. ej. "puerta de vidrio a tu derecha") */
  cue?: string;
  /** Texto optimizado para voz (si difiere de `text`) */
  spoken?: string;
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

/** `partial`: la ruta termina en un punto de encuentro, no en el destino final. */
export function buildManeuvers(route: RouteResult, partial = false): Maneuver[] {
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
    type: 'arrive', verb: partial ? 'el punto de encuentro está frente a ti' : 'tu destino está frente a ti', text: '', atIndex: pts.length - 1,
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
      ? (partial ? 'El punto de encuentro está frente a ti' : 'Tu destino está frente a ti')
      : d < 5 ? capitalize(e.verb) : `En ${d} m, ${e.verb}`;
    out.push({ ...e, distanceM: d, text });
  });
  addCues(out, route, partial);
  return out;
}

// ---------- Referencias físicas (cue / spoken) ----------

const SIDE: Record<string, string> = { left: 'a tu izquierda', right: 'a tu derecha', ahead: 'al frente' };
const FLIP: Record<string, 'left' | 'right' | 'ahead'> = { left: 'right', right: 'left', ahead: 'ahead' };
const CLOCK: Record<string, number> = {
  'turn-right': 3, 'turn-left': 9, 'slight-right': 2, 'slight-left': 10,
};
const meters = (n: number) => `${n} ${n === 1 ? 'metro' : 'metros'}`;
const COUNT = ['', 'un', 'dos', 'tres', 'cuatro'];

/** Hitos de un tramo orientados según el sentido real de marcha. */
function orientedCues(edgeId: string, fromNodeId: string): EdgeCue[] {
  const e = edgeById.get(edgeId);
  if (!e?.cues) return [];
  if (e.from === fromNodeId) return e.cues;
  return e.cues.map((c) => ({
    at: c.at === 'start' ? 'end' : c.at === 'end' ? 'start' : 'mid',
    side: c.side ? FLIP[c.side] : undefined,
    text: c.text,
  }));
}

const shortPhrase = (c: EdgeCue) => (c.side && c.side !== 'ahead' ? `con ${c.text} ${SIDE[c.side]}` : c.side ? `${c.text} ${SIDE.ahead}` : c.text);

function addCues(out: Maneuver[], route: RouteResult, partial = false) {
  const segEdges = route.steps.flatMap((s) => s.edgeIds);
  const nSeg = route.polyline.length - 1;
  for (let k = 0; k < out.length; k++) {
    const m = out[k];
    const next = out[k + 1];
    const a = m.atIndex;
    const b = next ? next.atIndex : nSeg;
    const leg: EdgeCue[] = [];
    const legByEdge: EdgeCue[][] = [];
    for (let s = a; s < b && s < segEdges.length; s++) {
      const cs = orientedCues(segEdges[s], route.nodeIds[s]);
      legByEdge.push(cs);
      leg.push(...cs);
    }
    const lastEdge = legByEdge[legByEdge.length - 1] ?? [];
    const rank = { start: 0, mid: 1, end: 2 } as const;
    const sided = leg.filter((c) => c.side === 'left' || c.side === 'right').sort((x, y) => rank[x.at] - rank[y.at])[0];
    const texture = leg.filter((c) => !c.side && c.at !== 'end')[0];
    const endCue = lastEdge.filter((c) => c.at === 'end' && c.text !== sided?.text)[0];
    const lead = m.distanceM >= 5 && m.type !== 'straight' ? `En ${meters(m.distanceM)}, ` : '';
    const node = getNode(route.nodeIds[a]);
    const arrival = node?.arrivalCue;
    const first = (s: string) => s.split(';')[0];
    const nat = (s: string) => capitalize(s);
    const where = endCue?.side === 'ahead' ? 'al frente, ' : endCue?.side ? `${SIDE[endCue.side]}, ` : '';
    const endPart = endCue ? `Al final, ${where}${endCue.text}.` : '';
    const along = sided ? shortPhrase(sided) : '';
    const noticed = !sided && texture ? `Notarás que ${texture.text}.` : '';
    const clean = (s: string) => s.replace(/\.\./g, '.').replace(/\s+/g, ' ').replace(/ \./g, '.').trim();

    if (m.type === 'arrive') {
      const label = getNode(route.nodeIds[route.nodeIds.length - 1])?.label;
      m.spoken = clean(partial
        ? `Llegaste al punto de encuentro${label ? `, ${label}` : ''}.${arrival ? ` ${nat(arrival)}.` : ''}`
        : `Llegaste a ${label ?? 'tu destino'}.${arrival ? ` ${nat(arrival)}.` : ' Tu destino está frente a ti.'}`);
      if (arrival) m.cue = first(arrival);
      continue;
    }
    if (m.type === 'elevator') {
      const inside = leg.find((c) => !c.side && /botonera/i.test(c.text));
      m.spoken = clean(`${nat(lead + m.verb)}.${arrival ? ` ${nat(arrival)}.` : ''}${inside ? ` ${nat(inside.text)}.` : ''}`);
      m.cue = inside ? inside.text : arrival ? first(arrival) : undefined;
      continue;
    }
    if (m.type === 'enter') {
      m.spoken = clean(`${nat(lead + m.verb)}.${arrival ? ` ${nat(arrival)}.` : ''}`);
      if (arrival) m.cue = first(arrival);
      continue;
    }
    const isStairs = m.icon.startsWith('stairs');
    if (isStairs || m.icon.startsWith('slope')) {
      const up = m.type === 'ramp-up';
      const edges = segEdges.slice(a, b).map((id) => edgeById.get(id));
      if (isStairs) {
        const n = edges.reduce((t, e) => t + (e?.steps ?? 0), 0);
        const flights = edges.filter((e) => e?.type === 'stairs').length;
        const rail = sided && /baranda/i.test(sided.text) ? sided : leg.find((c) => /baranda/i.test(c.text) && c.side);
        const yellow = leg.some((c) => /borde amarillo/i.test(c.text));
        const size = n ? ` de ${n} peldaños${flights > 1 ? ` en ${COUNT[flights] ?? flights} tramos` : ''}` : '';
        const railTxt = rail?.side ? `baranda ${rail.side === 'left' ? 'a la izquierda' : 'a la derecha'}` : '';
        const yellowTxt = yellow ? 'primer y último peldaño con borde amarillo' : '';
        m.spoken = clean(
          `${nat(lead + (up ? 'sube' : 'baja'))} por la escalera${size}.${railTxt ? ` ${nat(railTxt)}.` : ''}${yellowTxt ? ` ${nat(yellowTxt)}.` : ''}`,
        );
        m.cue = [railTxt, yellowTxt].filter(Boolean).join(', ') || undefined;
      } else {
        const len = Math.round(edges.reduce((t, e) => t + (e?.type === 'ramp' ? e.distanceM : 0), 0));
        const pct = Math.max(0, ...edges.map((e) => e?.slopePct ?? 0));
        const slope = pct > 0 ? `, con pendiente ${slopeLabel(pct)}` : '';
        m.spoken = clean(`${nat(lead + (up ? 'sube' : 'baja'))} por la rampa de ${meters(len)}${slope}${along ? `${slope ? ' y' : ','} ${along}` : ''}. ${noticed} ${endPart}`);
        m.cue = sided ? shortPhrase(sided) : texture?.text;
      }
      continue;
    }
    // Tramos a pie: recto, giros, salidas
    const isTurn = m.type !== 'straight' && m.type !== 'exit';
    const hour = m.verb === 'da la vuelta' ? 6 : CLOCK[m.type];
    const action = m.type === 'straight'
      ? `Sigue recto ${meters(m.distanceM)}`
      : `${nat(lead + m.verb)}${isTurn && hour ? `, hacia las ${hour}` : ''}.`;
    m.spoken = m.type === 'straight'
      ? clean(`${action}${along ? `, ${along}` : ''}. ${noticed} ${endPart}`)
      : clean(`${action} ${along ? `Sigue ${along}.` : ''} ${noticed} ${endPart}`);
    m.cue = sided ? shortPhrase(sided) : texture?.text;
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Zona legible de un nodo: node.zone si existe; si no, edificio y piso, o la etiqueta. */
export function zoneOfNode(nodeId: string): string {
  const n = getNode(nodeId) as ({ zone?: string } & NonNullable<ReturnType<typeof getNode>>) | undefined;
  if (!n) return '';
  if (n.zone) return n.zone;
  return n.building ? `Edificio ${n.building} · ${floorLabel(n.floor ?? 1)}` : n.label;
}
