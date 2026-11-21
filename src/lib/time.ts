/** Reloj simulado para que la demo sea estable. */
export const NOW_ISO = '2026-11-21T11:12:00.000Z';
export const NOW = new Date(NOW_ISO).getTime();

/** Minutos desde medianoche del reloj simulado (11:12 = 672). Se lee en UTC para ser estable. */
export const NOW_MINUTES = new Date(NOW_ISO).getUTCHours() * 60 + new Date(NOW_ISO).getUTCMinutes();

/** "HH:MM" -> minutos desde medianoche. */
export function parseClock(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Minutos desde medianoche -> "HH:MM". */
export function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

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
