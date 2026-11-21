import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { CampusMap } from '@/components/CampusMap';
import { FloorRail } from '@/components/FloorRail';
import { Button } from '@/components/Button';
import { InstructionCard } from '@/components/InstructionCard';
import { ScreenState } from '@/components/ScreenState';
import { useApp } from '@/context/app-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useRouteSimulation } from '@/hooks/use-route-simulation';
import { FLOORPLANS, getFloorPlan } from '@/lib/campus-map';
import { getNode, getPlace } from '@/lib/routing';
import type { RouteResult } from '@/types';

type Status = 'loading' | 'ready' | 'error';

export default function NavigateScreen() {
  const { destId } = useLocalSearchParams<{ destId: string }>();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { getRoute, accessibleMode, profile } = useApp();
  const t = useAppTheme(accessibleMode);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(t), [t]);
  const place = destId ? getPlace(destId) : undefined;

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [voice, setVoice] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mapH, setMapH] = useState(0);
  const [cardH, setCardH] = useState(180);
  const sim = useRouteSimulation(route);

  useEffect(() => {
    let cancelled = false;
    getRoute(destId ?? '')
      .then((r) => {
        if (cancelled) return;
        setRoute(r);
        setStatus(r ? 'ready' : 'error');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => { cancelled = true; };
  }, [getRoute, destId, attempt]);

  const speakOn = profile === 'lowVision' || voice;
  const step = route?.steps[sim.stepIndex];

  // Voz + háptico al cambiar de maniobra (no en cada paso interno) y aviso previo a 15 m
  const lastSpoken = useRef<string>('');
  const warned = useRef<string>('');
  const m = sim.currentManeuver;
  useEffect(() => {
    if (!route || !m) return;
    const key = sim.finished ? 'done' : `m${sim.maneuverIndex}`;
    if (key === lastSpoken.current) return;
    lastSpoken.current = key;
    if (sim.finished) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (speakOn) { Speech.stop(); Speech.speak(`Llegaste a ${place?.name ?? 'tu destino'}`, { language: 'es-CL' }); }
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (speakOn) {
      Speech.stop();
      Speech.speak(m.text, { language: 'es-CL' });
    }
  }, [route, m, sim.maneuverIndex, sim.finished, speakOn, place?.name]);

  useEffect(() => {
    if (!m || sim.finished || !speakOn || m.type === 'straight' || m.type === 'arrive') return;
    const key = `w${sim.maneuverIndex}`;
    if (warned.current === key || sim.distanceToManeuverM > 15 || sim.distanceToManeuverM < 8) return;
    warned.current = key;
    Speech.stop();
    Speech.speak(`En 15 metros, ${m.verb}`, { language: 'es-CL' });
  }, [m, sim.maneuverIndex, sim.distanceToManeuverM, sim.finished, speakOn]);

  useEffect(() => () => { Speech.stop(); }, []);

  // Modo del mapa superior: planta (floor) dentro de un edificio con plano, macro afuera
  const routePts = useMemo<[number, number][]>(() => (route?.polyline ?? []).map((p) => [p.x, p.y]), [route]);
  const donePts = useMemo<[number, number][]>(() => {
    if (!route) return [];
    return [...route.polyline.slice(0, sim.segIndex + 1).map((p): [number, number] => [p.x, p.y]), [sim.point.x, sim.point.y]];
  }, [route, sim.segIndex, sim.point]);
  const originB = route ? getNode(route.nodeIds[0])?.building : undefined;
  const sameBuilding = !!originB && originB === place?.building;
  const floorB = sim.inside && sim.building ? sim.building : sameBuilding ? originB : undefined;
  const floorLevel = sim.level ?? place?.floor ?? 1;
  const hasPlan = !!floorB && !!getFloorPlan(floorB, floorLevel);
  const mode = hasPlan ? 'inside' : 'outside';
  const destRoomId = useMemo(() => {
    if (!place?.building || place.building !== floorB) return undefined;
    const rooms = getFloorPlan(floorB, place.floor)?.rooms ?? [];
    const pid = place.id.toLowerCase();
    return rooms.find((r) => {
      const rid = r.id.toLowerCase();
      const short = rid.replace(/^[a-z]-/, '');
      return rid === pid || rid === `${floorB.toLowerCase()}-${pid}` || pid === short || pid.startsWith(`${short}-`);
    })?.id;
  }, [place, floorB]);
  const [fade] = useState(() => new Animated.Value(1));
  const [shown, setShown] = useState<'inside' | 'outside'>(mode);
  useEffect(() => {
    if (mode === shown) return;
    Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      setShown(mode);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }, [mode, shown, fade]);

  const close = () => { Speech.stop(); router.back(); };

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.root}>
        <ScreenState variant="loading" title="Preparando tu navegación" message="Calculando la ruta accesible…" />
      </SafeAreaView>
    );
  }
  if (status === 'error' || !route || !place || !step) {
    return (
      <SafeAreaView style={styles.root}>
        <ScreenState
          variant="error"
          title="No pudimos iniciar la navegación"
          message="No hay una ruta accesible disponible hacia este destino."
          actionLabel="Reintentar"
          onAction={() => { setStatus('loading'); setAttempt((a) => a + 1); }}
        />
        <View style={styles.pad}><Button label="Volver" variant="secondary" fullWidth onPress={close} /></View>
      </SafeAreaView>
    );
  }

  const topH = Math.round(height * 0.3);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar navegación" style={styles.iconBtn}>
          <Ionicons name="close" size={26} color={t.colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <AppText variant="caption" color="textMuted">Navegando hacia</AppText>
          <AppText variant="heading" numberOfLines={1} accessibilityRole="header">{place.name}</AppText>
        </View>
      </View>

      <Animated.View style={[styles.top, { height: topH, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
        {shown === 'inside' && floorB ? (
          <>
            <CampusMap
              mode="floor"
              routePoints={routePts}
              donePoints={donePts}
              position={sim.point}
              heading={sim.heading}
              activeBuildingId={floorB}
              level={floorLevel}
              destRoomId={destRoomId}
              height={topH}
              title={`Edificio ${floorB} | Piso ${floorLevel}`}
            />
            <View style={styles.rail} pointerEvents="none">
              <FloorRail
                levels={FLOORPLANS[floorB]?.levels ?? []}
                current={floorLevel}
                dest={place.building === floorB ? place.floor : undefined}
              />
            </View>
          </>
        ) : (
          <CampusMap
            mode="macro"
            routePoints={routePts}
            donePoints={donePts}
            position={sim.point}
            heading={sim.heading}
            origin={route.polyline[0]}
            destination={route.polyline[route.polyline.length - 1]}
            activeBuildingId={place.building}
            height={topH}
            title="Mapa | Exterior"
          />
        )}
      </Animated.View>

      <View style={[styles.divider, { backgroundColor: t.colors.primary }]} />

      <View style={styles.flex} onLayout={(e) => setMapH(Math.round(e.nativeEvent.layout.height))}>
        {mapH > 0 ? <CampusMap
          mode="closeup"
          routePoints={routePts}
          donePoints={donePts}
          position={sim.point}
          heading={sim.heading}
          level={sim.level}
          activeBuildingId={place.building}
          destRoomId={destRoomId}
          destination={route.polyline[route.polyline.length - 1]}
          anchorY={Math.max(40, (mapH - (cardH + t.spacing.md * 2 + insets.bottom)) * 0.6) / mapH}
          height={mapH}
        /> : null}
      </View>

      <InstructionCard
        sim={sim}
        route={route}
        place={place}
        accessibleMode={accessibleMode}
        speakOn={speakOn}
        onToggleVoice={() => { Speech.stop(); setVoice((v) => !v); }}
        onHome={() => { Speech.stop(); router.replace('/home'); }}
        onLayout={(e) => setCardH(Math.round(e.nativeEvent.layout.height))}
      />
    </SafeAreaView>
  );
}

const makeStyles = (t: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    flex: { flex: 1 },
    pad: { padding: t.spacing.lg },
    header: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.xs },
    iconBtn: { width: t.minTouch, height: t.minTouch, alignItems: 'center', justifyContent: 'center' },
    top: { overflow: 'hidden', backgroundColor: t.colors.surface },
    divider: { height: 4 },
    rail: { position: 'absolute', right: t.spacing.sm, top: t.spacing.sm },
  });
