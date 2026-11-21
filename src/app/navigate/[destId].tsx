import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { CampusMap, type MapCamera } from '@/components/CampusMap';
import { FloorRail } from '@/components/FloorRail';
import { Button } from '@/components/Button';
import { InstructionCard } from '@/components/InstructionCard';
import { ScreenState } from '@/components/ScreenState';
import { useApp } from '@/context/app-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useRouteSimulation } from '@/hooks/use-route-simulation';
import { HAPTIC_CODE, HAPTIC_LEGEND_SHORT, playManeuverHaptic, playPreAlert } from '@/lib/haptics';
import { getBuilding } from '@/lib/buildings';
import { CAMPUS_MAP, FLOORPLANS, getFloorPlan } from '@/lib/campus-map';
import { EDGES, getNode, getPlace } from '@/lib/routing';
import type { RouteResult } from '@/types';

// El mapa superior solo muestra tu posición (sin línea de ruta), estilo guía del Louvre.
const NO_ROUTE: [number, number][] = [];

type Status = 'loading' | 'ready' | 'error';

export default function NavigateScreen() {
  const { destId } = useLocalSearchParams<{ destId: string }>();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { getRoute, accessibleMode, profile, incidents } = useApp();
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

  // Lector de pantalla: si TalkBack está activo se anuncia con él y no se usa expo-speech
  const [screenReader, setScreenReader] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => sub.remove();
  }, []);

  const say = useCallback((text: string, force = false) => {
    if (screenReader) {
      AccessibilityInfo.announceForAccessibility(text);
    } else if (speakOn || force) {
      Speech.stop();
      Speech.speak(text, { language: 'es-CL' });
    }
  }, [screenReader, speakOn]);

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
      playManeuverHaptic('arrive');
      say(`Llegaste a ${place?.name ?? 'tu destino'}`);
      return;
    }
    playManeuverHaptic(m.type);
    say(m.spoken ?? m.text);
  }, [route, m, sim.maneuverIndex, sim.finished, place?.name, say]);

  useEffect(() => {
    if (!m || sim.finished || m.type === 'straight' || m.type === 'arrive') return;
    const key = `w${sim.maneuverIndex}`;
    if (warned.current === key || sim.distanceToManeuverM > 15 || sim.distanceToManeuverM < 8) return;
    warned.current = key;
    playPreAlert();
    say(`En 15 metros, ${m.verb}`);
  }, [m, sim.maneuverIndex, sim.distanceToManeuverM, sim.finished, say]);

  const repeat = useCallback(() => {
    if (!m) return;
    playManeuverHaptic(sim.finished ? 'arrive' : m.type);
    say(sim.finished ? `Llegaste a ${place?.name ?? 'tu destino'}` : (m.spoken ?? m.text), true);
  }, [m, sim.finished, place?.name, say]);

  useEffect(() => () => { Speech.stop(); }, []);

  // Modo del mapa superior: planta (floor) dentro de un edificio con plano, macro afuera
  const routePts = useMemo<[number, number][]>(() => (route?.polyline ?? []).map((p) => [p.x, p.y]), [route]);
  const donePts = useMemo<[number, number][]>(() => {
    if (!route) return [];
    return [...route.polyline.slice(0, sim.segIndex + 1).map((p): [number, number] => [p.x, p.y]), [sim.point.x, sim.point.y]];
  }, [route, sim.segIndex, sim.point]);
  const barriers = useMemo(() => {
    const out: { x: number; y: number; kind: 'incident' }[] = [];
    incidents.forEach((i) => {
      if (i.nodeId) {
        const n = getNode(i.nodeId);
        if (n) out.push({ x: n.x, y: n.y, kind: 'incident' });
      } else if (i.edgeId) {
        const e = EDGES.find((x) => x.id === i.edgeId);
        const a = e && getNode(e.from);
        const b = e && getNode(e.to);
        if (a && b) out.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, kind: 'incident' });
      }
    });
    return out;
  }, [incidents]);
  const turnPoint = route && sim.currentManeuver && !sim.finished ? route.polyline[sim.currentManeuver.atIndex] : undefined;
  const avoidStairs = profile === 'wheelchair' || profile === 'crutches';
  const originB = route ? getNode(route.nodeIds[0])?.building : undefined;
  const sameBuilding = !!originB && originB === place?.building;
  const floorB = sim.inside && sim.building ? sim.building : sameBuilding ? originB : undefined;
  const floorLevel = sim.level ?? place?.floor ?? 1;
  const hasPlan = !!floorB && !!getFloorPlan(floorB, floorLevel);
  const autoB = hasPlan ? floorB : undefined;

  // Exploración manual del mapa superior
  const [explore, setExplore] = useState<{ building?: string; level?: number; camera?: MapCamera | null }>({});
  const [tip, setTip] = useState<string | null>(null);
  const lastInteract = useRef(0);
  const touch = () => { lastInteract.current = Date.now(); };
  const accessLevel = (id: string) => getBuilding(id)?.entrances[0]?.level ?? FLOORPLANS[id]?.levels[0] ?? 1;
  const expLevel = explore.building ? explore.level ?? accessLevel(explore.building) : undefined;
  const expHasPlan = !!explore.building && expLevel !== undefined && !!getFloorPlan(explore.building, expLevel);
  const dispB = explore.building ? (expHasPlan ? explore.building : undefined) : autoB;
  const dispLevel = explore.building && expLevel !== undefined ? expLevel : floorLevel;
  const exploring = !!explore.camera || explore.building !== undefined;
  const mode = dispB ? 'inside' : 'outside';
  const resolveRoom = useCallback((b: string | undefined, lv: number) => {
    if (!place?.building || place.building !== b || lv !== place.floor) return undefined;
    const rooms = getFloorPlan(b, place.floor)?.rooms ?? [];
    const pid = place.id.toLowerCase();
    return rooms.find((r) => {
      const rid = r.id.toLowerCase();
      const short = rid.replace(/^[a-z]-/, '');
      return rid === pid || rid === `${b.toLowerCase()}-${pid}` || pid === short || pid.startsWith(`${short}-`);
    })?.id;
  }, [place]);
  const destRoomId = resolveRoom(floorB, place?.floor ?? -1);
  const topRoomId = resolveRoom(dispB, dispLevel);
  const atUser = !exploring || (dispB === autoB && dispLevel === floorLevel);

  const resetExplore = useCallback(() => { setExplore({}); setTip(null); }, []);
  const onCamera = useCallback((c: MapCamera) => { touch(); setExplore((e) => ({ ...e, camera: c })); }, []);
  const onBuildingPress = useCallback((id: string) => {
    touch();
    const hasAny = (FLOORPLANS[id]?.levels ?? []).length > 0;
    if (hasAny) {
      setTip(null);
      setExplore({ building: id, level: id === floorB ? floorLevel : undefined, camera: null });
    } else {
      setTip(CAMPUS_MAP.buildings.find((b) => b.id === id)?.name ?? `Edificio ${id}`);
    }
  }, [floorB, floorLevel]);
  useEffect(() => {
    if (!tip) return;
    const id = setTimeout(() => setTip(null), 2500);
    return () => clearTimeout(id);
  }, [tip]);
  // Retoma el seguimiento al cambiar de maniobra tras >8 s sin interacción
  useEffect(() => {
    if (exploring && Date.now() - lastInteract.current > 8000) resetExplore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.maneuverIndex]);
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
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar navegación" accessibilityHint="Termina la guía y vuelve atrás" style={styles.iconBtn}>
          <Ionicons name="close" size={26} color={t.colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <AppText variant="caption" color="textMuted" style={{ fontSize: 12, lineHeight: 16 }}>Navegando hacia</AppText>
          <AppText variant="heading" numberOfLines={1} accessibilityRole="header" style={accessibleMode ? undefined : { fontSize: 17, lineHeight: 22 }}>{place.name}</AppText>
        </View>
        <Pressable
          onPress={() => setHelpOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Ayuda de vibraciones"
          accessibilityHint="Abre la leyenda de patrones de vibración"
          style={styles.iconBtn}>
          <Ionicons name="help-circle-outline" size={28} color={t.colors.text} />
        </Pressable>
      </View>

      <Animated.View style={[styles.top, { height: topH, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
        {shown === 'inside' && dispB ? (
          <>
            <CampusMap
              mode="floor"
              routePoints={NO_ROUTE}
              donePoints={undefined}
              position={atUser ? sim.point : undefined}
              heading={sim.heading}
              activeBuildingId={dispB}
              level={dispLevel}
              destRoomId={topRoomId}
              height={topH}
              insetRight={56}
              insetTop={exploring ? 92 : 40}
              camera={explore.camera}
              onCameraChange={onCamera}
              onBuildingPress={onBuildingPress}
              accessibilityLabel={`Mapa: planta del edificio ${dispB}, piso ${dispLevel}${sim.zone ? `. Estás en ${sim.zone}` : ''}. Tu destino es ${place.name}.`}
              title={`Edificio ${dispB} | Piso ${dispLevel}${exploring ? ' · explorando' : ''}`}
            />
            <View style={styles.rail}>
              <FloorRail
                levels={FLOORPLANS[dispB]?.levels ?? []}
                current={dispLevel}
                dest={place.building === dispB ? place.floor : undefined}
                onSelect={(lv) => { touch(); setExplore((e) => ({ building: dispB, level: lv, camera: e.building === dispB ? e.camera : null })); }}
              />
            </View>
          </>
        ) : (
          <CampusMap
            mode="macro"
            routePoints={NO_ROUTE}
            donePoints={undefined}
            position={sim.point}
            heading={sim.heading}
            origin={undefined}
            destination={route.polyline[route.polyline.length - 1]}
            activeBuildingId={place.building}
            height={topH}
            camera={explore.camera}
            onCameraChange={onCamera}
            onBuildingPress={onBuildingPress}
            accessibilityLabel={`Mapa: campus${sim.zone ? `. Estás en ${sim.zone}` : ''}. Tu destino es ${place.name}.`}
            title={`Mapa | Exterior${exploring ? ' · explorando' : ''}`}
          />
        )}
        {tip ? (
          <View style={styles.tip} pointerEvents="none">
            <AppText variant="caption" style={{ color: t.colors.primaryText, fontWeight: '700' }}>{tip}</AppText>
          </View>
        ) : null}
        {exploring ? (
          <Pressable
            onPress={resetExplore}
            accessibilityRole="button"
            accessibilityLabel="Volver a mi posición"
            style={styles.recenter}>
            <MaterialCommunityIcons name="crosshairs-gps" size={20} color={t.colors.primaryText} />
            <AppText variant="caption" style={{ color: t.colors.primaryText, fontWeight: '700' }}>Mi posición</AppText>
          </Pressable>
        ) : null}
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
          barriers={barriers}
          turnPoint={turnPoint}
          avoidStairs={avoidStairs}
          anchorY={Math.max(40, (mapH - (cardH + t.spacing.md * 2 + insets.bottom)) * 0.6) / mapH}
          height={mapH}
          accessibilityLabel={`Vista cercana${sim.zone ? `: estás en ${sim.zone}` : ''}. Sigue las instrucciones de la tarjeta inferior.`}
        /> : null}
      </View>

      <InstructionCard
        sim={sim}
        route={route}
        place={place}
        accessibleMode={accessibleMode}
        speakOn={speakOn}
        onToggleVoice={() => { Speech.stop(); setVoice((v) => !v); }}
        onRepeat={repeat}
        onHome={() => { Speech.stop(); router.replace('/home'); }}
        onLayout={(e) => setCardH(Math.round(e.nativeEvent.layout.height))}
      />

      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <AppText variant="title" accessibilityRole="header">Código de vibraciones</AppText>
            <AppText color="textMuted" accessibilityLabel={HAPTIC_LEGEND_SHORT}>{HAPTIC_LEGEND_SHORT}</AppText>
            {Object.values(HAPTIC_CODE).map((c) => (
              <View key={c.label} accessible accessibilityLabel={`${c.label}: ${c.pattern}`} style={styles.codeRow}>
                <AppText variant="label" style={styles.flex}>{c.label}</AppText>
                <AppText variant="label" color="primary" style={styles.codePattern}>{c.pattern}</AppText>
              </View>
            ))}
            <Button label="Entendido" fullWidth onPress={() => setHelpOpen(false)} />
          </View>
        </View>
      </Modal>
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
    tip: { position: 'absolute', bottom: t.spacing.sm, alignSelf: 'center', paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.xs, borderRadius: t.radius.pill, backgroundColor: t.colors.primary },
    recenter: {
      position: 'absolute', left: t.spacing.sm, top: t.spacing.sm + 34, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs,
      paddingHorizontal: t.spacing.md, borderRadius: t.radius.pill, backgroundColor: t.colors.primary, ...t.shadow,
    },
    backdrop: { flex: 1, justifyContent: 'center', padding: t.spacing.lg, backgroundColor: t.colors.overlaySurface },
    sheet: { gap: t.spacing.md, padding: t.spacing.lg, borderRadius: t.radius.lg, borderWidth: 2, borderColor: t.colors.border, backgroundColor: t.colors.surface },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 44 },
    codePattern: { flexShrink: 1, maxWidth: '60%', textAlign: 'right' },
    rail: { position: 'absolute', right: t.spacing.sm, top: t.spacing.sm },
  });
