import type { PartialRoute, Place, Profile, SupportTicket } from '@/types';

import { getNode } from './routing';

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
  if (r.steps.length) {
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
    detail: ticketDetail(partial, place, profile, originLabel, createdAt),
    portalUrl: PORTAL_URL,
  };
}
