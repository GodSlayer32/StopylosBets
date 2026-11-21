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
import { spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { floorLabel, lacksElevatorAccess } from '@/lib/buildings';
import { useTheme } from '@/hooks/use-theme';
import { accessibleRoomRequest, computeSchedule, isNoElevatorLeg, placeDetail, STUDENT, type ClassPlan } from '@/lib/schedule';
import { formatClock } from '@/lib/time';
import type { Profile } from '@/types';

const REASON: Record<Profile, string> = {
  crutches: 'Por una lesión me desplazo con muletas',
  wheelchair: 'Me desplazo en silla de ruedas',
  lowVision: 'Tengo baja visión',
  none: 'Necesito usar la ruta accesible',
};

export function legSentence(p: ClassPlan): string {
  const fromName = p.fromOrigin ? `tu ubicación (${p.fromLabel})` : p.fromLabel ?? '';
  if (p.status === 'sin-ruta' && lacksElevatorAccess(p.place)) return `De ${fromName} a ${p.cls.course}: sin ruta accesible, la sala está en el ${floorLabel(p.place.floor ?? 1).toLowerCase()} de un edificio sin ascensor.`;
  if (p.status === 'sin-ruta') return `De ${fromName} a ${p.cls.course}: no hay ruta accesible disponible ahora.`;
  const base = `De ${fromName} a ${p.cls.course}: ${p.minutes} minutos con ruta accesible, tienes ${p.available}.`;
  if (p.status === 'tarde') return `${base} No alcanzas por ${p.lateBy} ${p.lateBy === 1 ? 'minuto' : 'minutos'}.`;
  if (p.status === 'justo') return `${base} Vas justo.`;
  return `${base} Llegas a tiempo.`;
}

function currentMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export default function MyDay() {
  const router = useRouter();
  const { profile, origin, setOrigin, incidents, elevators, raining } = useApp();
  const prevOrigin = useRef<string | null>(null);
  const [nowMin, setNowMin] = useState(currentMinutes);

  // Al volver de la ruta, restaura el origen que había antes de usar la sala anterior.
  useFocusEffect(
    useCallback(() => {
      setNowMin(currentMinutes());
      const id = setInterval(() => setNowMin(currentMinutes()), 30000);
      if (prevOrigin.current) {
        setOrigin(prevOrigin.current);
        prevOrigin.current = null;
      }
      return () => clearInterval(id);
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
      return { plans: computeSchedule(profile, origin, incidents, elevators, raining, nowMin), error: false };
    } catch {
      return { plans: [] as ClassPlan[], error: true };
    }
  }, [profile, origin, incidents, elevators, raining, nowMin]);

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

  const requestRoom = (p: ClassPlan) => {
    Share.share({ message: accessibleRoomRequest(profile, p.place, p.cls.course) }).catch(() => {});
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
    <Screen scroll contentStyle={styles.list}>
      <View style={styles.head}>
        <AppText color="textMuted">{TODAY} · son las {formatClock(nowMin)}</AppText>
        <AppText variant="heading">{STUDENT.name}</AppText>
      </View>
      {plans.map((p) => {
        const tone = p.status === 'tarde' || p.status === 'sin-ruta' ? 'danger' : p.status === 'justo' ? 'warning' : 'success';
        const finished = p.phase === 'terminada';
        const noElev = isNoElevatorLeg(p, profile);
        return (
          <Card key={p.cls.id} style={[styles.classCard, { minHeight: minTouch }]}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="heading" accessibilityRole="header" color={finished ? 'textMuted' : 'text'}>{p.cls.course}</AppText>
                <AppText color="textMuted">
                  {p.cls.start} a {p.cls.end} · {placeDetail(p.place)}
                </AppText>
                <AppText variant="caption" color="textMuted">{p.cls.professor}</AppText>
              </View>
              {finished ? (
                <View style={styles.doneTag} accessible accessibilityLabel="Terminada">
                  <Ionicons name="checkmark-circle" size={20} color={colors.textMuted} />
                  <AppText variant="label" color="textMuted">Terminada</AppText>
                </View>
              ) : p.phase === 'en-curso' ? (
                <StatusPill tone="neutral" label="En curso" />
              ) : null}
            </View>
            {p.status && p.from ? (
              <View style={[styles.leg, { borderTopColor: colors.border }]}>
                <View accessible accessibilityLabel={legSentence(p)} style={styles.legText}>
                  <StatusPill
                    tone={tone}
                    label={
                      p.status === 'a-tiempo' ? 'A tiempo'
                      : p.status === 'justo' ? 'Vas justo'
                      : p.status === 'tarde' ? `No alcanzas por ${p.lateBy} min`
                      : noElev ? 'Sin ruta accesible' : 'Sin ruta'
                    }
                  />
                  {p.leaveAt != null && p.status !== 'sin-ruta' ? (
                    <AppText variant="label">
                      {p.fromOrigin ? `Sal a las ${formatClock(p.leaveAt)}` : `Sales ${formatClock(p.leaveAt)}`} · llegas {formatClock(p.arriveAt ?? 0)}
                    </AppText>
                  ) : null}
                  <AppText variant="caption" color="textMuted">
                    {p.status === 'sin-ruta'
                      ? noElev ? `Sin ruta accesible · piso sin ascensor (${floorLabel(p.place.floor ?? 1).toLowerCase()}, Edif. ${p.place.building})` : 'Sin ruta accesible ahora'
                      : `${p.fromOrigin ? `Desde ${p.fromLabel}: ` : ''}${p.minutes} min · tienes ${p.available}${p.extraMinutes > 0 ? ` · +${p.extraMinutes} min por ruta accesible` : ''}`}
                  </AppText>
                </View>
                {p.status === 'justo' || p.status === 'tarde' ? (
                  <Button
                    label="Avisar al profesor"
                    icon="share-outline"
                    variant="secondary"
                    fullWidth
                    onPress={() => notify(p)}
                  />
                ) : null}
                <Button
                  label={noElev ? 'Llévame lo más cerca' : 'Llévame'}
                  icon="navigate"
                  variant="primary"
                  fullWidth
                  accessibilityLabel={`Llévame a ${p.place.name}`}
                  onPress={() => {
                    if (p.fromNodeId && !p.fromOrigin) {
                      prevOrigin.current = origin;
                      setOrigin(p.fromNodeId);
                    }
                    router.push(`/route/${p.place.id}`);
                  }}
                />
                {noElev ? (
                  <Button
                    label="Solicitar sala accesible"
                    icon="share-outline"
                    variant="secondary"
                    fullWidth
                    accessibilityLabel={`Solicitar sala accesible para ${p.cls.course}`}
                    onPress={() => requestRoom(p)}
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const NOW_DATE = new Date();
const TODAY = `${DAYS[NOW_DATE.getDay()].replace(/^./, (c) => c.toUpperCase())} ${NOW_DATE.getDate()} de ${MONTHS[NOW_DATE.getMonth()]}`;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  head: { gap: spacing.xs },
  list: { gap: spacing.lg },
  classCard: { gap: spacing.md },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  leg: { gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1 },
  legText: { gap: spacing.sm },
});
