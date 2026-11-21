import type React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, findNodeHandle, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { CampusMap, type MapCamera } from '@/components/CampusMap';
import { FloorRail } from '@/components/FloorRail';
import { Button } from '@/components/Button';
import { InstructionCard } from '@/components/InstructionCard';
import { ScreenState } from '@/components/ScreenState';
import { useApp } from '@/context/app-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useRouteSimulation } from '@/hooks/use-route-simulation';
import { HAPTIC_CODE, HAPTIC_LEGEND_SHORT, playManeuverHaptic, playPreAlert } from '@/lib/haptics';
import { getBuilding, floorLabel } from '@/lib/buildings';
import { CAMPUS_MAP, FLOORPLANS, getFloorPlan } from '@/lib/campus-map';
import { EDGES, getNode, getPlace } from '@/lib/routing';
import { remainingText } from '@/lib/support-ticket';
import type { RouteResult } from '@/types';
import type { LayoutChangeEvent } from 'react-native';

// El mapa superior solo muestra tu posición (sin línea de ruta), estilo guía del Louvre.
const NO_ROUTE: [number, number][] = [];

type Status = 'loading' | 'ready' | 'error';

export default function NavigateScreen() {
  // partial='1': la ruta no llega al destino, sino al punto alcanzable mas
  // cercano. El apoyo del ticket cubre lo que falta desde ahi.
  const { destId, partial } = useLocalSearchParams<{ destId: string; partial?: string }>();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { getRoute, getNearestReachable, setOrigin, resolveTicket, tickets, accessibleMode, profile, incidents, elevators, confirmIncident, denyIncident } = useApp();
  const t = useAppTheme(accessibleMode);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(t), [t]);
  const place = destId ? getPlace(destId) : undefined;
  const esParcial = partial === '1';
  // Congelado al montar: al llegar cambia el origen y no debe recalcularse la guía en curso.
  const [nearest] = useState(() => (esParcial && destId ? getNearestReachable(destId) : null));
  /** Hasta donde guia esta navegacion de verdad. */
  const destLabel = nearest ? nearest.reachedLabel : place?.name ?? 'tu destino';

  const ticket = useMemo(
    () => (esParcial && place ? tickets.find((x) => x.placeId === place.id && x.status !== 'resolved') ?? null : null),
    [esParcial, place, tickets],
  );

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [voice, setVoice] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [mapH, setMapH] = useState(0);
  const [cardH, setCardH] = useState(180);
  const sim = useRouteSimulation(route, esParcial);
  const reduceMotion = useReduceMotion();
  // Ruta congelada: solo se calcula al montar y en "Reintentar"
  const getRouteRef = useRef(getRoute);
  useEffect(() => { getRouteRef.current = getRoute; }, [getRoute]);
  const nearestRef = useRef(nearest);
  useEffect(() => { nearestRef.current = nearest; }, [nearest]);

  useEffect(() => {
    let cancelled = false;
    if (esParcial) {
      const r = nearestRef.current?.route ?? null;
      setRoute(r);
      setStatus(r && r.steps.length ? 'ready' : 'error');
      return () => { cancelled = true; };
    }
    getRouteRef.current(destId ?? '')
      .then((r) => {
        if (cancelled) return;
        setRoute(r);
        setStatus(r ? 'ready' : 'error');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => { cancelled = true; };
  }, [destId, attempt, esParcial]);

  // Al llegar, la siguiente ruta parte desde el nodo alcanzado (destino, o el punto alcanzable si es parcial).
  const arrivedNode = nearest?.reachedNodeId ?? place?.nodeId;
  useEffect(() => {
    if (sim.finished && arrivedNode) setOrigin(arrivedNode);
  }, [sim.finished, arrivedNode, setOrigin]);

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

  // Con lector de pantalla la tarjeta es live region; announce solo para el aviso de 15 m y acciones explícitas (force)
  const say = useCallback((text: string, force = false, alert = false) => {
    if (screenReader) {
      if (alert || force) AccessibilityInfo.announceForAccessibility(text);
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
      say(esParcial ? `Llegaste al punto de encuentro, ${destLabel}. Aquí te espera el apoyo` : `Llegaste a ${destLabel}`);
      return;
    }
    playManeuverHaptic(m.type);
    say(m.spoken ?? m.text);
  }, [route, m, sim.maneuverIndex, sim.finished, destLabel, esParcial, say]);

  useEffect(() => {
    if (!m || sim.finished || m.type === 'straight' || m.type === 'arrive') return;
    const key = `w${sim.maneuverIndex}`;
    if (warned.current === key || sim.distanceToManeuverM > 15) return;
    warned.current = key;
    playPreAlert();
    say(`En 15 metros, ${m.verb}`, false, true);
  }, [m, sim.maneuverIndex, sim.distanceToManeuverM, sim.finished, say]);

  const repeat = useCallback(() => {
    if (!m) return;
    playManeuverHaptic(sim.finished ? 'arrive' : m.type);
    say(sim.finished ? (esParcial ? `Llegaste al punto de encuentro, ${destLabel}` : `Llegaste a ${destLabel}`) : (m.spoken ?? m.text), true);
  }, [m, sim.finished, destLabel, esParcial, say]);

  const toggleVoice = useCallback(() => {
    Speech.stop();
    if (!voice && m && !sim.finished) say(m.spoken ?? m.text, true);
    setVoice((v) => !v);
  }, [voice, m, sim.finished, say]);
  const goHome = useCallback(() => { Speech.stop(); router.replace('/home'); }, [router]);
  const onCardLayout = useCallback((e: LayoutChangeEvent) => setCardH(Math.round(e.nativeEvent.layout.height)), []);

  useEffect(() => () => { Speech.stop(); }, []);

  // Modo del mapa superior: planta (floor) dentro de un edificio con plano, macro afuera
  const routePts = useMemo<[number, number][]>(() => (route?.polyline ?? []).map((p) => [p.x, p.y]), [route]);
  const donePts = useMemo<[number, number][]>(() => {
    if (!route) return [];
    return [...route.polyline.slice(0, sim.segIndex + 1).map((p): [number, number] => [p.x, p.y]), [sim.point.x, sim.point.y]];
  }, [route, sim.segIndex, sim.point]);
  const topRoute = accessibleMode ? routePts : NO_ROUTE;
  const topDone = accessibleMode ? donePts : undefined;
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

  // Prompt de confirmación: ascensor con incidente (o evitado) a ≤20 m, una vez por ascensor
  const [answered, setAnswered] = useState<string[]>([]);
  const announced = useRef<string>('');
  const mPerPct = useMemo(() => {
    if (!route) return 1;
    const lenPct = route.polyline.reduce((acc, p, i, a) => (i ? acc + Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) : acc), 0);
    return lenPct > 0 ? route.distanceM / lenPct : 1;
  }, [route]);
  const avoidedIds = useMemo(
    () => new Set(route ? route.avoided.filter((a) => a.kind === 'incident').map((a) => EDGES.find((e) => e.id === a.edgeId)?.elevatorId).filter(Boolean) : []),
    [route],
  );
  const promptCandidates = useMemo(
    () => elevators
      .filter((el) => el.status !== 'ok' && !!el.incidentId && !answered.includes(el.id) && avoidedIds.has(el.id))
      .map((el) => ({
        el,
        pts: EDGES.filter((e) => e.elevatorId === el.id).map((e) => getNode(e.from)).filter((n): n is NonNullable<typeof n> => !!n),
      })),
    [elevators, answered, avoidedIds],
  );
  const promptElevator = useMemo(() => {
    if (!route || sim.finished) return undefined;
    return promptCandidates.find(({ el, pts }) =>
      (sim.inside && sim.building === el.building) ||
      pts.some((n) => Math.hypot(n.x - sim.point.x, n.y - sim.point.y) * mPerPct <= 20),
    )?.el;
  }, [route, promptCandidates, mPerPct, sim.point, sim.inside, sim.building, sim.finished]);
  const respond = useCallback((stillDown: boolean) => {
    if (!promptElevator?.incidentId) return;
    if (stillDown) confirmIncident(promptElevator.incidentId);
    else denyIncident(promptElevator.incidentId);
    setAnswered((a) => [...a, promptElevator.id]);
    say('Gracias por avisar');
  }, [promptElevator, confirmIncident, denyIncident, say]);
  useEffect(() => {
    if (!promptElevator || announced.current === promptElevator.id) return;
    announced.current = promptElevator.id;
    say(`¿El ascensor del edificio ${promptElevator.building} sigue fuera de servicio? Responde sí o ya funciona.`);
  }, [promptElevator, say]);

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
  const onCamera = useCallback((c: MapCamera) => { setExplore((e) => ({ ...e, camera: c })); }, []);
  const onBuildingPress = useCallback((id: string) => {
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
  // Auto-retorno: 8 s sin interacción (cada cambio de `explore` reinicia el temporizador)
  useEffect(() => {
    if (!exploring) return;
    const id = setTimeout(resetExplore, 8000);
    return () => clearTimeout(id);
  }, [explore, exploring, resetExplore]);
  const [fade] = useState(() => new Animated.Value(1));
  const [shown, setShown] = useState<'inside' | 'outside'>(mode);
  useEffect(() => {
    if (mode === shown) return;
    Animated.timing(fade, { toValue: 0, duration: reduceMotion ? 0 : 160, useNativeDriver: true }).start(() => {
      setShown(mode);
      Animated.timing(fade, { toValue: 1, duration: reduceMotion ? 0 : 220, useNativeDriver: true }).start();
    });
  }, [mode, shown, fade, reduceMotion]);

  // Modal de vibraciones: foco al título al abrir
  const helpTitle = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!helpOpen) return;
    const id = setTimeout(() => {
      const node = helpTitle.current ? findNodeHandle(helpTitle.current) : null;
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 300);
    return () => clearTimeout(id);
  }, [helpOpen]);

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
          <AppText variant="caption" color="textMuted">
            {nearest ? 'Lo más cerca que puedes llegar' : 'Navegando hacia'}
          </AppText>
          <AppText variant="heading" numberOfLines={1} accessibilityRole="header" style={accessibleMode ? undefined : { fontSize: 17, lineHeight: 22 }}>{destLabel}</AppText>
          {nearest ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              Faltan {remainingText(nearest.reachedNodeId, place, nearest.remainingM)} hasta {place.name} · te acompañan desde ahí
            </AppText>
          ) : null}
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

      <Animated.View style={[styles.top, { height: topH, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 10, 0] }) }] }]}>
        {shown === 'inside' && dispB ? (
          <>
            <CampusMap
              mode="floor"
              routePoints={topRoute}
              donePoints={topDone}
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
              title={`Edificio ${dispB} | ${floorLabel(dispLevel)}${exploring ? ' · explorando' : ''}`}
            />
            <View style={styles.rail}>
              <FloorRail
                levels={FLOORPLANS[dispB]?.levels ?? []}
                current={dispLevel}
                dest={place.building === dispB ? place.floor : undefined}
                onSelect={(lv) => { setExplore((e) => ({ building: dispB, level: lv, camera: e.building === dispB ? e.camera : null })); }}
              />
            </View>
          </>
        ) : (
          <CampusMap
            mode="macro"
            routePoints={topRoute}
            donePoints={topDone}
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
            <MaterialCommunityIcons name="crosshairs-gps" size={t.typography.heading.fontSize} color={t.colors.primaryText} />
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

      {promptElevator ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.prompt, { bottom: cardH + t.spacing.md + insets.bottom }]}>
          <View style={styles.promptHead}>
            <AppText variant="label" style={styles.flex}>
              ¿El ascensor del Edif. {promptElevator.building} sigue fuera de servicio?
            </AppText>
            <Pressable
              onPress={() => setAnswered((a) => [...a, promptElevator.id])}
              accessibilityRole="button"
              accessibilityLabel="Cerrar pregunta"
              style={styles.iconBtn}>
              <Ionicons name="close" size={22} color={t.colors.text} />
            </Pressable>
          </View>
          <View style={accessibleMode ? styles.promptCol : styles.promptRow}>
            <View style={accessibleMode ? undefined : styles.flex}>
              <Button label="Sí, sigue caído" variant="danger" fullWidth onPress={() => respond(true)} />
            </View>
            <View style={accessibleMode ? undefined : styles.flex}>
              <Button label="Ya funciona" variant="secondary" fullWidth onPress={() => respond(false)} />
            </View>
          </View>
        </View>
      ) : null}

      <InstructionCard
        sim={sim}
        route={route}
        place={place}
        accessibleMode={accessibleMode}
        speakOn={speakOn}
        onToggleVoice={toggleVoice}
        onRepeat={repeat}
        onHome={goHome}
        partial={nearest ? {
          reachedLabel: nearest.reachedLabel,
          remainingM: nearest.remainingM,
          remainingText: remainingText(nearest.reachedNodeId, place, nearest.remainingM),
          assignee: ticket?.status === 'assigned' ? ticket.assignee : undefined,
          etaMin: ticket?.etaMin,
          onViewTicket: close,
          onHelped: () => {
            Speech.stop();
            const resume = ticket ? resolveTicket(ticket.id) : null;
            if (!resume) return;
            router.replace((resume === place.nodeId ? '/home' : { pathname: '/route/[destId]', params: { destId: place.id, resumed: '1' } }) as Href);
          },
        } : undefined}
        onLayout={onCardLayout}
      />

      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <View style={[styles.backdrop, { paddingBottom: t.spacing.lg + insets.bottom }]} accessibilityViewIsModal>
          <View style={styles.sheet}>
            <View ref={helpTitle} accessible accessibilityRole="header">
              <AppText variant="title">Código de vibraciones</AppText>
            </View>
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
      position: 'absolute', left: t.spacing.sm, top: t.spacing.sm + t.spacing.xxl, minHeight: t.minTouch, flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs,
      paddingHorizontal: t.spacing.md, borderRadius: t.radius.pill, backgroundColor: t.colors.primary, ...t.shadow,
    },
    backdrop: { flex: 1, justifyContent: 'center', padding: t.spacing.lg, backgroundColor: t.colors.overlaySurface },
    sheet: { gap: t.spacing.md, padding: t.spacing.lg, borderRadius: t.radius.lg, borderWidth: 2, borderColor: t.colors.border, backgroundColor: t.colors.surface },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 44 },
    codePattern: { flexShrink: 1, maxWidth: '60%', textAlign: 'right' },
    prompt: {
      position: 'absolute', left: t.spacing.md, right: t.spacing.md, gap: t.spacing.sm, padding: t.spacing.md,
      borderRadius: t.radius.lg, borderWidth: 2, borderColor: t.colors.warning, backgroundColor: t.colors.surface, ...t.shadow,
    },
    promptHead: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    promptRow: { flexDirection: 'row', gap: t.spacing.sm },
    promptCol: { gap: t.spacing.sm },
    rail: { position: 'absolute', right: t.spacing.sm, top: t.spacing.sm },
  });
