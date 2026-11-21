import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { RouteMap, type MapBarrier } from '@/components/RouteMap';
import { Screen } from '@/components/Screen';
import { ScreenState } from '@/components/ScreenState';
import { useApp } from '@/context/app-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { EDGES, getNode, getPlace } from '@/lib/routing';
import type { RouteResult } from '@/types';

type Status = 'loading' | 'ready' | 'error';

export default function RouteScreen() {
  const { destId } = useLocalSearchParams<{ destId: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { getRoute, accessibleMode, profile, incidents, elevators } = useApp();
  const t = useAppTheme(accessibleMode);
  const place = destId ? getPlace(destId) : undefined;

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [stepIdx, setStepIdx] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [fullMap, setFullMap] = useState(false);
  const prevRoute = useRef<RouteResult | null>(null);
  const spokeInitial = useRef(false);
  const [noticeAnim] = useState(() => new Animated.Value(0));
  const isLowVision = profile === 'lowVision';

  const load = useCallback(() => {
    let cancelled = false;
    if (!prevRoute.current) setStatus('loading');
    getRoute(destId ?? '').then((r) => {
      if (cancelled) return;
      if (!r) {
        setRoute(null);
        setStatus('error');
        return;
      }
      const prev = prevRoute.current;
      if (prev && prev.edgeIds.join('|') !== r.edgeIds.join('|')) {
        const usedElev = prev.edgeIds
          .map((id) => EDGES.find((e) => e.id === id)?.elevatorId)
          .find((id) => id && elevators.find((el) => el.id === id)?.status === 'down');
        const building = elevators.find((el) => el.id === usedElev)?.building;
        setNotice(
          building
            ? `Recalculamos tu ruta: el ascensor del Edif. ${building} está fuera de servicio`
            : 'Recalculamos tu ruta: hay una barrera reportada en el camino anterior',
        );
        setStepIdx(0);
        noticeAnim.setValue(0);
        Animated.timing(noticeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      prevRoute.current = r;
      setRoute(r);
      setStatus('ready');
    }).catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [getRoute, destId, elevators, noticeAnim]);

  useFocusEffect(load);

  const speak = useCallback((text: string) => {
    Speech.stop();
    Speech.speak(text, { language: 'es-CL' });
  }, []);

  const step = route?.steps[stepIdx];

  // Baja visión: auto-lee al abrir y al cambiar de paso, con háptico.
  useEffect(() => {
    if (!isLowVision || !step) return;
    if (!spokeInitial.current) spokeInitial.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    speak(`Paso ${stepIdx + 1} de ${route!.steps.length}. ${step.text}`);
  }, [isLowVision, step, stepIdx, route, speak]);

  useEffect(() => () => { Speech.stop(); }, []);

  const barriers = useMemo<MapBarrier[]>(() => {
    const out: MapBarrier[] = [];
    const at = (id: string, edgeId?: string, nodeId?: string, elevId?: string) => {
      if (nodeId) {
        const n = getNode(nodeId);
        if (n) out.push({ id, x: n.x, y: n.y });
        return;
      }
      const edges = elevId ? EDGES.filter((e) => e.elevatorId === elevId) : EDGES.filter((e) => e.id === edgeId);
      for (const e of edges) {
        const a = getNode(e.from);
        const b = getNode(e.to);
        if (a && b) out.push({ id: `${id}-${e.id}`, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    };
    incidents.forEach((i) => at(i.id, i.edgeId, i.nodeId, i.type === 'elevator' ? i.elevatorId : undefined));
    elevators.filter((e) => e.status === 'down').forEach((e) => at(`el-${e.id}`, undefined, undefined, e.id));
    return out;
  }, [incidents, elevators]);

  const styles = useMemo(() => makeStyles(t), [t]);

  const goReport = () =>
    router.push({
      pathname: '/report',
      params: { edgeIds: route?.edgeIds.join(',') ?? '', dest: destId ?? '' },
    });

  if (status === 'loading') {
    return (
      <Screen>
        <ScreenState variant="loading" title="Buscando tu ruta accesible" message="Evitando escaleras y barreras reportadas…" />
      </Screen>
    );
  }

  if (status === 'error' || !route || !place) {
    return (
      <Screen>
        <ScreenState
          variant="error"
          title="No encontramos una ruta accesible"
          message="Puede que un ascensor esté fuera de servicio o un tramo esté bloqueado. Prueba con otro punto de partida."
          actionLabel="Cambiar origen"
          onAction={() => router.replace('/home')}
        />
        <Button label="Volver" variant="ghost" fullWidth onPress={() => router.back()} />
      </Screen>
    );
  }

  const mapW = width - t.spacing.lg * 2;
  const lastIdx = route.steps.length - 1;
  const currentNode = step ? getNode(step.fromNodeId) : undefined;
  const mapLabel = `Mapa de la ruta hacia ${place.name}. Toca para ampliar.`;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">{place.name}</AppText>
        <AppText color="textMuted">
          {place.building ? `Edif. ${place.building} · ` : ''}Piso {place.floor}
        </AppText>
      </View>

      {notice ? (
        <Animated.View
          style={{
            opacity: noticeAnim,
            transform: [{ translateY: noticeAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          }}>
          <Banner tone="info" text={notice} />
        </Animated.View>
      ) : null}

      <Card accessibilityLabel={`${route.minutes} minutos, ${route.distanceM} metros, ${route.stairsCount} escalones`} style={styles.summary}>
        <View style={styles.row}>
          <View style={styles.stat}>
            <AppText variant="display">{route.minutes}</AppText>
            <AppText color="textMuted" variant="label">min</AppText>
          </View>
          <View style={styles.stat}>
            <AppText variant="display">{route.distanceM}</AppText>
            <AppText color="textMuted" variant="label">metros</AppText>
          </View>
        </View>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: route.stairsCount === 0 ? t.colors.successSoft : t.colors.warningSoft }]}>
            <Ionicons
              name={route.stairsCount === 0 ? 'checkmark-circle' : 'warning'}
              size={18}
              color={route.stairsCount === 0 ? t.colors.success : t.colors.warning}
            />
            <AppText variant="label" style={{ color: route.stairsCount === 0 ? t.colors.success : t.colors.warning }}>
              {route.stairsCount} escalones
            </AppText>
          </View>
          {route.stepsAvoided > 0 ? (
            <AppText variant="label" color="textMuted">Evitas {route.stepsAvoided} escalones</AppText>
          ) : null}
        </View>
      </Card>

      <Pressable onPress={() => setFullMap(true)} accessibilityRole="button" accessibilityLabel={mapLabel}>
        <RouteMap
          route={route}
          width={mapW}
          height={Math.round(mapW * 0.75)}
          barriers={barriers}
          current={currentNode}
          accessibleMode={accessibleMode}
          label={mapLabel}
        />
        <View style={styles.expand}>
          <Ionicons name="expand" size={18} color={t.colors.primary} />
        </View>
      </Pressable>

      <View style={styles.legend}>
        <LegendDot color={t.colors.success} label="Origen" t={t} />
        <LegendDot color={t.colors.text} label="Destino" t={t} />
        <LegendDot color={t.colors.danger} label="Barrera" t={t} />
      </View>

      {route.avoided.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">Lo que evitamos</AppText>
          {route.avoided.map((a) => (
            <View key={a.text} style={styles.avoided} accessible accessibilityLabel={`${a.text}. ${a.reason}`}>
              <Ionicons name="close-circle" size={24} color={t.colors.danger} />
              <View style={styles.flex}>
                <AppText variant="label">{a.text}</AppText>
                <AppText variant="caption" color="textMuted">{a.reason}</AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">Paso a paso</AppText>
        {route.steps.map((s, i) => {
          const active = i === stepIdx;
          return (
            <Pressable
              key={`${s.fromNodeId}-${i}`}
              onPress={() => setStepIdx(i)}
              accessibilityRole="button"
              accessibilityLabel={`Paso ${i + 1}: ${s.text}, ${s.distanceM} metros`}
              accessibilityState={{ selected: active }}
              style={[styles.step, active && styles.stepActive]}>
              <View style={[styles.stepNum, active && { backgroundColor: t.colors.primary }]}>
                <AppText variant="label" style={{ color: active ? t.colors.primaryText : t.colors.text }}>{i + 1}</AppText>
              </View>
              <MaterialCommunityIcons
                name={s.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={26}
                color={active ? t.colors.primary : t.colors.textMuted}
              />
              <View style={styles.flex}>
                <AppText variant={active ? 'label' : 'body'}>{s.text}</AppText>
              </View>
              <AppText variant="caption" color="textMuted">{s.distanceM} m</AppText>
            </Pressable>
          );
        })}
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label="Anterior" variant="secondary" fullWidth disabled={stepIdx === 0} onPress={() => setStepIdx((i) => Math.max(0, i - 1))} />
          </View>
          <View style={styles.flex}>
            <Button label="Siguiente paso" fullWidth disabled={stepIdx >= lastIdx} onPress={() => setStepIdx((i) => Math.min(lastIdx, i + 1))} />
          </View>
        </View>
        <Button
          label="Escuchar ruta"
          icon="volume-high"
          variant="secondary"
          fullWidth
          onPress={() => step && speak(`Paso ${stepIdx + 1} de ${route.steps.length}. ${step.text}`)}
        />
      </View>

      <Button
        label="Reportar una barrera en esta ruta"
        icon="alert-circle-outline"
        variant="ghost"
        fullWidth
        onPress={goReport}
      />

      <Modal visible={fullMap} animationType="fade" transparent onRequestClose={() => setFullMap(false)}>
        <View style={[styles.modal, { backgroundColor: t.colors.overlay }]}>
          <RouteMap
            route={route}
            width={width - t.spacing.lg * 2}
            height={Math.round(height * 0.7)}
            barriers={barriers}
            current={currentNode}
            accessibleMode={accessibleMode}
            label={`Mapa ampliado de la ruta hacia ${place.name}`}
          />
          <View style={styles.modalBtn}>
            <Button label="Cerrar mapa" icon="close" fullWidth onPress={() => setFullMap(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function LegendDot({ color, label, t }: { color: string; label: string; t: ReturnType<typeof useAppTheme> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
      <View style={{ width: 12, height: 12, borderRadius: t.radius.pill, backgroundColor: color }} />
      <AppText variant="caption" color="textMuted">{label}</AppText>
    </View>
  );
}

const makeStyles = (t: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    header: { gap: t.spacing.xs },
    row: { flexDirection: 'row', gap: t.spacing.md },
    summary: { gap: t.spacing.md },
    stat: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.sm },
    badges: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, flexWrap: 'wrap' },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
      borderRadius: t.radius.pill,
    },
    expand: {
      position: 'absolute',
      right: t.spacing.sm,
      top: t.spacing.sm,
      width: 44,
      height: 44,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    legend: { flexDirection: 'row', gap: t.spacing.lg, justifyContent: 'center' },
    section: { gap: t.spacing.md },
    avoided: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.dangerSoft,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: t.minTouch,
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      borderWidth: 2,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    stepActive: { borderColor: t.colors.primary, backgroundColor: t.colors.primarySoft },
    stepNum: {
      width: 32,
      height: 32,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modal: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.lg, padding: t.spacing.lg },
    modalBtn: { alignSelf: 'stretch' },
  });
