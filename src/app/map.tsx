import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Keyboard, type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { floorLabel } from '@/lib/buildings';
import { Button } from '@/components/Button';
import { CampusMap, type MapBarrier, type MapCamera } from '@/components/CampusMap';
import { ElevatorStatus } from '@/components/ElevatorStatus';
import { FloorRail } from '@/components/FloorRail';
import { ScreenState } from '@/components/ScreenState';
import { radius, shadow, spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { CAMPUS_MAP, FLOORPLANS, getFloorPlan } from '@/lib/campus-map';
import { EDGES, getNode, PLACES } from '@/lib/routing';
import type { Place } from '@/types';

type RoomIcon = keyof typeof MaterialCommunityIcons.glyphMap;
const KIND_ICON: Record<string, RoomIcon> = {
  room: 'door',
  lab: 'flask-outline',
  wc: 'human-wheelchair',
  elevator: 'elevator-passenger',
  stairs: 'stairs',
  service: 'room-service-outline',
};
const KIND_LABEL: Record<string, string> = {
  room: 'Sala',
  lab: 'Laboratorio',
  wc: 'Baño accesible',
  elevator: 'Ascensor',
  stairs: 'Escalera',
  service: 'Servicio',
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]/g, '');
const placeSub = (p: Place) => `${p.building ? `Edif. ${p.building} · ` : ''}${floorLabel(p.floor)}`;

/** Misma correspondencia sala-lugar que usa la navegación */
const roomMatchesPlace = (roomId: string, b: string, p: Place) => {
  const rid = roomId.toLowerCase();
  const pid = p.id.toLowerCase();
  const short = rid.replace(/^[a-z]-/, '');
  return rid === pid || rid === `${b.toLowerCase()}-${pid}` || pid === short || pid.startsWith(`${short}-`);
};

type Sel = { building?: string; level?: number; placeId?: string };

export default function MapScreen() {
  const router = useRouter();
  const { origin, incidents, elevators } = useApp();
  const { colors, minTouch, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ building?: string; level?: string }>();
  const [sel, setSel] = useState<Sel>(() =>
    params.building && FLOORPLANS[params.building]
      ? { building: params.building, level: Number(params.level) || FLOORPLANS[params.building]?.levels?.[0] }
      : {},
  );
  const [camera, setCamera] = useState<MapCamera | null>(null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [mapH, setMapH] = useState(0);
  const [mapW, setMapW] = useState(0);

  const originNode = getNode(origin);
  const originPt = originNode ? { x: originNode.x, y: originNode.y } : undefined;

  const barriers = useMemo<MapBarrier[]>(() => {
    const out: MapBarrier[] = [];
    const at = (nodeId?: string, edgeId?: string, elevId?: string) => {
      if (nodeId) {
        const n = getNode(nodeId);
        if (n) out.push({ x: n.x, y: n.y, kind: 'incident' });
        return;
      }
      const edges = elevId ? EDGES.filter((e) => e.elevatorId === elevId) : EDGES.filter((e) => e.id === edgeId);
      for (const e of edges) {
        const a = getNode(e.from);
        const b = getNode(e.to);
        if (a && b) out.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, kind: 'incident' });
      }
    };
    incidents.forEach((i) => at(i.nodeId, i.edgeId, i.type === 'elevator' ? i.elevatorId : undefined));
    elevators.filter((e) => e.status !== 'ok').forEach((e) => at(undefined, undefined, e.id));
    return out;
  }, [incidents, elevators]);

  const q = norm(query.trim());
  const results = useMemo(
    () => (q ? PLACES.filter((p) => norm(p.name).includes(q) || norm(p.id).includes(q) || norm(`edif${p.building ?? ''}`).includes(q)) : []),
    [q],
  );

  const buildingName = (id: string) => CAMPUS_MAP.buildings.find((b) => b.id === id)?.name ?? `Edificio ${id}`;
  const bid = sel.building;
  const fp = bid ? FLOORPLANS[bid] : undefined;
  const levels = fp?.levels ?? [];
  const hasPlan = levels.length > 0;
  const level = sel.level ?? levels[0];
  const plan = bid && hasPlan && level != null ? getFloorPlan(bid, level) : undefined;
  const selPlace = PLACES.find((p) => p.id === sel.placeId);
  const freePlace = selPlace && !selPlace.building ? selPlace : undefined;
  const sheetOpen = !!bid || !!freePlace;
  const elevator = bid ? elevators.find((e) => e.building === bid) : undefined;

  const rooms = useMemo(() => {
    if (!bid || !plan) return [];
    return plan.rooms.map((r) => ({
      room: r,
      place: PLACES.find((p) => p.building === bid && p.floor === level && roomMatchesPlace(r.id, bid, p)),
    }));
  }, [bid, plan, level]);
  const destRoom = rooms.find((r) => r.place && r.place.id === sel.placeId)?.room.id;

  const reset = useCallback(() => {
    setSel({});
    setCamera(null);
    setCollapsed(false);
  }, []);
  const onBuildingPress = useCallback((id: string) => {
    setCamera(null);
    setCollapsed(false);
    setSel({ building: id, level: FLOORPLANS[id]?.levels?.[0] });
  }, []);
  const pickPlace = (p: Place) => {
    setQuery('');
    setCamera(null);
    setCollapsed(false);
    Keyboard.dismiss();
    setSel({ building: p.building, level: p.building && FLOORPLANS[p.building]?.levels?.length ? p.floor : undefined, placeId: p.id });
  };

  const originLabel = originNode?.label ?? 'acceso';
  const mapLabel = [
    `Mapa del campus. Estás en ${originLabel}.`,
    barriers.length ? `${barriers.length} barreras activas marcadas.` : 'Sin barreras activas.',
    bid && hasPlan ? `Viendo ${buildingName(bid)}, piso ${level}. La lista de salas está bajo el mapa.` : 'Toca un edificio para ver sus pisos.',
  ].join(' ');

  const sheetTitle = freePlace
    ? freePlace.name
    : bid
      ? `${buildingName(bid)}${hasPlan && level != null ? ` · ${floorLabel(level)}` : ''}`
      : '';

  const onLayout = (e: LayoutChangeEvent) => {
    setMapH(Math.round(e.nativeEvent.layout.height));
    setMapW(Math.round(e.nativeEvent.layout.width));
  };
  /** Encuadre inicial: el campus llena el ancho con margen */
  const defaultCam = useMemo<MapCamera | undefined>(() => {
    if (mapW <= 0 || mapH <= 0) return undefined;
    const b = CAMPUS_MAP.bounds;
    const bw = ((b.maxX - b.minX) / 100) * 1313;
    const bh = ((b.maxY - b.minY) / 100) * 980;
    const fit = Math.min((mapW - 24) / bw, (mapH - 24) / bh);
    const zoom = Math.max(1, (mapW - 24) / bw / fit);
    return { cx: (((b.minX + b.maxX) / 2) / 100) * 1313, cy: (((b.minY + b.maxY) / 2) / 100) * 980, zoom };
  }, [mapW, mapH]);
  const inFloor = !!bid && hasPlan;
  const sheetH = collapsed ? undefined : '42%';

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.flex} onLayout={onLayout}>
        {mapH > 0 ? (
          <View style={styles.flex} onTouchStart={Keyboard.dismiss}>
          <CampusMap
            mode={bid && hasPlan ? 'floor' : 'macro'}
            routePoints={[]}
            position={originPt}
            barriers={barriers}
            activeBuildingId={bid}
            level={level}
            destRoomId={destRoom}
            height={mapH}
            camera={camera ?? (inFloor ? null : defaultCam)}
            onCameraChange={setCamera}
            onBuildingPress={onBuildingPress}
            insetTop={bid && hasPlan ? 72 : 0}
            insetRight={bid && hasPlan ? 72 : 0}
            accessibilityLabel={mapLabel}
          />
          </View>
        ) : null}

        <View style={styles.searchWrap} pointerEvents="box-none">
          <View style={[styles.search, shadow, { backgroundColor: colors.surface, borderColor: colors.borderStrong, minHeight: minTouch }]}>
            <Ionicons name="search" size={22} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Busca sala, edificio o lugar"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Buscar en el mapa por nombre, código o edificio"
              returnKeyType="search"
              autoCorrect={false}
              style={[styles.input, { color: colors.text, minHeight: minTouch, fontSize: typography.body.fontSize }]}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" style={styles.clear}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {q ? (
            <View style={[styles.results, shadow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {results.length === 0 ? (
                <View style={styles.pad}>
                  <AppText color="textMuted">No encontramos &apos;{query.trim()}&apos;. Prueba con el código, ej. C-210</AppText>
                </View>
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled" style={styles.resultsScroll}>
                  {results.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => pickPlace(p)}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.name}, ${placeSub(p)}. Ver en el mapa`}
                      style={[styles.resultRow, { minHeight: minTouch }]}>
                      <MaterialCommunityIcons name={p.icon as RoomIcon} size={24} color={colors.primary} />
                      <View style={styles.flex}>
                        <AppText variant="label">{p.name}</AppText>
                        <AppText variant="caption" color="textMuted">{placeSub(p)}</AppText>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}
        </View>

        {bid && hasPlan && !q ? (
          <View style={styles.rail}>
            <FloorRail
              levels={levels}
              current={level ?? levels[0]}
              dest={selPlace?.building === bid ? selPlace.floor : undefined}
              onSelect={(lv) => setSel((s) => ({ ...s, level: lv }))}
            />
          </View>
        ) : null}

        <Pressable
          onPress={() => setCamera(null)}
          accessibilityRole="button"
          accessibilityLabel="Mi posición. Volver al encuadre inicial del mapa"
          style={[styles.fab, shadow, !sheetOpen && { bottom: spacing.md + insets.bottom }, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
          <Ionicons name="locate" size={26} color={colors.primary} />
        </Pressable>
      </View>

      {sheetOpen ? (
        <View
          style={[
            styles.sheet,
            { height: sheetH, backgroundColor: colors.bg, borderColor: colors.border, paddingBottom: spacing.md + insets.bottom },
          ]}>
          <Pressable
            onPress={() => setCollapsed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={collapsed ? 'Expandir panel del edificio' : 'Contraer panel del edificio'}
            style={styles.handleHit}>
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          </Pressable>
          <View style={styles.sheetHead}>
            <AppText variant="heading" accessibilityRole="header" style={styles.flex}>{sheetTitle}</AppText>
          </View>
          {!collapsed ? (
            <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {freePlace ? (
                <>
                  <AppText color="textMuted">{placeSub(freePlace)} · Exterior</AppText>
                  <Button label="Llévame" icon="navigate" fullWidth accessibilityLabel={`Llévame a ${freePlace.name}`} onPress={() => router.push(`/route/${freePlace.id}`)} />
                </>
              ) : bid && !hasPlan ? (
                <ScreenState variant="empty" title={`Edificio ${bid} · sin planos interiores`} message="Aún no tenemos sus pisos. Puedes buscar un lugar de este edificio arriba." />
              ) : bid && !plan ? (
                <ScreenState variant="empty" title="Sin plano para este piso" message="Elige otro piso con el selector del mapa." />
              ) : (
                <>
                  {elevator ? <ElevatorStatus elevator={elevator} /> : null}
                  <AppText variant="label" color="textMuted">Salas · {floorLabel(level)}</AppText>
                  {rooms.length === 0 ? (
                    <ScreenState variant="empty" title="Sin salas en este piso" message="Prueba con otro piso." />
                  ) : (
                    rooms.map(({ room, place }) => {
                      const isSel = !!place && place.id === sel.placeId;
                      const isWc = room.kind === 'wc';
                      return (
                        <View
                          key={room.id}
                          style={[
                            styles.room,
                            {
                              minHeight: minTouch,
                              backgroundColor: isSel ? colors.primarySoft : colors.surface,
                              borderColor: isSel ? colors.primary : colors.border,
                              borderWidth: isSel ? 2 : 1,
                            },
                          ]}>
                          <View
                            accessible
                            accessibilityLabel={`${room.name}, ${KIND_LABEL[room.kind] ?? 'Sala'}${isSel ? ', seleccionada' : ''}`}
                            style={styles.roomInfo}>
                            <View style={[styles.iconWrap, { backgroundColor: isWc ? colors.successSoft : colors.primarySoft }]}>
                              <MaterialCommunityIcons name={KIND_ICON[room.kind] ?? 'door'} size={24} color={isWc ? colors.success : colors.primary} />
                            </View>
                            <View style={styles.flex}>
                              <AppText variant="label">{room.name}</AppText>
                              {room.kind !== 'room' ? <AppText variant="caption" color={isWc ? 'success' : 'textMuted'}>{KIND_LABEL[room.kind]}</AppText> : null}
                            </View>
                          </View>
                          {place ? (
                            <Pressable
                              onPress={() => router.push(`/route/${place.id}`)}
                              accessibilityRole="button"
                              accessibilityLabel={`Llévame a ${place.name}`}
                              style={[styles.go, { backgroundColor: colors.primary, minHeight: minTouch }]}>
                              <Ionicons name="navigate" size={18} color={colors.primaryText} />
                              <AppText variant="label" style={{ color: colors.primaryText }}>Llévame</AppText>
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </>
              )}
              <Button label="Volver al campus" icon="map-outline" variant="secondary" fullWidth onPress={reset} />
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  pad: { padding: spacing.lg },
  searchWrap: { position: 'absolute', zIndex: 10, elevation: 10, top: spacing.md, left: spacing.md, right: spacing.md, gap: spacing.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  input: { flex: 1 },
  clear: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  results: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  resultsScroll: { maxHeight: 280 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  rail: { position: 'absolute', right: spacing.md, top: 88 },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.lg },
  handleHit: { minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: 5, borderRadius: radius.pill },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing.sm },
  sheetBody: { gap: spacing.sm, paddingBottom: spacing.md },
  room: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md },
  roomInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  go: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.md, justifyContent: 'center' },
});
