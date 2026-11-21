import amenitiesJson from '../data/amenities.json';
import { EDGES, getNode } from './routing';
import type { Amenity, AmenityType, RouteAmenity, RouteResult } from '../types';

export const AMENITIES = amenitiesJson.amenities as Amenity[];

const IMG_W = 1313;
const IMG_H = 980;
/** Metros por pixel del plano (estimado de las aristas planas) */
const M_PER_PX = 0.3;
const edgeById = new Map(EDGES.map((e) => [e.id, e]));

export const AMENITY_ICON: Record<AmenityType, string> = {
  bench: 'seat', wc: 'human-wheelchair', water: 'water', shade: 'umbrella-outline', 'rest-area': 'sofa-outline',
};

const AMENITY_WORD: Record<AmenityType, [string, string]> = {
  bench: ['banca', 'bancas'], wc: ['baño accesible', 'baños accesibles'], water: ['bebedero', 'bebederos'],
  shade: ['tramo con sombra', 'tramos con sombra'], 'rest-area': ['zona de descanso', 'zonas de descanso'],
};
export const amenityWord = (type: AmenityType, n = 1) => AMENITY_WORD[type][n === 1 ? 0 : 1];
/** "Banca", "Baño accesible"... para mostrar a distancia */
export const amenityShort = (type: AmenityType) => {
  const w = AMENITY_WORD[type][0];
  return w.charAt(0).toUpperCase() + w.slice(1);
};

function amenityPos(a: Amenity) {
  const n = a.nodeId ? getNode(a.nodeId) : undefined;
  const x = a.x ?? n?.x ?? 0;
  const y = a.y ?? n?.y ?? 0;
  return { x: (x / 100) * IMG_W, y: (y / 100) * IMG_H };
}

/**
 * Servicios a ≤ maxDistM (m) de la ruta, ordenados por metros recorridos desde el inicio.
 * Los servicios de interior solo cuentan si la ruta pasa por ese edificio y piso.
 */
export function amenitiesAlongRoute(route: RouteResult, maxDistM = 25): RouteAmenity[] {
  const segs: { ax: number; ay: number; bx: number; by: number; startM: number; lenM: number; a: ReturnType<typeof getNode>; b: ReturnType<typeof getNode> }[] = [];
  let acc = 0;
  route.edgeIds.forEach((id, i) => {
    const e = edgeById.get(id);
    const a = getNode(route.nodeIds[i]);
    const b = getNode(route.nodeIds[i + 1]);
    if (!e || !a || !b) return;
    if (e.type !== 'elevator') {
      segs.push({
        ax: (a.x / 100) * IMG_W, ay: (a.y / 100) * IMG_H, bx: (b.x / 100) * IMG_W, by: (b.y / 100) * IMG_H,
        startM: acc, lenM: e.distanceM, a, b,
      });
    }
    acc += e.distanceM;
  });
  const out: RouteAmenity[] = [];
  for (const am of AMENITIES) {
    const p = amenityPos(am);
    const indoor = !!am.building && am.floor !== undefined;
    let best: { d: number; at: number } | null = null;
    for (const s of segs) {
      const hits = (n: typeof s.a) => !!n && n.building === am.building && n.floor === am.floor;
      if (indoor ? !(hits(s.a) || hits(s.b)) : !!(s.a?.building && s.b?.building)) continue;
      const dx = s.bx - s.ax;
      const dy = s.by - s.ay;
      const l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - s.ax) * dx + (p.y - s.ay) * dy) / l2)) : 0;
      const d = Math.hypot(p.x - (s.ax + dx * t), p.y - (s.ay + dy * t)) * M_PER_PX;
      if (d <= maxDistM && (!best || d < best.d)) best = { d, at: s.startM + t * s.lenM };
    }
    if (best) out.push({ amenity: am, atM: Math.round(best.at) });
  }
  return out.sort((x, y) => x.atM - y.atM);
}

/** Siguiente servicio de los tipos pedidos (uno por tipo) que aún está por delante de currentM. */
export function nextAmenity(
  route: RouteResult | RouteAmenity[], currentM: number, types?: AmenityType[],
): (RouteAmenity & { distM: number }) | null {
  const list = Array.isArray(route) ? route : amenitiesAlongRoute(route);
  const hit = list.find((r) => r.atM >= currentM - 2 && (!types || types.includes(r.amenity.type)));
  return hit ? { ...hit, distM: Math.max(0, Math.round(hit.atM - currentM)) } : null;
}

/** Próximos servicios (uno por tipo) a ≤ withinM metros por delante, ordenados por cercanía. */
export function nextAmenitiesWithin(list: RouteAmenity[], currentM: number, withinM = 60): (RouteAmenity & { distM: number })[] {
  const seen = new Set<AmenityType>();
  const out: (RouteAmenity & { distM: number })[] = [];
  for (const r of list) {
    const distM = Math.round(r.atM - currentM);
    if (distM < -2 || distM > withinM || seen.has(r.amenity.type)) continue;
    seen.add(r.amenity.type);
    out.push({ ...r, distM: Math.max(0, distM) });
  }
  return out;
}
