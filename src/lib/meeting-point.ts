/** Textos del punto de encuentro y de la dirección del apoyo (sin dependencias del grafo). */

export type SupportVerb = 'subir' | 'bajar' | 'llegar';

const ELEVATOR_LABEL = /^Ascensor Edif\. (\S+) \(piso (\d+)\)$/;

/** "Ascensor Edif. P (piso 4)" pasa a "hall del ascensor (Edif. P, piso 4)"; otros nodos quedan igual. */
function hall(label: string): string | null {
  const m = ELEVATOR_LABEL.exec(label);
  if (m) return `hall del ascensor (Edif. ${m[1]}, piso ${m[2]})`;
  return /^Ascensor\b/i.test(label) ? 'hall del ascensor' : null;
}

/** "en el hall del ascensor (…)" o "en <label>" */
export function meetIn(label: string): string {
  const h = hall(label);
  return h ? `en el ${h}` : `en ${label}`;
}

/** "al hall del ascensor (…)" o "a <label>" */
export function meetTo(label: string): string {
  const h = hall(label);
  return h ? `al ${h}` : `a ${label}`;
}

/** Etiqueta suelta: "el hall del ascensor (…)" o "<label>" */
export function meetName(label: string): string {
  const h = hall(label);
  return h ? `el ${h}` : label;
}

/** Dirección del apoyo según el piso donde queda la persona y el del destino. */
export function supportVerb(fromFloor: number, toFloor: number): SupportVerb {
  return toFloor > fromFloor ? 'subir' : toFloor < fromFloor ? 'bajar' : 'llegar';
}

export function supportPhrase(v: SupportVerb): string {
  return `te ayudan a ${v}`;
}
