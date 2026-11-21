import scheduleJson from '@/data/schedule.json';
import { lacksElevatorAccess } from '@/lib/buildings';
import { findNearestReachable, findRoute, getNode, getPlace } from '@/lib/routing';
import { formatClock, NOW_MINUTES, parseClock } from '@/lib/time';
import type { Elevator, Incident, Place, Profile } from '@/types';

/** Margen de seguridad al llegar a clase. */
export const MARGIN_MIN = 3;

export type ClassStatus = 'a-tiempo' | 'justo' | 'tarde' | 'sin-ruta';

export interface ScheduleClass {
  id: string;
  course: string;
  professor: string;
  start: string;
  end: string;
  placeId: string;
}

export interface ClassPlan {
  cls: ScheduleClass;
  place: Place;
  /** Sala de la clase anterior si el tramo parte de ahí (null si parte del origen actual o es la primera). */
  from: Place | null;
  /** Nombre legible del punto de partida del tramo (curso anterior o acceso de origen). */
  fromLabel: string | null;
  /** El tramo parte del origen actual (la clase anterior ya terminó). */
  fromOrigin: boolean;
  /** Nodo real de partida del tramo (la sala anterior, su punto alcanzable más cercano o el origen). */
  fromNodeId: string | null;
  startMin: number;
  endMin: number;
  /** En curso o terminada según el reloj simulado. */
  phase: 'terminada' | 'en-curso' | 'pendiente';
  /** Trayecto accesible según perfil (null = sin ruta o primera clase). */
  minutes: number | null;
  /** Trayecto con perfil 'none' (referencia). */
  baseMinutes: number | null;
  /** Minutos extra por ruta accesible (>0). */
  extraMinutes: number;
  /** Minutos disponibles entre fin de la clase anterior e inicio de esta. */
  available: number | null;
  /** Hora sugerida de salida (minutos desde medianoche). */
  leaveAt: number | null;
  arriveAt: number | null;
  /** Minutos de atraso si no alcanza (>0). */
  lateBy: number;
  status: ClassStatus | null;
}

/** Horario anclado a la hora actual: los offsets del JSON son minutos relativos a ahora. */
export const SCHEDULE_CLASSES: ScheduleClass[] = scheduleJson.classes.map(({ startOffset, endOffset, ...c }) => ({
  ...c,
  start: formatClock(NOW_MINUTES + startOffset),
  end: formatClock(NOW_MINUTES + endOffset),
}));
export const STUDENT = scheduleJson.student;

/** Rutas entre salas consecutivas (getRoute del contexto solo parte del origen, aquí partimos de la sala anterior). */
export function computeSchedule(
  profile: Profile,
  origin: string,
  incidents: Incident[],
  elevators: Elevator[],
  raining = false,
  nowMin: number = NOW_MINUTES,
): ClassPlan[] {
  // Igual que el contexto: el ruteo evita ascensores 'sin confirmar'.
  const routingElevators = elevators.map((e) => (e.status === 'unconfirmed' ? { ...e, status: 'down' as const } : e));
  const plans: ClassPlan[] = [];
  for (let i = 0; i < SCHEDULE_CLASSES.length; i++) {
    const cls = SCHEDULE_CLASSES[i];
    const place = getPlace(cls.placeId);
    if (!place) continue;
    const prevCls = i > 0 ? SCHEDULE_CLASSES[i - 1] : null;
    const prevPlace = prevCls ? getPlace(prevCls.placeId) ?? null : null;
    const startMin = parseClock(cls.start);
    const endMin = parseClock(cls.end);
    const phase = endMin <= nowMin ? 'terminada' : startMin <= nowMin ? 'en-curso' : 'pendiente';
    const base: ClassPlan = {
      cls, place, from: null, fromLabel: null, fromOrigin: false, fromNodeId: null, startMin, endMin, phase,
      minutes: null, baseMinutes: null, extraMinutes: 0, available: null,
      leaveAt: null, arriveAt: null, lateBy: 0, status: null,
    };
    if (!prevPlace || !prevCls) {
      plans.push(base);
      continue;
    }
    // Si la clase anterior ya terminó, la persona está en el origen actual; si no, sale de esa sala.
    const fromOrigin = parseClock(prevCls.end) <= nowMin;
    if (phase === 'terminada') {
      plans.push(base);
      continue;
    }
    let fromNode = fromOrigin ? origin : prevPlace.nodeId;
    let fromLabel = fromOrigin ? getNode(origin)?.label ?? 'tu ubicación' : prevCls.course;
    let from = fromOrigin ? null : prevPlace;
    let fromOriginFlag = fromOrigin;
    // Si la sala anterior no es alcanzable con este perfil, parte del punto alcanzable más cercano a ella.
    if (!fromOrigin && !findRoute(origin, prevPlace.id, profile, incidents, routingElevators, raining)) {
      const near = findNearestReachable(origin, prevPlace.id, profile, incidents, routingElevators, raining);
      const usable = near && (findRoute(near.reachedNodeId, place.id, profile, incidents, routingElevators, raining)
        || findNearestReachable(near.reachedNodeId, place.id, profile, incidents, routingElevators, raining)?.route.steps.length);
      if (near && usable) {
        fromNode = near.reachedNodeId;
        fromLabel = near.reachedLabel;
      } else {
        fromNode = origin;
        fromLabel = getNode(origin)?.label ?? 'tu ubicación';
        from = null;
        fromOriginFlag = true;
      }
    }
    const earliest = fromOriginFlag ? nowMin : parseClock(prevCls.end);
    const route = findRoute(fromNode, place.id, profile, incidents, routingElevators, raining);
    const none = findRoute(fromNode, place.id, 'none', incidents, routingElevators, raining);
    const available = startMin - earliest;
    if (!route) {
      plans.push({ ...base, from, fromLabel, fromOrigin: fromOriginFlag, fromNodeId: fromNode, available, status: 'sin-ruta' });
      continue;
    }
    const minutes = route.minutes;
    const margin = available - minutes;
    const status: ClassStatus = margin < 0 ? 'tarde' : margin < MARGIN_MIN ? 'justo' : 'a-tiempo';
    // No se puede salir antes de que termine la clase anterior.
    const leaveAt = Math.max(earliest, startMin - minutes - MARGIN_MIN);
    plans.push({
      ...base,
      from,
      fromLabel,
      fromOrigin: fromOriginFlag,
      fromNodeId: fromNode,
      minutes,
      baseMinutes: none?.minutes ?? null,
      extraMinutes: none ? Math.max(0, minutes - none.minutes) : 0,
      available,
      leaveAt,
      arriveAt: leaveAt + minutes,
      lateBy: Math.max(0, -margin),
      status,
    });
  }
  return plans;
}

/** "Sala A-101 · Edif. A"; evita repetir el edificio si el nombre ya lo incluye. */
export function placeDetail(p: Place): string {
  const name = p.category === 'sala' ? `Sala ${p.name}` : p.name;
  return p.building && !/edif/i.test(p.name) ? `${name} · Edif. ${p.building}` : name;
}

const REQUEST_REASON: Record<Profile, string> = {
  crutches: 'Por una lesión me desplazo con muletas',
  wheelchair: 'Me desplazo en silla de ruedas',
  lowVision: 'Tengo baja visión',
  none: 'Necesito una ruta accesible',
};

/** Mensaje cortés para pedir una sala accesible (Share nativo). */
export function accessibleRoomRequest(profile: Profile, place: Place, course?: string): string {
  const where = `la sala ${place.name} (piso ${place.floor}, Edif. ${place.building})`;
  const access = profile === 'wheelchair' || profile === 'crutches' ? 'no tiene acceso sin escaleras' : 'no es accesible para mí';
  const what = course ? `la ${course.replace(/^la /i, '')}` : 'la actividad';
  return (
    `Hola, soy ${STUDENT.name} (Ing. Civil Informática). ${REQUEST_REASON[profile]} y ${where} ${access}. ` +
    `¿Sería posible reasignar ${what} a una sala accesible del primer piso? Gracias.`
  );
}

/** Tramo sin ruta porque la sala está en un piso sin ascensor. */
export function isNoElevatorLeg(p: ClassPlan, profile: Profile): boolean {
  return p.status === 'sin-ruta' && (profile === 'crutches' || profile === 'wheelchair') && lacksElevatorAccess(p.place);
}

export function courseAt(placeId: string): string | undefined {
  return SCHEDULE_CLASSES.find((c) => c.placeId === placeId)?.course;
}
