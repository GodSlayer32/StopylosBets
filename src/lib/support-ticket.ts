import type { Elevator, PartialRoute, Place, Profile, SupportTicket } from '@/types';

import { EDGES, getNode } from './routing';

/** Portal de atención de la USM (Proactivanet). */
export const PORTAL_URL = 'https://usm.proactivanet.com/proactivanet/portal/';

/** Demo: quién toma el ticket. */
export const SUPPORT_TEAM = 'Apoyo en terreno · DAE';

const PROFILE_LABEL: Record<Profile, string> = {
  wheelchair: 'Silla de ruedas',
  crutches: 'Muletas o lesión temporal',
  lowVision: 'Baja visión',
  none: 'Sin necesidades específicas',
};

/** Causa "ascensor caido": el apoyo ayuda a subir o bajar de piso. */
export interface ElevatorCause {
  building: string;
  fromFloor: number;
  toFloor: number;
  /** Nodo del ascensor en el piso donde queda la persona tras la ayuda */
  resumeNodeId: string;
}

function elevatorNodeAt(elevatorId: string, floor: number): string | null {
  for (const e of EDGES) {
    if (e.elevatorId !== elevatorId) continue;
    for (const id of [e.from, e.to]) if (getNode(id)?.floor === floor) return id;
  }
  return null;
}

/**
 * Detecta si el apoyo se necesita por un ascensor caido (o sin confirmar):
 * el origen esta en un piso distinto de 1 con su ascensor caido, o el ascensor
 * del edificio del destino esta caido y el punto alcanzado no esta en su piso.
 */
export function detectElevatorCause(
  originNodeId: string, place: Place, partial: PartialRoute, elevators: Elevator[],
): ElevatorCause | null {
  const downIn = (b: string) => elevators.find((e) => e.building === b && e.status !== 'ok');
  const o = getNode(originNodeId);
  if (o?.building && o.floor !== undefined && o.floor !== 1) {
    const el = downIn(o.building);
    const resume = el && elevatorNodeAt(el.id, 1);
    if (el && resume) return { building: o.building, fromFloor: o.floor, toFloor: 1, resumeNodeId: resume };
  }
  const reached = getNode(partial.reachedNodeId);
  if (place.building && place.floor !== 1) {
    const el = downIn(place.building);
    const resume = el && elevatorNodeAt(el.id, place.floor);
    const fromFloor = reached?.building === place.building && reached.floor !== undefined ? reached.floor : 1;
    if (el && resume && fromFloor !== place.floor) {
      return { building: place.building, fromFloor, toFloor: place.floor, resumeNodeId: resume };
    }
  }
  return null;
}

export function elevatorSupportText(c: ElevatorCause): string {
  return `Apoyo para ${c.toFloor < c.fromFloor ? 'bajar' : 'subir'} del piso ${c.fromFloor} al piso ${c.toFloor} del Edif. ${c.building} con personal capacitado (ascensor fuera de servicio)`;
}

/**
 * Folio determinista: el mismo trayecto da siempre el mismo número, así el
 * ticket no se duplica si la pantalla se vuelve a montar.
 */
export function ticketFolio(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `USM-2026-${String(1000 + (h % 9000))}`;
}

/** Lo que se envía al portal: todo lo que necesita saber quien va a acompañar. */
export function ticketDetail(
  partial: PartialRoute, place: Place, profile: Profile, originLabel: string, createdAt: string,
  cause: ElevatorCause | null = null,
): string {
  const r = partial.route;
  const L: string[] = [
    'Solicitud de acompañamiento para desplazarse en el campus Casa Central',
    '',
    `Desde: ${originLabel}`,
    `Hasta: ${place.name}${place.building ? ` (Edif. ${place.building})` : ''}`,
    `Perfil de movilidad: ${PROFILE_LABEL[profile]}`,
    `Solicitado: ${new Date(createdAt).toLocaleString('es-CL')}`,
    '',
    'La app no encuentra ninguna ruta accesible completa con este perfil.',
  ];
  if (cause) {
    L.push(
      elevatorSupportText(cause) + '.',
      r.steps.length ? `Puedo llegar por mi cuenta hasta ${partial.reachedLabel}; ahí necesito el apoyo.` : `Me quedo en ${originLabel} hasta que llegue el apoyo.`,
    );
  } else if (r.steps.length) {
    L.push(
      `Puedo llegar por mi cuenta hasta ${partial.reachedLabel} (${r.distanceM} m, unos ${r.minutes} min).`,
      `Necesito acompañamiento en los últimos ${partial.remainingM} m —distancia en línea recta,`,
      `sin camino practicable— hasta ${place.name}.`,
      '',
      'Trayecto que puedo hacer por mi cuenta:',
      ...r.steps.map((s, i) => `  ${i + 1}. ${s.text} — ${Math.round(s.distanceM)} m`),
    );
  } else {
    L.push(
      `No puedo avanzar desde ${originLabel}: con este perfil todas las salidas de ese punto`,
      'están bloqueadas. Necesito acompañamiento desde el inicio.',
    );
  }
  if (r.avoided.length) {
    L.push('', 'Barreras que obligan a rodear:');
    for (const a of r.avoided) L.push(`  - ${a.text}: ${a.reason}`);
  }
  L.push(
    '',
    'Generado automáticamente por Ruta Libre (USM Casa Central).',
    'Los datos del campus son de demostración; las pendientes son estimaciones.',
  );
  return L.join('\n');
}

/** Arma el ticket completo a partir de la ruta parcial. */
export function buildTicket(
  partial: PartialRoute, place: Place, profile: Profile, originNodeId: string, createdAt: string,
  cause: ElevatorCause | null = null,
): SupportTicket {
  const originLabel = getNode(originNodeId)?.label ?? 'tu origen';
  const key = `${originNodeId}>${place.id}:${profile}`;
  return {
    id: ticketFolio(key),
    key,
    createdAt,
    placeId: place.id,
    placeName: place.name,
    originLabel,
    reachedLabel: partial.reachedLabel,
    remainingM: partial.remainingM,
    profile,
    status: 'sent',
    etaMin: Math.max(4, Math.round(partial.route.minutes * 0.6)),
    originNodeId,
    resumeNodeId: cause?.resumeNodeId ?? place.nodeId,
    supportText: cause ? elevatorSupportText(cause) : undefined,
    detail: ticketDetail(partial, place, profile, originLabel, createdAt, cause),
    portalUrl: PORTAL_URL,
  };
}
