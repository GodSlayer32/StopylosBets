import nodesJson from '../data/nodes.json';
import edgesJson from '../data/edges.json';
import placesJson from '../data/places.json';
import elevatorsJson from '../data/elevators.json';
import type {
  AvoidedItem, Edge, Elevator, EdgeType, Incident, Node, Place, Profile,
  RouteComparison, RouteResult, RouteStep,
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
const SECONDS_PER_STEP: Record<Profile, number> = {
  crutches: 3, wheelchair: 3, lowVision: 1.8, none: 0.8,
};

interface Blocks {
  edges: Set<string>;
  elevators: Set<string>;
  slowEdges: Set<string>;
}

function buildBlocks(incidents: Incident[], elevators: Elevator[]): Blocks {
  const b: Blocks = { edges: new Set(), elevators: new Set(), slowEdges: new Set() };
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
      if (e.type === 'stairs') return null;
      if (e.type === 'slope') {
        if (slope > 8) return null;
        cost = d * (1 + slope / 3);
      }
      break;
    case 'lowVision':
      if (e.type === 'stairs') cost = d + 25 + (e.steps ?? 0) * 2;
      else if (e.type === 'slope') cost = d * (1 + slope / 10);
      if (!e.covered && e.type !== 'elevator') cost *= 1.15;
      break;
  }
  if (b.slowEdges.has(e.id)) cost *= 1.5;
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

/** Dijkstra sobre el grafo; devuelve aristas recorridas o null. */
export function dijkstra(
  originId: string, destId: string, profile: Profile, b: Blocks,
): { nodeIds: string[]; edges: Edge[] } | null {
  if (!nodeById.has(originId) || !nodeById.has(destId)) return null;
  const dist = new Map<string, number>([[originId, 0]]);
  const prev = new Map<string, { node: string; edge: Edge }>();
  const done = new Set<string>();
  const queue: [number, string][] = [[0, originId]];
  while (queue.length) {
    queue.sort((a, c) => a[0] - c[0]);
    const [d, u] = queue.shift()!;
    if (done.has(u)) continue;
    done.add(u);
    if (u === destId) break;
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
  if (!prev.has(destId) && originId !== destId) return null;
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

const ICON: Record<EdgeType, string> = {
  flat: 'walk', ramp: 'slope-uphill', stairs: 'stairs', elevator: 'elevator-passenger', slope: 'slope-uphill',
};

function describe(e: Edge, from: Node, to: Node, elevators: Elevator[]): string {
  const m = Math.round(e.distanceM);
  switch (e.type) {
    case 'stairs':
      return `Sube ${e.steps ?? ''} escalones${e.name ? ` (${e.name})` : ''} hasta ${to.label}`.replace('  ', ' ');
    case 'ramp':
      return `Sigue por la rampa hasta ${to.label} (${m} m${e.slopePct ? `, pendiente ${e.slopePct}%` : ''})`;
    case 'slope':
      return `Sigue por ${e.name ?? 'el camino'} hasta ${to.label} (${m} m, pendiente suave de ${e.slopePct}%)`;
    case 'elevator': {
      const el = elevators.find((x) => x.id === e.elevatorId);
      const bld = el?.building ?? from.building ?? '';
      const floor = to.floor ?? from.floor ?? 1;
      return `Toma el ascensor del Edif. ${bld} al piso ${floor}`;
    }
    default:
      return `Camina ${m} m hasta ${to.label}`;
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
      if (e.type === 'flat') last.text = `Camina ${Math.round(last.distanceM)} m hasta ${to.label}`;
      else {
        const maxSlope = Math.max(...last.edgeIds.map((id) => edgeById.get(id)?.slopePct ?? 0));
        last.text = `Sigue por ${e.name ?? 'el camino'} hasta ${to.label} (${Math.round(last.distanceM)} m, pendiente de hasta ${maxSlope}%)`;
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
  if (e.type === 'slope') return `Pendiente de ${e.slopePct}%, demasiado exigente`;
  return 'Hay una alternativa más segura';
}

const NO_BLOCKS: Blocks = { edges: new Set(), elevators: new Set(), slowEdges: new Set() };

function toResult(
  profile: Profile, placeId: string, path: { nodeIds: string[]; edges: Edge[] },
  elevators: Elevator[], avoided: AvoidedItem[], stepsAvoided: number,
): RouteResult {
  const { nodeIds, edges } = path;
  const seconds = edges.reduce((s, e) => s + edgeSeconds(e, profile), 0);
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
  };
}

export function findRoute(
  origin: string, destPlaceId: string, profile: Profile,
  incidents: Incident[] = [], elevators: Elevator[] = BASE_ELEVATORS,
): RouteResult | null {
  const place = getPlace(destPlaceId);
  if (!place) return null;
  const b = buildBlocks(incidents, elevators);
  const path = dijkstra(origin, place.nodeId, profile, b);
  if (!path) return null;
  const used = new Set(path.edges.map((e) => e.id));
  const avoided: AvoidedItem[] = [];
  const seen = new Set<string>();
  const add = (e: Edge, reason: string) => {
    const text =
      e.type === 'stairs' ? `${e.steps} escalones${e.name ? `: ${e.name}` : ''}`
      : e.type === 'elevator' ? `Ascensor Edif. ${elevators.find((x) => x.id === e.elevatorId)?.building ?? ''}`
      : `${e.name ?? 'Tramo'} (${e.slopePct ?? 0}% de pendiente)`;
    if (!seen.has(text)) { seen.add(text); avoided.push({ text, reason }); }
  };
  // Lo que evitamos respecto a la ruta más corta sin restricciones
  const base = dijkstra(origin, place.nodeId, 'none', NO_BLOCKS);
  let shortestSteps = 0;
  if (base) {
    shortestSteps = stairCount(base.edges);
    if (profile !== 'none') {
      for (const e of base.edges) {
        if (used.has(e.id)) continue;
        if (e.type === 'stairs' || e.type === 'slope') add(e, avoidedReason(e, profile, b));
      }
    }
  }
  // Lo que evitamos por incidentes / ascensores caídos (vs. ruta sin incidentes)
  const ideal = dijkstra(origin, place.nodeId, profile, NO_BLOCKS);
  if (ideal) {
    for (const e of ideal.edges) {
      if (!used.has(e.id) && isBlocked(e, b)) add(e, avoidedReason(e, profile, b));
    }
  }
  const stepsAvoided = profile === 'none' ? 0 : Math.max(0, shortestSteps - stairCount(path.edges));
  return toResult(profile, destPlaceId, path, elevators, avoided, stepsAvoided);
}

export function compareWithShortest(
  origin: string, destPlaceId: string, profile: Profile,
  incidents: Incident[] = [], elevators: Elevator[] = BASE_ELEVATORS,
): RouteComparison | null {
  const route = findRoute(origin, destPlaceId, profile, incidents, elevators);
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
