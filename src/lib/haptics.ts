import * as Haptics from 'expo-haptics';

import type { ManeuverType } from '@/lib/maneuvers';

/** Código de pulsos para mostrar en la UI (leyenda de ayuda). */
export const HAPTIC_CODE = {
  left: { label: 'Izquierda', pattern: '2 pulsos cortos' },
  right: { label: 'Derecha', pattern: '3 pulsos cortos' },
  straight: { label: 'Recto', pattern: '1 pulso suave' },
  vertical: { label: 'Ascensor, escalera o rampa', pattern: '1 pulso largo + 1 corto' },
  arrive: { label: 'Llegada', pattern: 'Vibración de éxito + 2 pulsos largos' },
  barrier: { label: 'Barrera en la ruta', pattern: 'Vibración de alerta' },
  preAlert: { label: 'Aviso a 15 m', pattern: '1 pulso suave' },
} as const;

/** Resumen corto para lectores de pantalla. */
export const HAPTIC_LEGEND_SHORT = 'Vibraciones: 2 = izquierda, 3 = derecha, larga = ascensor o rampa';

type Step = { kind: 'impact'; style: Haptics.ImpactFeedbackStyle } | { kind: 'notify'; type: Haptics.NotificationFeedbackType };
type Seq = { step: Step; wait: number }[];

const GAP = 160;
const LONG_GAP = 380;
const light = (wait = GAP) => ({ step: { kind: 'impact', style: Haptics.ImpactFeedbackStyle.Light } as Step, wait });
const soft = (wait = GAP) => ({ step: { kind: 'impact', style: Haptics.ImpactFeedbackStyle.Soft } as Step, wait });
const heavy = (wait = LONG_GAP) => ({ step: { kind: 'impact', style: Haptics.ImpactFeedbackStyle.Heavy } as Step, wait });
const notify = (type: Haptics.NotificationFeedbackType, wait = LONG_GAP) => ({ step: { kind: 'notify', type } as Step, wait });

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let token = 0;

async function play(seq: Seq) {
  const mine = ++token; // cancela secuencias anteriores
  for (const { step, wait } of seq) {
    if (mine !== token) return;
    try {
      if (step.kind === 'impact') await Haptics.impactAsync(step.style);
      else await Haptics.notificationAsync(step.type);
    } catch {
      return;
    }
    await delay(wait);
  }
}

function sequenceFor(type: ManeuverType): Seq {
  switch (type) {
    case 'turn-left':
    case 'slight-left':
      return [light(), light(0)];
    case 'turn-right':
    case 'slight-right':
      return [light(), light(), light(0)];
    case 'ramp-up':
    case 'ramp-down':
    case 'elevator':
      return [heavy(), light(0)];
    case 'arrive':
      return [notify(Haptics.NotificationFeedbackType.Success), heavy(), heavy(0)];
    default:
      return [soft(0)]; // straight, enter, exit
  }
}

export function playManeuverHaptic(type: ManeuverType) {
  return play(sequenceFor(type));
}

export function playPreAlert() {
  return play([soft(0)]);
}

export function playBarrierAlert() {
  return play([notify(Haptics.NotificationFeedbackType.Warning, 0)]);
}
