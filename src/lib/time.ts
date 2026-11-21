/** Reloj simulado para que la demo sea estable. */
export const NOW_ISO = '2026-11-21T11:30:00.000Z';
export const NOW = new Date(NOW_ISO).getTime();

/** Horas sin confirmación tras las cuales un reporte pasa a "sin confirmar". */
export const STALE_HOURS = 3;

export function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((NOW - new Date(iso).getTime()) / 60000));
}

export function formatAgo(iso: string): string {
  const m = minutesSince(iso);
  if (m < 1) return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  if (h < 48) return 'ayer';
  return `hace ${Math.floor(h / 24)} días`;
}

export function formatConfirmations(n: number): string {
  return n === 1 ? '1 confirmación' : `${n} confirmaciones`;
}
