import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useFocusEffect, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CampusMap } from '@/components/CampusMap';
import { Screen } from '@/components/Screen';
import { ScreenState } from '@/components/ScreenState';
import { SupportTicketCard } from '@/components/SupportTicketCard';
import { useApp } from '@/context/app-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { AMENITY_ICON, amenitiesAlongRoute, amenityWord } from '@/lib/amenities';
import { EDGES, getNode, getPlace } from '@/lib/routing';
import { formatAgo, formatConfirmations } from '@/lib/time';
import { floorLabel, lacksElevatorAccess } from '@/lib/buildings';
import { accessibleRoomRequest, courseAt } from '@/lib/schedule';
import type { AmenityType, RouteResult } from '@/types';

type MapBarrier = { id: string; x: number; y: number; kind?: 'incident' | 'stairs' };

type Status = 'loading' | 'ready' | 'error';

export default function RouteScreen() {
  const { destId } = useLocalSearchParams<{ destId: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const {
    getRoute, accessibleMode, profile, incidents, elevators, raining, setRaining,
    origin, setOrigin, assisted, setAssisted, getNoRouteReason,
    getNearestReachable, openTicket, tickets,
  } = useApp();
  const t = useAppTheme(accessibleMode);
  const place = destId ? getPlace(destId) : undefined;

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [stepIdx, setStepIdx] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [fullMap, setFullMap] = useState(false);
  const [showAvoided, setShowAvoided] = useState(false);
  const [recalc, setRecalc] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const prevRoute = useRef<RouteResult | null>(null);
  const spokeInitial = useRef(false);
  const prevRaining = useRef(raining);
  const prevAssisted = useRef(assisted);
  const [noticeAnim] = useState(() => new Animated.Value(0));
  const isLowVision = profile === 'lowVision';

  const load = useCallback(() => {
    let cancelled = false;
    if (!prevRoute.current) setStatus('loading');
    else if (prevRaining.current !== raining || prevAssisted.current !== assisted) setRecalc(true);
    getRoute(destId ?? '').then((r) => {
      if (cancelled) return;
      setRecalc(false);
      if (!r) {
        prevRoute.current = null;
        setRoute(null);
        setStatus('error');
        return;
      }
      const prev = prevRoute.current;
      const rainChanged = prevRaining.current !== raining;
      const assistedChanged = prevAssisted.current !== assisted;
      prevAssisted.current = assisted;
      prevRaining.current = raining;
      if (prev && rainChanged) {
        const delta = r.distanceM - prev.distanceM;
        const extra = delta === 0 ? '' : ` (${delta > 0 ? '+' : ''}${delta} m)`;
        const viaB = r.nodeIds.includes('b_in') && !prev.nodeIds.includes('b_in');
        const changed = prev.edgeIds.join('|') !== r.edgeIds.join('|');
        setNotice(
          !raining
            ? 'Volvimos a la ruta normal, sin lluvia'
            : viaB
              ? `Con lluvia te llevamos por dentro del Edificio B: ${r.coveredPct}% techada${extra}`
              : changed
                ? `Con lluvia priorizamos tramos techados: ${r.coveredPct}% techada${extra}`
                : `Con lluvia: esta ruta es ${r.coveredPct}% techada, no hay alternativa más cubierta`,
        );
        setStepIdx(0);
        noticeAnim.setValue(0);
        Animated.timing(noticeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
      } else if (prev && assistedChanged) {
        setNotice(assisted ? `Ruta con ayuda: pendientes de hasta 10% (${r.distanceM} m)` : `Ruta autónoma en silla (${r.distanceM} m)`);
        setStepIdx(0);
      } else if (prev && prev.edgeIds.join('|') !== r.edgeIds.join('|')) {
        const usedElev = prev.edgeIds
          .map((id) => EDGES.find((e) => e.id === id)?.elevatorId)
          .find((id) => id && elevators.find((el) => el.id === id)?.status !== 'ok');
        const building = elevators.find((el) => el.id === usedElev)?.building;
        setNotice(
          building
            ? `Recalculamos tu ruta: el ascensor del Edif. ${building} está fuera de servicio`
            : 'Recalculamos tu ruta: hay una barrera reportada en el camino anterior',
        );
        setStepIdx(0);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        noticeAnim.setValue(0);
        Animated.timing(noticeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      prevRoute.current = r;
      setRoute(r);
      setStatus('ready');
    }).catch(() => {
      if (cancelled) return;
      setRecalc(false);
      setStatus('error');
    });
    return () => {
      cancelled = true;
    };
  }, [getRoute, destId, elevators, noticeAnim, raining, assisted, setNotice, setStepIdx]);

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

  const routePts = useMemo<[number, number][]>(() => (route?.polyline ?? []).map((p) => [p.x, p.y]), [route]);

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
    elevators.filter((e) => e.status !== 'ok').forEach((e) => at(`el-${e.id}`, undefined, undefined, e.id));
    (route?.avoided ?? []).forEach((a) => {
      if (a.kind !== 'stairs' || !a.edgeId) return;
      const e = EDGES.find((x) => x.id === a.edgeId);
      const f = e && getNode(e.from);
      const to = e && getNode(e.to);
      if (f && to) out.push({ id: `st-${a.edgeId}`, x: (f.x + to.x) / 2, y: (f.y + to.y) / 2, kind: 'stairs' });
    });
    return out;
  }, [incidents, elevators, route]);
  const mapBarriers = useMemo(() => barriers.map((b) => ({ x: b.x, y: b.y, kind: b.kind === 'stairs' ? ('stairs' as const) : ('incident' as const) })), [barriers]);

  const stairItems = useMemo(() => (route?.avoided ?? []).filter((a) => a.kind === 'stairs' || a.kind === 'slope'), [route]);
  const incidentItems = useMemo(() => (route?.avoided ?? []).filter((a) => a.kind === 'incident'), [route]);
  /** Frescura y confirmaciones del reporte que causó el desvío */
  const freshnessOf = (a: { edgeId?: string }): string => {
    const edge = EDGES.find((e) => e.id === a.edgeId);
    const el = edge?.elevatorId ? elevators.find((x) => x.id === edge.elevatorId) : undefined;
    if (el && el.status !== 'ok') {
      const tail = `${formatAgo(el.reportedAt ?? '')} · ${formatConfirmations(el.confirmations ?? 0)}`;
      return el.status === 'unconfirmed' ? ` · sin confirmar, ${tail}` : ` · ${tail}`;
    }
    const inc = incidents.find((i) => i.edgeId === a.edgeId);
    return inc ? ` · ${formatAgo(inc.reportedAt)} · ${formatConfirmations(inc.confirmations)}` : '';
  };
  const avoidedSteps = stairItems.reduce((s, a) => s + (a.steps ?? 0), 0);
  const avoidedStairs = stairItems.filter((a) => a.kind === 'stairs').length;

  const along = useMemo(() => (route ? amenitiesAlongRoute(route) : []), [route]);
  const amenitySummary = useMemo(() => {
    const types: AmenityType[] = ['bench', 'rest-area', 'wc', 'water', 'shade'];
    const items: { key: string; icon: string; text: string }[] = [];
    for (const type of types) {
      const list = along.filter((a) => a.amenity.type === type);
      if (!list.length) continue;
      let text = `${list.length} ${amenityWord(type, list.length)}`;
      if (type === 'wc') {
        const w = list[0].amenity;
        text += ` (Edif. ${w.building}, piso ${w.floor})`;
      }
      if (type === 'rest-area' || type === 'water' || type === 'shade') text = list.length === 1 ? (type === 'water' ? 'Bebedero' : amenityWord(type)).replace(/^./, (c) => c.toUpperCase()) : text;
      items.push({ key: type, icon: AMENITY_ICON[type], text });
    }
    return items;
  }, [along]);
  const restTip = useMemo(() => {
    if (!route || route.distanceM <= 200 || (profile !== 'crutches' && profile !== 'wheelchair')) return null;
    const mid = route.distanceM / 2;
    const seats = along.filter((a) => a.amenity.type === 'bench' || a.amenity.type === 'rest-area');
    if (!seats.length) return null;
    const best = seats.reduce((b, a) => (Math.abs(a.atM - mid) < Math.abs(b.atM - mid) ? a : b));
    const nearMid = Math.abs(best.atM - mid) <= route.distanceM * 0.2;
    const name = best.amenity.name.replace(/^./, (c) => c.toLowerCase());
    return `Descansa en ${name} (${nearMid ? 'a mitad de camino, ' : ''}a los ${best.atM} m)`;
  }, [route, along, profile]);

  const styles = useMemo(() => makeStyles(t), [t]);

  /** Chips de verificación para silla de ruedas (derivados de los datos de la ruta) */
  const wcChips = useMemo(() => {
    const w = route?.wheelchair;
    if (!w) return [];
    const chips: { text: string; help?: boolean }[] = [];
    if (w.helpSlopePct) chips.push({ text: `Con ayuda en la pendiente de ${w.helpSlopePct}%`, help: true });
    chips.push({ text: 'Puertas ≥ 80 cm' });
    for (const b of [...new Set(w.elevatorBuildings)]) chips.push({ text: `Ascensor ${b} apto para silla` });
    if (w.curbCutsOk) chips.push({ text: 'Sin soleras' });
    return chips;
  }, [route]);

  const goReport = () =>
    router.push({
      pathname: '/report',
      params: { edgeIds: route?.edgeIds.join(',') ?? '', dest: destId ?? '' },
    });

  // Sin ruta: en vez de dejar a la persona en un callejon sin salida, se calcula
  // sola la mejor aproximacion y se levanta el ticket de apoyo. Nadie deberia
  // tener que pedir ayuda a mano justo cuando acaba de leer "no se puede llegar".
  const partial = useMemo(
    () => (status === 'error' && destId ? getNearestReachable(destId) : null),
    [status, destId, getNearestReachable],
  );
  const ticket = useMemo(
    () => (partial && place ? tickets.find((x) => x.placeId === place.id) ?? null : null),
    [partial, place, tickets],
  );
  useEffect(() => {
    if (status !== 'error' || !partial || !destId) return;
    openTicket(destId, partial);
  }, [status, partial, destId, openTicket]);

  if (status === 'loading') {
    return (
      <Screen>
        <ScreenState variant="loading" title="Buscando tu ruta accesible" message="Evitando escaleras y barreras reportadas…" />
      </Screen>
    );
  }


  const diagnosis = status === 'error' && profile === 'wheelchair' && destId ? getNoRouteReason(destId) : null;
  const autoPlan = partial && place ? (
    <View style={styles.noRouteActions}>
      <Card style={styles.planCard}>
        <View style={styles.planHead}>
          <MaterialCommunityIcons name="map-marker-distance" size={t.iconSize.md} color={t.colors.primary} />
          <AppText variant="heading" style={styles.flex}>
            {partial.route.steps.length ? 'Te llevamos lo más cerca posible' : 'Desde aquí no puedes avanzar'}
          </AppText>
        </View>
        {partial.route.steps.length ? (
          <>
            <AppText color="textMuted">
              Lo más cerca que puedes llegar por tu cuenta es {partial.reachedLabel}.
            </AppText>
            <View style={styles.planStats}>
              <View style={styles.stat}>
                <AppText variant="title" tabular>{partial.route.distanceM}</AppText>
                <AppText variant="caption" color="textMuted">metros</AppText>
              </View>
              <View style={styles.stat}>
                <AppText variant="title" tabular>{partial.route.minutes}</AppText>
                <AppText variant="caption" color="textMuted">min aprox.</AppText>
              </View>
              <View style={styles.stat}>
                <AppText variant="title" color="danger" tabular>{partial.remainingM}</AppText>
                <AppText variant="caption" color="textMuted">m sin cubrir</AppText>
              </View>
            </View>
            <Button
              label="Ir hasta ese punto"
              icon="navigate"
              fullWidth
              accessibilityLabel={`Iniciar la ruta hasta ${partial.reachedLabel}`}
              onPress={() => router.push({ pathname: '/navigate/[destId]', params: { destId: destId ?? '', partial: '1' } } as Href)}
            />
          </>
        ) : (
          <AppText color="textMuted">
            Con este perfil todas las salidas de {getNode(origin)?.label ?? 'tu origen'} están bloqueadas,
            asi que el apoyo tiene que venir hasta aqui.
          </AppText>
        )}
      </Card>
      {ticket ? (
        <SupportTicketCard ticket={ticket} partial={partial} place={place} accessibleMode={accessibleMode} />
      ) : null}
    </View>
  ) : null;

  const noElevator = status === 'error' && !!place && (profile === 'crutches' || profile === 'wheelchair') && lacksElevatorAccess(place);
  if (noElevator && place) {
    const reqCourse = courseAt(place.id);
    return (
      <Screen scroll contentStyle={autoPlan ? undefined : styles.noRouteScreen}>
        <Stack.Screen options={{ title: place.name }} />
        <View style={styles.noRoute}>
          <View style={styles.noRouteIcon}>
            <MaterialCommunityIcons name="elevator-passenger-outline" size={t.iconSize.lg + 8} color={t.colors.danger} />
          </View>
          <AppText variant="title" accessibilityRole="header" style={styles.center}>{place.name} no tiene ruta accesible</AppText>
          <AppText color="textMuted" style={styles.center}>
            Está en el {floorLabel(place.floor ?? 1).toLowerCase()} del Edificio {place.building}, que no tiene ascensor.
          </AppText>
        </View>
        {autoPlan}
        <View style={styles.noRouteActions}>
          <Button
            label="Solicitar sala accesible"
            icon="share-outline"
            variant={autoPlan ? 'secondary' : 'primary'}
            fullWidth
            accessibilityLabel={`Solicitar sala accesible en lugar de ${place.name}`}
            onPress={() => { Share.share({ message: accessibleRoomRequest(profile, place, reqCourse) }).catch(() => {}); }}
          />
          <Button
            label="Ver salas accesibles cercanas"
            icon="map-outline"
            variant="secondary"
            fullWidth
            onPress={() => router.push({ pathname: '/map', params: { building: place.building ?? '', level: '1' } })}
          />
          <Button label="Volver" variant="ghost" fullWidth onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (diagnosis && diagnosis.kind !== 'other' && place) {
    const originName = getNode(origin)?.zone ?? getNode(origin)?.label ?? 'tu origen';
    const isSlope = diagnosis.kind === 'slope';
    const title = isSlope
      ? `Desde ${originName} no hay ruta autónoma en silla`
      : `No hay ruta en silla hasta ${place.name}`;
    const message = isSlope
      ? `La ${diagnosis.street ?? 'calle de acceso'} tiene ${diagnosis.slopePct}% de pendiente por ${diagnosis.meters} m.`
      : `El ascensor del Edif. ${diagnosis.elevatorBuilding ?? ''} tiene cabina pequeña (100×120 cm) y no cabe una silla de ruedas (mínimo 110×140 cm).`;
    return (
      <Screen scroll contentStyle={styles.noRouteScreen}>
        <Stack.Screen options={{ title: place.name }} />
        <View style={styles.noRoute}>
          <View style={styles.noRouteIcon}>
            <MaterialCommunityIcons name="wheelchair-accessibility" size={t.iconSize.lg + 8} color={t.colors.primary} />
          </View>
          <AppText variant="title" accessibilityRole="header" style={styles.center}>{title}</AppText>
          <AppText color="textMuted" style={styles.center}>{message}</AppText>
        </View>
        {autoPlan}
        {isSlope ? (
          <View style={styles.noRouteActions}>
            <AppText variant="caption" color="textMuted" style={styles.center}>
              O evita el problema de raiz:
            </AppText>
            <View style={styles.whyBox} accessible accessibilityLabel="En el cerro, el acceso por Placeres es casi plano">
              <MaterialCommunityIcons name="terrain" size={22} color={t.colors.primary} />
              <AppText variant="caption" style={styles.flex}>En el cerro, el acceso por Placeres es casi plano.</AppText>
            </View>
            {origin !== 'acc_placeres' ? (
              <Button
                label="Entrar por Av. Placeres"
                icon="navigate"
                fullWidth
                accessibilityLabel="Entrar por Av. Placeres, acceso plano"
                onPress={() => {
                  setNotice('Cambiamos tu entrada a Av. Placeres: evitas la pendiente de 7% de la Calle Agustín Edwards');
                  noticeAnim.setValue(0);
                  Animated.timing(noticeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
                  setOrigin('acc_placeres');
                }}
              />
            ) : null}
            <Button
              label="Voy con acompañante"
              icon="people"
              variant={origin !== 'acc_placeres' ? 'secondary' : 'primary'}
              fullWidth
              onPress={() => {
                setNotice(`Ruta con ayuda en la pendiente de ${diagnosis.slopePct}% de la ${diagnosis.street ?? 'calle de acceso'}`);
                noticeAnim.setValue(0);
                Animated.timing(noticeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
                setAssisted(true);
              }}
            />
          </View>
        ) : null}
        <Button label="Volver" variant="ghost" fullWidth onPress={() => router.back()} />
      </Screen>
    );
  }

  if (status === 'error' || !route || !place) {
    return (
      <Screen scroll contentStyle={autoPlan ? undefined : styles.noRouteScreen}>
        {place ? <Stack.Screen options={{ title: place.name }} /> : null}
        {autoPlan ? (
          <>
            <View style={styles.noRoute}>
              <View style={styles.noRouteIcon}>
                <MaterialCommunityIcons name="map-marker-alert" size={t.iconSize.lg + 8} color={t.colors.danger} />
              </View>
              <AppText variant="title" accessibilityRole="header" style={styles.center}>
                No hay ruta hasta {place?.name ?? 'el destino'}
              </AppText>
              <AppText color="textMuted" style={styles.center}>
                Con tu perfil no existe ningún camino completo: puede haber un ascensor fuera de
                servicio o un tramo bloqueado.
              </AppText>
            </View>
            {autoPlan}
          </>
        ) : (
          <ScreenState
            variant="error"
            title="No encontramos una ruta accesible"
            message="Puede que un ascensor esté fuera de servicio o un tramo esté bloqueado. Prueba con otro punto de partida."
            actionLabel="Cambiar origen"
            onAction={() => router.replace('/home')}
          />
        )}
        <Button label="Volver" variant="ghost" fullWidth onPress={() => router.back()} />
      </Screen>
    );
  }

  const mapW = width - t.spacing.lg * 2;
  const avoidedHeadline = avoidedSteps > 0
    ? `Evitamos ${avoidedSteps} escalones en ${avoidedStairs} ${avoidedStairs === 1 ? 'escalera' : 'escaleras'}`
    : `Evitamos ${stairItems.length} ${stairItems.length === 1 ? 'tramo exigente' : 'tramos exigentes'}`;
  const mapLabel = `Mapa: ruta desde ${getNode(route.nodeIds[0])?.label ?? 'tu origen'} hasta ${place.name}.`;

  return (
    <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
    <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ title: place.name }} />
      <AppText color="textMuted">
        {place.building ? `Edif. ${place.building} · ` : ''}Piso {place.floor}
      </AppText>

      {notice ? (
        <Animated.View
          style={{
            opacity: noticeAnim,
            transform: [{ translateY: noticeAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          }}>
          <Banner tone="info" text={notice} />
        </Animated.View>
      ) : null}

      <Card accessible
        accessibilityLabel={`${route.minutes} ${route.minutes === 1 ? 'minuto' : 'minutos'}, ${route.distanceM} metros, ${route.stairsCount === 0 ? 'sin escaleras' : `${route.stairsCount} escalones`}${route.stepsAvoided > 0 ? `, evitas ${route.stepsAvoided} escalones` : ''}`}
        accessibilityLiveRegion="polite"
        style={styles.summary}>
        {recalc ? (
          <View style={styles.recalc}>
            <ActivityIndicator color={t.colors.primary} />
            <AppText variant="label">Recalculando…</AppText>
          </View>
        ) : (
          <>
            <View style={styles.row}>
              <View style={styles.stat}>
                <AppText variant="display">{route.minutes}</AppText>
                <AppText color="textMuted" variant="label">min</AppText>
              </View>
              <View style={styles.stat}>
                <AppText variant="display">{route.distanceM}</AppText>
                <AppText color="textMuted" variant="label">metros</AppText>
              </View>
              <View style={styles.stat}>
                <View style={styles.statNum}>
                  {route.stairsCount === 0 ? <Ionicons name="checkmark-circle" size={t.iconSize.md} color={t.colors.success} /> : null}
                  <AppText variant="display" style={route.stairsCount === 0 ? { color: t.colors.success } : undefined}>{route.stairsCount}</AppText>
                </View>
                <AppText color="textMuted" variant="label">escalones</AppText>
              </View>
            </View>
            {route.stepsAvoided > 0 ? (
              <AppText variant="caption" style={[styles.center, { color: t.colors.success }]}>Evitas {route.stepsAvoided} escalones</AppText>
            ) : null}
          </>
        )}
      </Card>

      {profile === 'wheelchair' ? (
        <ToggleRow
          t={t}
          icon="account-multiple"
          title="Voy con acompañante"
          caption="Permite pendientes de hasta 10%"
          value={assisted}
          onChange={setAssisted}
          hint="Recalcula la ruta permitiendo pendientes de hasta 10% porque alguien empuja la silla"
        />
      ) : null}

      {wcChips.length > 0 ? (
        <View style={styles.coverRow} accessible accessibilityLabel={`Verificado para silla de ruedas: ${wcChips.map((c) => c.text).join(', ')}`}>
          {wcChips.map((c) => (
            <View key={c.text} style={[styles.coverChip, { backgroundColor: c.help ? t.colors.warningSoft : t.colors.successSoft }]}>
              <Ionicons name={c.help ? 'people' : 'checkmark-circle'} size={18} color={c.help ? t.colors.warning : t.colors.success} />
              <AppText variant="label">{c.text}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      <ToggleRow
        t={t}
        icon="weather-pouring"
        title="Está lloviendo"
        caption="Prioriza tramos techados"
        value={raining}
        onChange={setRaining}
        hint="Recalcula la ruta para priorizar tramos techados"
      />

      <Pressable onPress={() => setFullMap(true)} accessibilityRole="button" accessibilityLabel={`${mapLabel} Ampliar mapa`}>
        <CampusMap
          mode="macro"
          routePoints={routePts}
          origin={route.polyline[0]}
          destination={route.polyline[route.polyline.length - 1]}
          barriers={mapBarriers}
          activeBuildingId={place.building}
          height={Math.round(mapW * 0.75)}
        />
        <View style={styles.expand}>
          <Ionicons name="expand" size={18} color={t.colors.primary} />
        </View>
      </Pressable>

      <View style={styles.coverRow}>
        <View accessible accessibilityLabel={`Ruta ${route.coveredPct} por ciento techada, ${route.uncoveredM} metros a la intemperie`} style={styles.coverChip}>
          <MaterialCommunityIcons name="umbrella-outline" size={18} color={t.colors.primary} />
          <AppText variant="label">Ruta {route.coveredPct}% techada</AppText>
        </View>
        {raining ? (
          <View accessible accessibilityLabel="Priorizamos tramos techados" style={styles.coverChip}>
            <Ionicons name="information-circle" size={18} color={t.colors.primary} />
            <AppText variant="label">Priorizamos tramos techados</AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.legend} accessible accessibilityLabel="Leyenda del mapa: origen, destino, escalera evitada y barrera reportada">
        <LegendItem t={t} label="Origen"><View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: t.map.routeCasing, borderWidth: 3, borderColor: t.map.route }} /></LegendItem>
        <LegendItem t={t} label="Destino"><Ionicons name="location" size={20} color={t.map.pin} /></LegendItem>
        <LegendItem t={t} label="Escalera evitada"><LegendDot color={t.map.stairsMark}><MaterialCommunityIcons name="stairs" size={12} color={t.colors.bg} /></LegendDot></LegendItem>
        <LegendItem t={t} label="Barrera reportada"><LegendDot color={t.map.barrier}><AppText variant="caption" style={{ color: t.colors.bg, fontWeight: '800', lineHeight: 16 }}>!</AppText></LegendDot></LegendItem>
      </View>

      {amenitySummary.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">En tu ruta</AppText>
          <View
            accessible
            accessibilityLabel={`En tu ruta: ${amenitySummary.map((i) => i.text).join(', ')}`}
            style={styles.amenityBox}>
            <View style={styles.amenityWrap}>
              {amenitySummary.map((i) => (
                <View key={i.key} style={styles.amenityChip}>
                  <MaterialCommunityIcons name={i.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={t.colors.primary} />
                  <AppText variant="label">{i.text}</AppText>
                </View>
              ))}
            </View>
            {restTip ? (
              <View style={styles.restTip}>
                <MaterialCommunityIcons name="seat" size={22} color={t.colors.success} />
                <AppText variant="caption" style={styles.flex}>{restTip}</AppText>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {stairItems.length > 0 ? (
        <View style={styles.avoidBox}>
          <Pressable
            onPress={() => setShowAvoided((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showAvoided }}
            accessibilityLabel={`${avoidedHeadline}. ${showAvoided ? 'Ocultar' : 'Ver'} detalle`}
            style={styles.avoidHead}>
            <Ionicons name="shield-checkmark" size={24} color={t.colors.success} />
            <AppText variant="label" style={styles.flex}>{avoidedHeadline}</AppText>
            <Ionicons name={showAvoided ? 'chevron-up' : 'chevron-down'} size={20} color={t.colors.textMuted} />
          </Pressable>
          {showAvoided
            ? stairItems.map((a) => (
                <View key={a.text} style={styles.avoidRow} accessible accessibilityLabel={`${a.text}. ${a.reason}`}>
                  <MaterialCommunityIcons name={a.kind === 'stairs' ? 'stairs' : 'slope-uphill'} size={22} color={t.colors.textMuted} />
                  <AppText variant="caption" style={styles.flex}>{a.kind === 'stairs' ? (a.name ?? 'Escalera') : a.text}</AppText>
                  {a.kind === 'stairs' ? <AppText variant="caption" color="textMuted">{a.steps} escalones</AppText> : null}
                </View>
              ))
            : null}
        </View>
      ) : null}

      {incidentItems.map((a) => (
        <Banner
          key={a.text}
          tone={a.reason.startsWith('El ascensor') ? 'danger' : 'warning'}
          text={`${a.text}. ${a.reason}${freshnessOf(a)}`}
        />
      ))}

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">Paso a paso</AppText>
        {route.steps.map((s, i) => {
          const active = i === stepIdx;
          const slope = stepSlope(s.edgeIds);
          return (
            <Pressable
              key={`${s.fromNodeId}-${i}`}
              onPress={() => setStepIdx(i)}
              accessibilityRole="button"
              accessibilityLabel={`Paso ${i + 1}: ${s.text}, ${Math.round(s.distanceM)} metros${slope ? `, pendiente ${slope}%` : ''}`}
              accessibilityState={{ selected: active }}
              accessibilityHint="Resalta este paso en el mapa"
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
                {slope ? (
                  <View style={styles.slopeChip}>
                    <Ionicons name="trending-up" size={14} color={t.colors.warning} />
                    <AppText variant="caption" style={{ color: t.colors.warning }}>Pendiente {slope}%</AppText>
                  </View>
                ) : null}
              </View>
              <AppText variant="caption" color="textMuted">{Math.round(s.distanceM)} m</AppText>
            </Pressable>
          );
        })}
      </View>

      <Button
        label="Reportar una barrera en esta ruta"
        icon="alert-circle-outline"
        variant="ghost"
        fullWidth
        onPress={goReport}
      />
    </ScrollView>

      <View style={styles.footer}>
        <View style={styles.flex}>
          <Button
            label="Iniciar ruta"
            icon="navigate"
            fullWidth
            accessibilityLabel={`Iniciar ruta hacia ${place.name}`}
            onPress={() => {
              Speech.stop();
              router.push(`/navigate/${destId}` as Href);
            }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Escuchar resumen"
          style={({ pressed }) => [styles.listen, pressed && { backgroundColor: t.colors.primarySoft }]}
          onPress={() =>
            speak(
              `Ruta hacia ${place.name}. ${route.minutes} minutos, ${route.distanceM} metros, ${route.stairsCount} escalones. ${route.steps.length} pasos. Primero: ${route.steps[0]?.text ?? ''}`,
            )
          }>
          <Ionicons name="volume-high" size={t.iconSize.md} color={t.colors.primary} />
        </Pressable>
      </View>

      <Modal visible={fullMap} animationType="fade" transparent onRequestClose={() => setFullMap(false)}>
        <View style={[styles.modal, { backgroundColor: t.colors.overlay }]}>
          <View style={{ width: width - t.spacing.lg * 2, borderRadius: t.radius.md, overflow: 'hidden' }}>
            <CampusMap
              mode="macro"
              routePoints={routePts}
              origin={route.polyline[0]}
              destination={route.polyline[route.polyline.length - 1]}
              barriers={mapBarriers}
              activeBuildingId={place.building}
              height={Math.round(height * 0.7)}
              title="Mapa | Exterior"
              accessibilityLabel={mapLabel}
            />
          </View>
          <View style={styles.modalBtn}>
            <Button label="Cerrar mapa" icon="close" fullWidth onPress={() => setFullMap(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function stepSlope(edgeIds: string[]): number {
  return Math.max(
    0,
    ...edgeIds.map((id) => {
      const e = EDGES.find((x) => x.id === id);
      return e && (e.type === 'slope' || e.type === 'ramp') ? (e.slopePct ?? 0) : 0;
    }),
  );
}

function ToggleRow({ t, icon, title, caption, value, onChange, hint }: {
  t: ReturnType<typeof useAppTheme>;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  caption: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: t.minTouch }}>
      <MaterialCommunityIcons name={icon} size={t.iconSize.md} color={value ? t.colors.primary : t.colors.textMuted} />
      <View style={{ flex: 1 }}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="caption" color="textMuted">{caption}</AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityRole="switch"
        accessibilityLabel={title}
        accessibilityHint={hint}
        accessibilityState={{ checked: value }}
        trackColor={{ false: t.colors.switchTrackOff, true: t.colors.primary }}
        thumbColor={t.colors.switchThumb}
      />
    </View>
  );
}

function LegendDot({ color, children }: { color: string; children: React.ReactNode }) {
  return <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

function LegendItem({ label, children, t }: { label: string; children: React.ReactNode; t: ReturnType<typeof useAppTheme> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
      <View style={{ width: 22, alignItems: 'center' }}>{children}</View>
      <AppText variant="caption" color="textMuted">{label}</AppText>
    </View>
  );
}

const makeStyles = (t: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    content: { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.lg, gap: t.spacing.lg },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      padding: t.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    flex: { flex: 1 },
    header: { gap: t.spacing.xs },
    row: { flexDirection: 'row', gap: t.spacing.md },
    summary: { gap: t.spacing.md },
    stat: { flex: 1, alignItems: 'center' },
    statNum: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
    recalc: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: t.minTouch },
    listen: {
      width: 52, height: 52, borderRadius: t.radius.md, borderWidth: 2, borderColor: t.colors.primary,
      backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center',
    },
    noRouteScreen: { flexGrow: 1, justifyContent: 'center' },
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
    legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: t.spacing.lg, rowGap: t.spacing.sm, justifyContent: 'center' },
    section: { gap: t.spacing.md },
    rainCard: { padding: t.spacing.md },
    rainRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: t.minTouch },
    coverRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    coverChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.primarySoft,
    },
    amenityBox: { gap: t.spacing.sm },
    amenityWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    amenityChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    restTip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.successSoft,
    },
    avoidBox: {
      padding: t.spacing.md,
      gap: t.spacing.sm,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.successSoft,
    },
    avoidHead: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: t.minTouch },
    avoidRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingLeft: t.spacing.xs },
    noRoute: { alignItems: 'center', gap: t.spacing.md, paddingTop: t.spacing.xl },
    noRouteIcon: {
      width: 72, height: 72, borderRadius: t.radius.pill, backgroundColor: t.colors.primarySoft,
      alignItems: 'center', justifyContent: 'center',
    },
    noRouteActions: { gap: t.spacing.md },
    planCard: { gap: t.spacing.md },
    planHead: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    planStats: { flexDirection: 'row', gap: t.spacing.sm },
    whyBox: {
      flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md,
      borderRadius: t.radius.md, backgroundColor: t.colors.primarySoft,
    },
    center: { textAlign: 'center' },
    slopeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: t.spacing.xs,
      marginTop: t.spacing.xs,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 2,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.warningSoft,
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
