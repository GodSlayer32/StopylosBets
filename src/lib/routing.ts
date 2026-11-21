import nodesJson from '../data/nodes.json';
import edgesJson from '../data/edges.json';
import placesJson from '../data/places.json';
import elevatorsJson from '../data/elevators.json';
import type {
  AvoidedItem, Edge, Elevator, EdgeType, Incident, Node, Place, Profile,
  NoRouteDiagnosis, PartialRoute, RouteComparison, RouteResult, RouteStep, WheelchairChecks,
} from '../types';

export const NODES = nodesJson.nodes as Node[];
export const EDGES = edgesJson.edges as Edge[];
export const PLACES = placesJson.places as Place[];
export const BASE_ELEVATORS = elevatorsJson.elevators as Elevator[];

const nodeById = new Map(NODES.map((n) => [n.id, n]));
const edgeById = new Map(EDGES.map((e) => [e.id, e]));
const adjacency = new Map<string, { edge: Edge; to: string }[]>();
for (const e of EDGES) {
  if (!adjacency.has(e.from)) adjacency.set(e.from, []);
  if (!adjacency.has(e.to)) adjacency.set(e.to, []);
  adjacency.get(e.from)!.push({ edge: e, to: e.to });
  adjacency.get(e.to)!.push({ edge: e, to: e.from });
}

export const getNode = (id: string) => nodeById.get(id);
export const getPlace = (id: string) => PLACES.find((p) => p.id === id);

/** Velocidad de marcha en m/s por perfil */
export const SPEED: Record<Profile, number> = {
  crutches: 0.7, wheelchair: 1.0, lowVision: 0.9, none: 1.3,
};
const ELEVATOR_WAIT_S = 25;
/** Multiplicador de costo de un tramo a la intemperie cuando llueve */
const RAIN_PENALTY = 2;
const SECONDS_PER_STEP: Record<Profile, number> = {
  crutches: 3, wheelchair: 3, lowVision: 1.8, none: 0.8,
};

interface Blocks {
  edges: Set<string>;
  elevators: Set<string>;
  slowEdges: Set<string>;
  /** Con lluvia se penalizan los tramos sin techo */
  raining: boolean;
  /** Silla de ruedas con acompañante: acepta más pendiente porque alguien empuja */
  assisted: boolean;
}

/**
 * Reglas de silla de ruedas (criterios de accesibilidad universal, p. ej. DS 50 / NCh 3269):
 * - Autónoma: pendiente sostenida <= 6% (tramos > 15 m), tramos cortos <= 8% (<= 15 m).
 * - Con acompañante: hasta 10% sostenido (alguien empuja).
 * - Sin escalones ni soleras sin rebaje (curbCut === false).
 * - Puertas con ancho libre >= 80 cm.
 * - Ascensor con cabina >= 110 x 140 cm.
 * Muletas mantiene su regla propia (sin escaleras, pendiente <= 10%).
 */
export const WC_RULES = {
  sustainedMaxPct: 6, shortMaxPct: 8, shortLenM: 15, assistedMaxPct: 10,
  doorMinCm: 80, cabinWidthCm: 110, cabinDepthCm: 140,
} as const;

const elevatorById = new Map(BASE_ELEVATORS.map((el) => [el.id, el]));

function cabinOk(elevatorId?: string): boolean {
  const c = elevatorId ? elevatorById.get(elevatorId)?.cabinCm : undefined;
  return !c || (c.widthCm >= WC_RULES.cabinWidthCm && c.depthCm >= WC_RULES.cabinDepthCm);
}

/** Pendiente máxima que una silla autónoma tolera en este tramo. */
function wcSlopeLimit(e: Edge): number {
  return e.distanceM > WC_RULES.shortLenM ? WC_RULES.sustainedMaxPct : WC_RULES.shortMaxPct;
}

/** true si el tramo exige ayuda: pasa con acompañante pero no de forma autónoma. */
function needsHelp(e: Edge): boolean {
  return (e.type === 'slope' || e.type === 'ramp') && (e.slopePct ?? 0) > wcSlopeLimit(e);
}

/** true si la silla de ruedas puede usar el tramo. */
function wheelchairOk(e: Edge, assisted: boolean): boolean {
  if (e.type === 'stairs') return false;
  if (e.curbCut === false) return false;
  if (e.widthCm !== undefined && e.widthCm < WC_RULES.doorMinCm) return false;
  if (e.type === 'elevator' && !cabinOk(e.elevatorId)) return false;
  if (e.type === 'slope' || e.type === 'ramp') {
    const slope = e.slopePct ?? 0;
    return assisted ? slope <= WC_RULES.assistedMaxPct : slope <= wcSlopeLimit(e);
  }
  return true;
}

function buildBlocks(incidents: Incident[], elevators: Elevator[], raining = false, assisted = false): Blocks {
  const b: Blocks = { edges: new Set(), elevators: new Set(), slowEdges: new Set(), raining, assisted };
  for (const el of elevators) if (el.status === 'down') b.elevators.add(el.id);
  for (const inc of incidents) {
    if (inc.type === 'elevator' && inc.elevatorId) b.elevators.add(inc.elevatorId);
    if (inc.blocksRoute) {
      if (inc.edgeId) b.edges.add(inc.edgeId);
      if (inc.nodeId) {
        for (const e of EDGES) if (e.from === inc.nodeId || e.to === inc.nodeId) b.edges.add(e.id);
      }
    } else if (inc.edgeId) b.slowEdges.add(inc.edgeId);
  }
  return b;
}

function isBlocked(e: Edge, b: Blocks): boolean {
  return b.edges.has(e.id) || (e.type === 'elevator' && !!e.elevatorId && b.elevators.has(e.elevatorId));
}

/** Costo de un tramo para un perfil; null = excluido. */
function edgeCost(e: Edge, profile: Profile, b: Blocks): number | null {
  if (isBlocked(e, b)) return null;
  const d = e.distanceM;
  const slope = e.slopePct ?? 0;
  let cost = d;
  switch (profile) {
    case 'none':
      break;
    case 'crutches':
      if (e.type === 'stairs') return null;
      if (e.type === 'slope') {
        if (slope > 10) return null;
        cost = d * (1 + slope / 3);
      }
      break;
    case 'wheelchair':
      if (!wheelchairOk(e, b.assisted)) return null;
      if (e.type === 'slope') cost = d * (1 + slope / 3);
      break;
    case 'lowVision':
      if (e.type === 'stairs') cost = d + 25 + (e.steps ?? 0) * 2;
      else if (e.type === 'slope') cost = d * (1 + slope / 10);
      if (!e.covered && e.type !== 'elevator') cost *= 1.15;
      break;
  }
  if (b.slowEdges.has(e.id)) cost *= 1.5;
  if (b.raining && !e.covered) cost *= RAIN_PENALTY;
  return cost;
}

function edgeSeconds(e: Edge, profile: Profile): number {
  let speed = SPEED[profile];
  if (e.type === 'slope' || e.type === 'ramp') speed *= 1 - (e.slopePct ?? 0) / 30;
  let t = e.distanceM / speed;
  if (e.type === 'stairs') t += (e.steps ?? 0) * SECONDS_PER_STEP[profile];
  if (e.type === 'elevator') t += ELEVATOR_WAIT_S;
  return t;
}

type Tree = { dist: Map<string, number>; prev: Map<string, { node: string; edge: Edge }> };

/**
 * Dijkstra desde un nodo. Sin `stopAt` recorre todo lo alcanzable, que es lo que
 * permite responder "hasta donde se puede llegar" cuando no hay ruta completa.
 */
function explore(originId: string, profile: Profile, b: Blocks, stopAt?: string): Tree {
  const dist = new Map<string, number>([[originId, 0]]);
  const prev = new Map<string, { node: string; edge: Edge }>();
  const done = new Set<string>();
  const queue: [number, string][] = [[0, originId]];
  while (queue.length) {
    queue.sort((a, c) => a[0] - c[0]);
    const [d, u] = queue.shift()!;
    if (done.has(u)) continue;
    done.add(u);
    if (stopAt !== undefined && u === stopAt) break;
    for (const { edge, to } of adjacency.get(u) ?? []) {
      const c = edgeCost(edge, profile, b);
      if (c === null || done.has(to)) continue;
      const nd = d + c;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, { node: u, edge });
        queue.push([nd, to]);
      }
    }
  }
  return { dist, prev };
}

/** Rearma el camino origen -> destino a partir del arbol de `explore`. */
function pathTo(prev: Tree['prev'], originId: string, destId: string) {
  const edges: Edge[] = [];
  const nodeIds = [destId];
  let cur = destId;
  while (cur !== originId) {
    const p = prev.get(cur)!;
    edges.unshift(p.edge);
    nodeIds.unshift(p.node);
    cur = p.node;
  }
  return { nodeIds, edges };
}

/** Dijkstra sobre el grafo; devuelve aristas recorridas o null. */
export function dijkstra(
  originId: string, destId: string, profile: Profile, b: Blocks,
): { nodeIds: string[]; edges: Edge[] } | null {
  if (!nodeById.has(originId) || !nodeById.has(destId)) return null;
  const { prev } = explore(originId, profile, b, destId);
  if (!prev.has(destId) && originId !== destId) return null;
  return pathTo(prev, originId, destId);
}

/**
 * Escala del plano. Los nodos estan en unidades de 0 a 100 y los tramos en
 * metros, asi que la equivalencia se deduce de los propios datos: la mediana de
 * metros por unidad sobre los tramos horizontales.
 */
const METERS_PER_UNIT = (() => {
  const r: number[] = [];
  for (const e of EDGES) {
    const a = nodeById.get(e.from);
    const b = nodeById.get(e.to);
    if (!a || !b || e.type === 'elevator') continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d > 0.3) r.push(e.distanceM / d);
  }
  r.sort((x, y) => x - y);
  return r.length ? r[Math.floor(r.length / 2)] : 1;
})();

/** Metros por piso, para que dos nodos superpuestos no queden "a 0 m". */
const FLOOR_M = 4;

/** Distancia en linea recta entre dos nodos, en metros. */
export function straightMeters(aId: string, bId: string): number {
  const a = nodeById.get(aId);
  const b = nodeById.get(bId);
  if (!a || !b) return 0;
  const plano = Math.hypot(a.x - b.x, a.y - b.y) * METERS_PER_UNIT;
  return plano + Math.abs((a.floor ?? 1) - (b.floor ?? 1)) * FLOOR_M;
}

/**
 * Cuando no hay ninguna ruta: la ruta hasta el punto alcanzable que queda mas
 * cerca del destino. Llegar a 30 m de la puerta y pedir ayuda ahi no es lo
 * mismo que quedarse en la entrada del campus sin nada.
 */
export function findNearestReachable(
  origin: string, destPlaceId: string, profile: Profile,
  incidents: Incident[] = [], elevators: Elevator[] = BASE_ELEVATORS, raining = false, assisted = false,
): PartialRoute | null {
  const place = getPlace(destPlaceId);
  if (!place || !nodeById.has(origin) || !nodeById.has(place.nodeId)) return null;
  const dest = place.nodeId;
  const b = buildBlocks(incidents, elevators, raining, assisted);
  const { dist, prev } = explore(origin, profile, b);
  let best: string | null = null;
  let bestM = Infinity;
  for (const id of dist.keys()) {
    if (id === dest) continue;
    const m = straightMeters(id, dest);
    const mejorCamino = (dist.get(id) ?? Infinity) < (best ? dist.get(best) ?? Infinity : Infinity);
    if (m < bestM - 0.5 || (m < bestM + 0.5 && mejorCamino)) {
      best = id;
      bestM = m;
    }
  }
  if (!best) return null;
  const path = pathTo(prev, origin, best);
  return {
    route: toResult(profile, destPlaceId, path, elevators, [], 0, assisted),
    reachedNodeId: best,
    reachedLabel: nodeById.get(best)!.label,
    remainingM: Math.round(bestM),
  };
}

const ICON: Record<EdgeType, string> = {
  flat: 'walk', ramp: 'slope-uphill', stairs: 'stairs', elevator: 'elevator-passenger', slope: 'slope-uphill',
};

function describe(e: Edge, from: Node, to: Node, elevators: Elevator[]): string {
  switch (e.type) {
    case 'stairs':
      return `Sube ${e.steps ?? ''} escalones${e.name ? ` (${e.name})` : ''} hasta ${to.label}`.replace('  ', ' ');
    case 'ramp':
      return `Sigue por la rampa hasta ${to.label}`;
    case 'slope':
      return `Sigue por ${e.name ?? 'el camino'} hasta ${to.label}`;
    case 'elevator': {
      const el = elevators.find((x) => x.id === e.elevatorId);
      const bld = el?.building ?? from.building ?? '';
      const floor = to.floor ?? from.floor ?? 1;
      return `Toma el ascensor del Edif. ${bld} al piso ${floor}`;
    }
    default:
      return e.name ? `Sigue por ${e.name} hasta ${to.label}` : `Camina hasta ${to.label}`;
  }
}

function buildSteps(edges: Edge[], nodeIds: string[], elevators: Elevator[]): RouteStep[] {
  const steps: RouteStep[] = [];
  edges.forEach((e, i) => {
    const from = nodeById.get(nodeIds[i])!;
    const to = nodeById.get(nodeIds[i + 1])!;
    const last = steps[steps.length - 1];
    const lastEdge = last ? edgeById.get(last.edgeIds[last.edgeIds.length - 1]) : undefined;
    if (last && lastEdge && e.type === last.type && (e.type === 'flat' || (e.type === 'slope' && e.name === lastEdge.name))) {
      last.distanceM += e.distanceM;
      last.toNodeId = to.id;
      last.edgeIds.push(e.id);
      if (e.type === 'flat') {
        const firstName = edgeById.get(last.edgeIds[0])?.name;
        last.text = firstName ? `Sigue por ${firstName} hasta ${to.label}` : `Camina hasta ${to.label}`;
      } else {
        last.text = `Sigue por ${e.name ?? 'el camino'} hasta ${to.label}`;
      }
      return;
    }
    steps.push({
      text: describe(e, from, to, elevators), type: e.type, icon: ICON[e.type],
      distanceM: e.distanceM, fromNodeId: from.id, toNodeId: to.id, edgeIds: [e.id],
    });
  });
  return steps;
}

function stairCount(edges: Edge[]) {
  return edges.reduce((s, e) => s + (e.type === 'stairs' ? e.steps ?? 0 : 0), 0);
}

function avoidedReason(e: Edge, profile: Profile, b: Blocks): string {
  if (e.type === 'elevator' && isBlocked(e, b)) return 'El ascensor está fuera de servicio';
  if (isBlocked(e, b)) return 'Hay un reporte de paso bloqueado';
  if (e.type === 'stairs') {
    return profile === 'lowVision' ? 'Las escaleras son un riesgo sin referencias táctiles' : 'Las escaleras son inseguras con tu movilidad';
  }
  if (profile === 'wheelchair' && e.type === 'elevator') return 'Cabina de 100×120 cm: no cabe una silla (mínimo 110×140)';
  if (profile === 'wheelchair' && needsHelp(e)) return `Pendiente de ${e.slopePct}% sostenida: supera el 6% que una silla sube sin ayuda`;
  if (e.type === 'slope') return `Pendiente de ${e.slopePct}%, demasiado exigente`;
  return 'Hay una alternativa más segura';
}

const noBlocks = (raining = false, assisted = false): Blocks => ({
  edges: new Set(), elevators: new Set(), slowEdges: new Set(), raining, assisted,
});
const NO_BLOCKS: Blocks = noBlocks();

function toResult(
  profile: Profile, placeId: string, path: { nodeIds: string[]; edges: Edge[] },
  elevators: Elevator[], avoided: AvoidedItem[], stepsAvoided: number, assisted = false,
): RouteResult {
  const { nodeIds, edges } = path;
  const seconds = edges.reduce((s, e) => s + edgeSeconds(e, profile), 0);
  const totalM = edges.reduce((s, e) => s + e.distanceM, 0);
  const uncoveredM = edges.reduce((s, e) => s + (e.covered ? 0 : e.distanceM), 0);
  return {
    profile, placeId,
    steps: buildSteps(edges, nodeIds, elevators),
    distanceM: Math.round(edges.reduce((s, e) => s + e.distanceM, 0)),
    minutes: Math.max(1, Math.round(seconds / 60)),
    stairsCount: stairCount(edges),
    stepsAvoided, avoided,
    polyline: nodeIds.map((id) => ({ x: nodeById.get(id)!.x, y: nodeById.get(id)!.y })),
    nodeIds, edgeIds: edges.map((e) => e.id),
    usesElevator: edges.some((e) => e.type === 'elevator'),
    coveredPct: totalM > 0 ? Math.round((100 * (totalM - uncoveredM)) / totalM) : 100,
    uncoveredM: Math.round(uncoveredM),
    wheelchair: profile === 'wheelchair' ? wheelchairChecks(edges, elevators, assisted) : undefined,
  };
}

function wheelchairChecks(edges: Edge[], elevators: Elevator[], assisted: boolean): WheelchairChecks {
  const doors = edges.map((e) => e.widthCm).filter((w): w is number => w !== undefined);
  const help = assisted ? edges.filter(needsHelp) : [];
  const helpStreet = help.find((e) => e.name)?.name;
  return {
    minDoorCm: doors.length ? Math.min(...doors) : undefined,
    curbCutsOk: edges.every((e) => e.curbCut !== false),
    elevatorBuildings: edges
      .filter((e) => e.type === 'elevator')
      .map((e) => elevators.find((x) => x.id === e.elevatorId)?.building ?? '')
      .filter(Boolean),
    helpSlopePct: help.length ? Math.max(...help.map((e) => e.slopePct ?? 0)) : undefined,
    helpSlopeM: help.length
      ? Math.round(edges.filter((e) => helpStreet && e.name === helpStreet).reduce((s, e) => s + e.distanceM, 0))
      : undefined,
    helpStreet,
  };
}

export function findRoute(
  origin: string, destPlaceId: string, profile: Profile,
  incidents: Incident[] = [], elevators: Elevator[] = BASE_ELEVATORS, raining = false, assisted = false,
): RouteResult | null {
  const place = getPlace(destPlaceId);
  if (!place) return null;
  const b = buildBlocks(incidents, elevators, raining, assisted);
  const path = dijkstra(origin, place.nodeId, profile, b);
  if (!path) return null;
  const used = new Set(path.edges.map((e) => e.id));
  const avoided: AvoidedItem[] = [];
  const seen = new Set<string>();
  const add = (e: Edge, reason: string) => {
    const wc = profile === 'wheelchair';
    const text =
      wc && e.type === 'elevator' ? `Ascensor ${elevators.find((x) => x.id === e.elevatorId)?.building ?? ''} (cabina pequeña)`
      : wc && needsHelp(e) ? `Pendiente ${e.slopePct}% en ${e.name ?? 'tramo'}`
      : e.type === 'stairs' ? `${e.steps} escalones${e.name ? `: ${e.name}` : ''}`
      : e.type === 'elevator' ? `Ascensor Edif. ${elevators.find((x) => x.id === e.elevatorId)?.building ?? ''}`
      : `${e.name ?? 'Tramo'} (${e.slopePct ?? 0}% de pendiente)`;
    const kind: AvoidedItem['kind'] = isBlocked(e, b) ? 'incident' : e.type === 'stairs' ? 'stairs' : 'slope';
    if (!seen.has(text)) {
      seen.add(text);
      avoided.push({ text, reason, kind, steps: e.type === 'stairs' ? e.steps ?? 0 : undefined, name: e.name, edgeId: e.id });
    }
  };
  // Lo que evitamos respecto a la ruta más corta sin restricciones
  const base = dijkstra(origin, place.nodeId, 'none', NO_BLOCKS);
  let shortestSteps = 0;
  if (base) {
    shortestSteps = stairCount(base.edges);
    if (profile !== 'none') {
      for (const e of base.edges) {
        if (used.has(e.id)) continue;
        if (profile === 'wheelchair' && e.type === 'slope' && wheelchairOk(e, assisted)) continue;
        if (e.type === 'stairs' || e.type === 'slope') add(e, avoidedReason(e, profile, b));
      }
    }
  }
  // Silla autónoma: lo que descartamos de la ruta que sí haría alguien con muletas
  if (profile === 'wheelchair' && !assisted) {
    const crutchPath = dijkstra(origin, place.nodeId, 'crutches', noBlocks(raining));
    for (const e of crutchPath?.edges ?? []) {
      if (used.has(e.id) || wheelchairOk(e, false)) continue;
      add(e, avoidedReason(e, profile, b));
    }
  }
  // Lo que evitamos por incidentes / ascensores caídos (vs. ruta sin incidentes)
  const ideal = dijkstra(origin, place.nodeId, profile, noBlocks(raining));
  if (ideal) {
    for (const e of ideal.edges) {
      if (!used.has(e.id) && isBlocked(e, b)) add(e, avoidedReason(e, profile, b));
    }
  }
  const stepsAvoided = profile === 'none' ? 0 : Math.max(0, shortestSteps - stairCount(path.edges));
  return toResult(profile, destPlaceId, path, elevators, avoided, stepsAvoided, assisted);
}

/** Explica por qué una silla de ruedas autónoma no tiene ruta (null si no aplica). */
export function explainNoRoute(
  origin: string, destPlaceId: string, profile: Profile,
  incidents: Incident[] = [], elevators: Elevator[] = BASE_ELEVATORS, raining = false, assisted = false,
): NoRouteDiagnosis | null {
  const place = getPlace(destPlaceId);
  if (!place || profile !== 'wheelchair' || assisted) return null;
  const withHelp = dijkstra(origin, place.nodeId, 'wheelchair', buildBlocks(incidents, elevators, raining, true));
  if (withHelp) {
    const hard = withHelp.edges.filter(needsHelp);
    const street = hard.find((e) => e.name)?.name;
    return {
      kind: 'slope', street, slopePct: Math.max(0, ...hard.map((e) => e.slopePct ?? 0)),
      meters: Math.round(withHelp.edges.filter((e) => street && e.name === street).reduce((s, e) => s + e.distanceM, 0)),
    };
  }
  const crutch = dijkstra(origin, place.nodeId, 'crutches', buildBlocks(incidents, elevators, raining));
  const small = crutch?.edges.find((e) => e.type === 'elevator' && !cabinOk(e.elevatorId));
  if (small) return { kind: 'cabin', elevatorBuilding: elevators.find((x) => x.id === small.elevatorId)?.building };
  return { kind: 'other' };
}

export function compareWithShortest(
  origin: string, destPlaceId: string, profile: Profile,
  incidents: Incident[] = [], elevators: Elevator[] = BASE_ELEVATORS, raining = false, assisted = false,
): RouteComparison | null {
  const route = findRoute(origin, destPlaceId, profile, incidents, elevators, raining, assisted);
  const shortest = findRoute(origin, destPlaceId, 'none', incidents, elevators);
  if (!route || !shortest) return null;
  // La ruta más corta se recorre al ritmo del perfil del usuario
  const place = getPlace(destPlaceId)!;
  const path = dijkstra(origin, place.nodeId, 'none', buildBlocks(incidents, elevators))!;
  const secs = path.edges.reduce((s, e) => s + edgeSeconds(e, profile), 0);
  const shortestMin = Math.max(1, Math.round(secs / 60));
  return {
    route, shortest,
    extraMeters: route.distanceM - shortest.distanceM,
    extraMinutes: route.minutes - shortestMin,
    stepsAvoided: Math.max(0, shortest.stairsCount - route.stairsCount),
  };
}
