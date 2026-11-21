import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Alert, findNodeHandle, Modal, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CampusMap } from '@/components/CampusMap';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ElevatorStatus } from '@/components/ElevatorStatus';
import { Screen } from '@/components/Screen';
import { ScreenState } from '@/components/ScreenState';
import { radius, spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { getNode, getPlace, PLACES } from '@/lib/routing';
import scheduleJson from '@/data/schedule.json';
import { accessibleRoomRequest, computeSchedule, isNoElevatorLeg, placeDetail, type ClassPlan } from '@/lib/schedule';
import { formatClock } from '@/lib/time';
import type { Elevator, Place, Profile } from '@/types';

const PROFILE_LABEL: Record<Profile, string> = {
  crutches: 'Muletas o lesión temporal',
  wheelchair: 'Silla de ruedas',
  lowVision: 'Baja visión',
  none: 'Sin necesidades especiales',
};

const ORIGINS = ['acc_espana', 'acc_placeres', 'acc_san_luis', 'f_inf'];

type Quick = { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; match: (p: Place) => boolean };
const QUICK: Quick[] = [
  { id: 'banos', label: 'Baños accesibles', icon: 'accessibility', match: (p) => p.id.startsWith('bano') },
  { id: 'biblioteca', label: 'Biblioteca', icon: 'book', match: (p) => p.category === 'biblioteca' },
  { id: 'casino', label: 'Casino', icon: 'restaurant', match: (p) => p.category === 'comida' },
  { id: 'salud', label: 'Enfermería', icon: 'medkit', match: (p) => p.category === 'salud' },
  { id: 'estudio', label: 'Salas de estudio', icon: 'library', match: (p) => p.category === 'estudio' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]/g, '');
const placeSub = (p: Place) => `${p.building ? `Edif. ${p.building} · ` : ''}Piso ${p.floor}`;

export default function Home() {
  const router = useRouter();
  const { profile, origin, setOrigin, raining, incidents, elevators, confirmIncident, denyIncident } = useApp();
  const { colors, minTouch, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const sheetTitleRef = useRef<React.ComponentRef<typeof View>>(null);
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<string | null>(null);
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showElevators, setShowElevators] = useState(false);
  const downCount = elevators.filter((e) => e.status !== 'ok').length;
  const elevatorSummary = downCount === 0 ? 'Todos funcionan' : `${downCount} fuera de servicio`;
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  const sheetElevator: Elevator | undefined = elevators.find((e) => e.id === sheetId);

  useEffect(() => {
    if (!sheetId) return;
    const timer = setTimeout(() => {
      const node = sheetTitleRef.current ? findNodeHandle(sheetTitleRef.current) : null;
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 400);
    return () => clearTimeout(timer);
  }, [sheetId]);

  const closeSheet = () => {
    setSheetId(null);
    setThanks(null);
  };
  const vote = (stillDown: boolean) => {
    if (!sheetElevator?.incidentId) return;
    const people = sheetElevator.dailyUsers ?? 3;
    let msg: string;
    if (stillDown) {
      confirmIncident(sheetElevator.incidentId);
      msg = `Gracias, ayudas a ${people} personas que pasan por aquí hoy`;
    } else {
      const resolved = denyIncident(sheetElevator.incidentId);
      msg = resolved
        ? `Gracias. El ascensor del Edif. ${sheetElevator.building} vuelve a estar disponible y recalculamos las rutas`
        : `Gracias, ayudas a ${people} personas que pasan por aquí hoy. Falta otra confirmación para darlo por funcionando`;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AccessibilityInfo.announceForAccessibility(msg);
    setThanks(msg);
    setTimeout(closeSheet, 2200);
  };

  const nextClass = scheduleJson.classes.find((c) => c.id === scheduleJson.nextClassId);
  const classPlace = nextClass ? getPlace(nextClass.placeId) : undefined;
  const plans = useMemo<ClassPlan[]>(() => {
    try {
      return computeSchedule(profile, origin, incidents, elevators, raining);
    } catch {
      return [];
    }
  }, [profile, origin, incidents, elevators, raining]);
  const nextPlan = plans.find((p) => p.cls.id === scheduleJson.nextClassId) ?? null;
  const warnPlan = plans.find((p) => p.startMin > (nextPlan?.startMin ?? 0) && (p.status === 'tarde' || p.status === 'justo' || p.status === 'sin-ruta'));
  const noElevPlan = plans.find((p) => p.startMin > (nextPlan?.startMin ?? 0) && isNoElevatorLeg(p, profile));
  const leaveTone = nextPlan?.status === 'tarde' || nextPlan?.status === 'sin-ruta' ? 'danger' : nextPlan?.status === 'justo' ? 'warning' : 'success';
  const leaveText =
    !nextPlan || !nextPlan.status ? null
    : nextPlan.status === 'tarde' ? `No alcanzas por ${nextPlan.lateBy} min`
    : nextPlan.status === 'justo' ? 'Vas justo: sal ahora'
    : nextPlan.status === 'sin-ruta' ? 'Sin ruta accesible ahora'
    : null;
  const leaveDetail =
    nextPlan && nextPlan.leaveAt != null && nextPlan.status !== 'sin-ruta'
      ? nextPlan.fromOrigin
        ? `Sal a las ${formatClock(nextPlan.leaveAt)} · llegas ${formatClock(nextPlan.arriveAt ?? 0)}`
        : `Sales de ${nextPlan.fromLabel} a las ${formatClock(nextPlan.leaveAt)} · llegas ${formatClock(nextPlan.arriveAt ?? 0)}`
      : null;
  const leaveLine = [leaveText, leaveDetail].filter(Boolean).join('. ');
  const firstName = scheduleJson.student.name.split(' ')[0];

  const downElevators = elevators.filter(
    (e) => e.status !== 'ok' && !incidents.some((i) => i.elevatorId === e.id),
  );
  const alerts = [
    ...incidents.map((i) => ({
      key: i.id,
      tone: (i.type === 'elevator' ? 'danger' : 'warning') as 'danger' | 'warning',
      text: i.description,
      detail: `${i.description}\n\nReportado por ${i.reportedBy} hace ${i.minutesAgo} min.${
        i.blocksRoute ? ' Este tramo queda fuera de tus rutas.' : ''
      }`,
    })),
    ...downElevators.map((e) => ({
      key: e.id,
      tone: 'danger' as const,
      text: `Ascensor del Edificio ${e.building} fuera de servicio`,
      detail: `Ascensor del Edificio ${e.building} fuera de servicio. Recalculamos tus rutas sin usarlo.`,
    })),
  ];

  const worstDanger = alerts.some((a) => a.tone === 'danger');
  const worstFg = worstDanger ? colors.danger : colors.warning;
  const worstBg = worstDanger ? colors.dangerSoft : colors.warningSoft;
  const alertsTitle = alerts.length === 1 ? '1 aviso en el campus' : `${alerts.length} avisos en el campus`;

  const q = norm(query.trim());
  const active = q.length > 0 || quick !== null;
  const results = useMemo(() => {
    const qk = QUICK.find((x) => x.id === quick);
    return PLACES.filter((p) => {
      if (qk && !qk.match(p)) return false;
      if (!q) return true;
      return norm(p.name).includes(q) || norm(p.id).includes(q) || norm(`edif${p.building ?? ''}`).includes(q);
    });
  }, [q, quick]);

  const originLabel = getNode(origin)?.label ?? 'Acceso';
  const inputStyle = { color: colors.text, minHeight: minTouch, fontSize: typography.body.fontSize };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} scroll>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="display" accessibilityRole="header">
            Hola, {firstName}
          </AppText>
        </View>
      </View>
      <View style={styles.chips}>
        <Chip
          icon="person-circle"
          label={`Perfil: ${PROFILE_LABEL[profile]}`}
          accessibilityLabel={`Perfil: ${PROFILE_LABEL[profile]}. Cambiar perfil`}
          onPress={() => router.replace('/')}
        />
      </View>

      <Card
        onPress={() => router.push('/map' as Href)}
        accessibilityLabel="Mapa del campus. Explora edificios, pisos y ascensores. Abrir mapa"
        style={styles.mapCard}>
        <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[styles.mapThumb, { borderColor: colors.border }]}>
          <CampusMap
            mode="macro"
            routePoints={[]}
            origin={getNode(origin) ? { x: getNode(origin)!.x, y: getNode(origin)!.y } : undefined}
            height={160}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText variant="heading">Mapa del campus</AppText>
            <AppText variant="caption" color="textMuted">Explora edificios, pisos y ascensores</AppText>
          </View>
          <View style={[styles.openBtn, { backgroundColor: colors.primary, minHeight: minTouch }]}>
            <Ionicons name="map" size={18} color={colors.primaryText} />
            <AppText variant="label" style={{ color: colors.primaryText }}>Abrir mapa</AppText>
          </View>
        </View>
      </Card>

      {nextClass && classPlace ? (
        <Card style={[styles.gap, styles.nextCard, { borderColor: colors.primary }]}>
          <AppText variant="label" color="primary">
            Tu próxima clase
          </AppText>
          <AppText variant="title" accessibilityRole="header">{nextClass.course}</AppText>
          <AppText color="textMuted">
            {placeDetail(classPlace)} · {nextClass.start} a {nextClass.end}
          </AppText>
          {leaveLine ? (
            <View
              accessible
              accessibilityLabel={leaveLine}
              style={[styles.leave, { backgroundColor: colors[`${leaveTone}Soft` as 'successSoft'], borderColor: colors[leaveTone] }]}>
              <Ionicons name={leaveTone === 'success' ? 'time' : 'warning'} size={22} color={colors[leaveTone]} />
              <View style={styles.flex}>
                {leaveText ? <AppText variant="label">{leaveText}</AppText> : null}
                {leaveDetail ? <AppText variant={leaveText ? 'caption' : 'label'}>{leaveDetail}</AppText> : null}
              </View>
            </View>
          ) : null}
          {nextPlan && nextPlan.extraMinutes > 0 ? (
            <AppText variant="caption" color="textMuted">+{nextPlan.extraMinutes} min por ruta accesible</AppText>
          ) : null}
          <Button
            label="Llévame"
            icon="navigate"
            fullWidth
            accessibilityLabel={`Llévame a ${classPlace.name}`}
            onPress={() => {
              router.push(`/route/${classPlace.id}`);
            }}
          />
          <Pressable
            onPress={() => router.push('/my-day')}
            accessibilityRole="button"
            accessibilityLabel="Ver mi día"
            style={[styles.row, styles.secondary, { minHeight: minTouch }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <AppText variant="label" color="primary">Ver mi día</AppText>
          </Pressable>
          {noElevPlan ? (
            <View
              accessible
              accessibilityLabel={`A las ${noElevPlan.cls.start}, ${noElevPlan.cls.course}: sin ruta accesible, piso sin ascensor`}
              style={[styles.leave, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
              <Ionicons name="warning" size={22} color={colors.danger} />
              <View style={styles.flex}>
                <AppText variant="label">{noElevPlan.cls.start} · {noElevPlan.cls.course}</AppText>
                <AppText variant="caption">Sin ruta accesible · piso sin ascensor ({noElevPlan.place.name}, Edif. {noElevPlan.place.building})</AppText>
              </View>
            </View>
          ) : null}
          {noElevPlan ? (
            <Button
              label="Solicitar sala accesible"
              icon="share-outline"
              variant="secondary"
              fullWidth
              accessibilityLabel={`Solicitar sala accesible para ${noElevPlan.cls.course}`}
              onPress={() => {
                Share.share({ message: accessibleRoomRequest(profile, noElevPlan.place, noElevPlan.cls.course) }).catch(() => {});
              }}
            />
          ) : null}
          {warnPlan && warnPlan.leaveAt != null ? (
            <Pressable
              onPress={() => router.push('/my-day')}
              accessibilityRole="button"
              accessibilityLabel={`Ojo: a las ${formatClock(warnPlan.leaveAt)} ${warnPlan.status === 'tarde' ? 'no alcanzas' : 'vas justo'} a ${warnPlan.cls.course}. Ver mi día`}
              style={[styles.row, { minHeight: minTouch }]}>
              <Ionicons name="warning" size={18} color={colors.warning} />
              <AppText variant="caption" style={[styles.flex, { color: colors.warning, fontWeight: '700' }]}>
                Ojo: a las {formatClock(warnPlan.leaveAt)} {warnPlan.status === 'tarde' ? 'no alcanzas' : 'vas justo'} a {warnPlan.cls.course}
              </AppText>
              <Ionicons name="chevron-forward" size={18} color={colors.warning} />
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {alerts.length > 0 ? (
        <View style={[styles.gap, styles.afterCard]}>
          <Pressable
            onPress={() => setShowAlerts((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`${alertsTitle}. ${showAlerts ? 'Ocultar' : 'Ver'} avisos`}
            accessibilityState={{ expanded: showAlerts }}
            style={[styles.alertRow, { backgroundColor: worstBg, borderColor: worstFg, minHeight: minTouch }]}>
            <Ionicons name="warning" size={22} color={worstFg} />
            <AppText variant="label" style={styles.flex}>{alertsTitle}</AppText>
            <Ionicons name={showAlerts ? 'chevron-down' : 'chevron-forward'} size={20} color={worstFg} />
          </Pressable>
          {showAlerts
            ? alerts.map((a) => (
                <Banner key={a.key} tone={a.tone} text={a.text} onPress={() => Alert.alert('Detalle del aviso', a.detail)} />
              ))
            : null}
        </View>
      ) : null}

      <View style={styles.gap}>
        <Pressable
          onPress={() => setShowElevators((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`Ascensores del campus: ${elevatorSummary}. ${showElevators ? 'Ocultar' : 'Ver'} detalle`}
          accessibilityState={{ expanded: showElevators }}
          style={[styles.row, { minHeight: minTouch }]}>
          <MaterialCommunityIcons name="elevator-passenger" size={22} color={colors.primary} />
          <View style={styles.flex}>
            <AppText variant="heading">Ascensores del campus</AppText>
            <AppText variant="caption" color={downCount > 0 ? 'danger' : 'success'}>{elevatorSummary}</AppText>
          </View>
          <Ionicons name={showElevators ? 'chevron-down' : 'chevron-forward'} size={20} color={colors.textMuted} />
        </Pressable>
        {showElevators
          ? elevators.length === 0
            ? <ScreenState variant="empty" title="Sin datos de ascensores" message="Intenta de nuevo en unos minutos" />
            : elevators.map((e) => <ElevatorStatus key={e.id} elevator={e} onPress={() => setSheetId(e.id)} />)
          : null}
      </View>

      <Pressable
        onPress={() => setPickingOrigin((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`Desde: ${originLabel}. Cambiar el punto de partida`}
        accessibilityState={{ expanded: pickingOrigin }}
        style={[styles.row, styles.origin, { minHeight: minTouch }]}>
        <Ionicons name="location" size={22} color={colors.primary} />
        <AppText variant="label" style={styles.flex}>
          Desde: {originLabel}
        </AppText>
        <Ionicons name={pickingOrigin ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>
      {pickingOrigin ? (
        <View style={styles.chips}>
          {ORIGINS.map((id) => (
            <Chip
              key={id}
              label={getNode(id)?.label ?? id}
              selected={id === origin}
              onPress={() => {
                setOrigin(id);
                setPickingOrigin(false);
              }}
            />
          ))}
        </View>
      ) : null}

      <View
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, minHeight: minTouch }]}>
        <Ionicons name="search" size={22} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Busca sala, edificio o lugar"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Buscar destino por nombre, código o edificio"
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.input, inputStyle]}
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Borrar búsqueda"
            style={styles.clear}>
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chips}>
        {QUICK.map((c) => (
          <Chip
            key={c.id}
            icon={c.icon}
            label={c.label}
            selected={quick === c.id}
            role="checkbox"
            checked={quick === c.id}
            onPress={() => setQuick(quick === c.id ? null : c.id)}
          />
        ))}
      </View>

      {active ? (
        results.length === 0 ? (
          <ScreenState
            variant="empty"
            title={`No encontramos '${query.trim()}'`}
            message="Prueba con el código de sala, ej. C-210"
          />
        ) : (
          <View style={styles.gap}>
            {results.map((p) => (
              <Card
                key={p.id}
                onPress={() => router.push(`/route/${p.id}`)}
                accessibilityLabel={`${p.name}, ${placeSub(p)}`}
                style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
                  <MaterialCommunityIcons
                    name={p.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={26}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.flex}>
                  <AppText variant="heading">{p.name}</AppText>
                  <AppText variant="label" color="textMuted">
                    {placeSub(p)}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
              </Card>
            ))}
          </View>
        )
      ) : null}

      <Button
        label="Reportar barrera"
        variant="secondary"
        icon="flag"
        fullWidth
        onPress={() => router.push('/report')}
      />

      <Modal visible={!!sheetElevator} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
          <Pressable style={styles.flex} onPress={closeSheet} accessibilityRole="button" accessibilityLabel="Cerrar detalle del ascensor" />
          {sheetElevator ? (
            <View
              accessibilityViewIsModal
              style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.border, paddingBottom: spacing.xl + insets.bottom }]}>
              <View ref={sheetTitleRef} accessible accessibilityRole="header">
                <AppText variant="heading">Ascensor Edif. {sheetElevator.building}</AppText>
              </View>
              <ElevatorStatus elevator={sheetElevator} />
              {thanks ? (
                <View accessibilityRole="alert" style={[styles.thanks, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
                  <Ionicons name="heart" size={24} color={colors.success} />
                  <AppText variant="label" style={styles.flex}>{thanks}</AppText>
                </View>
              ) : (
                <>
                  <AppText variant="body">¿Pasaste por aquí? Tu respuesta ayuda a mantener las rutas al día.</AppText>
                  <Button label="Sigue fuera de servicio" icon="close-circle" variant="danger" fullWidth onPress={() => vote(true)} />
                  <Button label="Ya funciona" icon="checkmark-circle" variant="secondary" fullWidth onPress={() => vote(false)} />
                  <Button label="Cerrar" variant="ghost" fullWidth onPress={closeSheet} />
                </>
              )}
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  gap: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  origin: { paddingHorizontal: spacing.xs },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  input: { flex: 1 },
  secondary: { alignSelf: 'flex-start', paddingHorizontal: spacing.xs },
  mapCard: { gap: spacing.md, padding: spacing.md },
  mapThumb: { height: 160, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.md },
  nextCard: { borderWidth: 1 },
  afterCard: { marginTop: spacing.xl },
  leave: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 2 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    gap: spacing.md,
    padding: spacing.xl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
  },
  thanks: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  clear: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
