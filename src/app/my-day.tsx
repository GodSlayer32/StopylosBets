import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenState } from '@/components/ScreenState';
import { StatusPill } from '@/components/StatusPill';
import { radius, spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { computeSchedule, placeDetail, STUDENT, type ClassPlan } from '@/lib/schedule';
import { formatClock, NOW_MINUTES } from '@/lib/time';
import type { Profile } from '@/types';

const REASON: Record<Profile, string> = {
  crutches: 'Por una lesión me desplazo con muletas',
  wheelchair: 'Me desplazo en silla de ruedas',
  lowVision: 'Tengo baja visión',
  none: 'Necesito usar la ruta accesible',
};

export function legSentence(p: ClassPlan): string {
  const fromName = p.fromOrigin ? `tu ubicación (${p.fromLabel})` : p.fromLabel ?? '';
  if (p.status === 'sin-ruta') return `De ${fromName} a ${p.cls.course}: no hay ruta accesible disponible ahora.`;
  const base = `De ${fromName} a ${p.cls.course}: ${p.minutes} minutos con ruta accesible, tienes ${p.available}.`;
  if (p.status === 'tarde') return `${base} No alcanzas por ${p.lateBy} ${p.lateBy === 1 ? 'minuto' : 'minutos'}.`;
  if (p.status === 'justo') return `${base} Vas justo.`;
  return `${base} Llegas a tiempo.`;
}

export default function MyDay() {
  const router = useRouter();
  const { profile, origin, setOrigin, incidents, elevators, raining } = useApp();
  const prevOrigin = useRef<string | null>(null);

  // Al volver de la ruta, restaura el origen que había antes de usar la sala anterior.
  useFocusEffect(
    useCallback(() => {
      if (prevOrigin.current) {
        setOrigin(prevOrigin.current);
        prevOrigin.current = null;
      }
    }, [setOrigin]),
  );
  const { colors, minTouch } = useTheme();
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, [attempt]);

  const { plans, error } = useMemo(() => {
    try {
      return { plans: computeSchedule(profile, origin, incidents, elevators, raining), error: false };
    } catch {
      return { plans: [] as ClassPlan[], error: true };
    }
  }, [profile, origin, incidents, elevators, raining]);

  const load = () => {
    setReady(false);
    setAttempt((a) => a + 1);
  };

  const notify = (p: ClassPlan) => {
    const msg =
      `Hola ${p.cls.professor}, soy ${STUDENT.name}. ${REASON[profile]} y el trayecto accesible desde ` +
      `${p.from?.name ?? p.fromLabel ?? 'mi ubicación'} a ${p.place.name} toma ${p.minutes} min; podría llegar unos minutos tarde a ` +
      `${p.cls.course}. Gracias por su comprensión.`;
    Share.share({ message: msg }).catch(() => {});
  };

  if (error) {
    return (
      <Screen>
        <ScreenState variant="error" title="No pudimos calcular tu día" message="Revisa tu conexión e intenta de nuevo." onAction={load} />
      </Screen>
    );
  }
  if (!ready) {
    return (
      <Screen>
        <ScreenState variant="loading" title="Calculando tus rutas" message="Estimamos el trayecto entre tus clases según tu perfil." />
      </Screen>
    );
  }
  if (plans.length === 0) {
    return (
      <Screen>
        <ScreenState variant="empty" title="Hoy no tienes clases" message="Disfruta tu día libre." />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppText variant="display" accessibilityRole="header">Mi día</AppText>
      <AppText color="textMuted">
        {STUDENT.name} · son las {formatClock(NOW_MINUTES)}
      </AppText>
      {plans.map((p) => {
        const tone = p.status === 'tarde' || p.status === 'sin-ruta' ? 'danger' : p.status === 'justo' ? 'warning' : 'success';
        return (
          <View key={p.cls.id} style={styles.block}>
            {p.status && p.from ? (
              <View style={[styles.leg, { borderLeftColor: colors[tone] }]}>
                <View accessible accessibilityLabel={legSentence(p)} style={styles.legText}>
                  <View style={styles.row}>
                    <Ionicons name="walk" size={20} color={colors.textMuted} />
                    <AppText variant="label" style={styles.flex}>
                      {p.status === 'sin-ruta' ? 'Sin ruta accesible' : `${p.fromOrigin ? `Desde ${p.fromLabel}: ` : ''}${p.minutes} min con ruta accesible · tienes ${p.available}`}
                    </AppText>
                  </View>
                  {p.extraMinutes > 0 ? (
                    <AppText variant="caption" color="textMuted">+{p.extraMinutes} min por ruta accesible</AppText>
                  ) : null}
                  <StatusPill
                    tone={tone}
                    label={
                      p.status === 'a-tiempo' ? 'A tiempo'
                      : p.status === 'justo' ? 'Vas justo'
                      : p.status === 'tarde' ? `No alcanzas por ${p.lateBy} min`
                      : 'Sin ruta'
                    }
                  />
                  {p.leaveAt != null && p.status !== 'sin-ruta' ? (
                    <AppText variant="caption" color="textMuted">
                      {p.fromOrigin ? `Sal a las ${formatClock(p.leaveAt)}` : `Sales ${formatClock(p.leaveAt)}`} · llegas {formatClock(p.arriveAt ?? 0)} (clase {p.cls.start})
                    </AppText>
                  ) : null}
                </View>
                {p.status === 'justo' || p.status === 'tarde' ? (
                  <Button
                    label="Avisar al profesor"
                    icon="share-outline"
                    variant="secondary"
                    fullWidth
                    accessibilityHint="Abre las opciones para compartir un mensaje cortés"
                    onPress={() => notify(p)}
                  />
                ) : null}
                <Button
                  label="Llévame"
                  icon="navigate"
                  fullWidth
                  accessibilityLabel={`Llévame a ${p.place.name}`}
                  onPress={() => {
                    if (p.from) {
                      prevOrigin.current = origin;
                      setOrigin(p.from.nodeId);
                    }
                    router.push(`/route/${p.place.id}`);
                  }}
                />
              </View>
            ) : null}
            <Card style={[styles.classCard, { minHeight: minTouch }, p.phase === 'terminada' && styles.done]}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <AppText variant="heading" accessibilityRole="header">{p.cls.course}</AppText>
                  <AppText color="textMuted">
                    {p.cls.start} a {p.cls.end} · {placeDetail(p.place)}
                  </AppText>
                  <AppText variant="caption" color="textMuted">{p.cls.professor}</AppText>
                </View>
                {p.phase !== 'pendiente' ? <StatusPill tone="neutral" label={p.phase === 'en-curso' ? 'En curso' : 'Terminada'} /> : null}
              </View>
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  block: { gap: spacing.md },
  done: { opacity: 0.6 },
  classCard: { gap: spacing.sm },
  leg: { gap: spacing.md, marginLeft: spacing.md, paddingLeft: spacing.lg, borderLeftWidth: 4, borderRadius: radius.sm },
  legText: { gap: spacing.sm },
});
