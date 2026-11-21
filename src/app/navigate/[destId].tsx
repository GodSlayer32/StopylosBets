import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { BuildingSection } from '@/components/BuildingSection';
import { Button } from '@/components/Button';
import { NearbyMap } from '@/components/NearbyMap';
import { RouteMap } from '@/components/RouteMap';
import { ScreenState } from '@/components/ScreenState';
import { useApp } from '@/context/app-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useRouteSimulation } from '@/hooks/use-route-simulation';
import { getPlace } from '@/lib/routing';
import type { RouteResult } from '@/types';

type Status = 'loading' | 'ready' | 'error';

export default function NavigateScreen() {
  const { destId } = useLocalSearchParams<{ destId: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { getRoute, accessibleMode, profile, elevators } = useApp();
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
  const total = route?.steps.length ?? 0;

  // Voz + háptico al cambiar de paso (y al llegar)
  const lastSpoken = useRef<string>('');
  useEffect(() => {
    if (!route || !step) return;
    const key = sim.finished ? 'done' : `s${sim.stepIndex}`;
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
      Speech.speak(`Paso ${sim.stepIndex + 1} de ${total}. ${step.text}`, { language: 'es-CL' });
    }
  }, [route, step, sim.stepIndex, sim.finished, speakOn, total, place?.name]);

  useEffect(() => () => { Speech.stop(); }, []);

  // Transición entre modo exterior (plano) e interior (corte)
  const mode = sim.inside && sim.building ? 'inside' : 'outside';
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
  const destInSame = place.building && place.building === sim.building;
  const elevDown = elevators.find((e) => e.building === sim.building)?.status === 'down';
  const via = route.steps.some((s) => s.type === 'elevator') ? 'elevator' : null;

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
        {shown === 'inside' && sim.building ? (
          <BuildingSection
            buildingId={sim.building}
            currentLevel={sim.level ?? 1}
            destLevel={destInSame ? place.floor : undefined}
            destLabel={destInSame ? place.name : undefined}
            via={via}
            elevatorDown={elevDown}
            stairsAvoided={route.stepsAvoided > 0}
            position={sim.stepProgress}
            height={topH}
          />
        ) : (
          <View>
            <RouteMap
              route={route}
              width={width}
              height={topH}
              barriers={[]}
              accessibleMode={accessibleMode}
              label={`Mapa general de la ruta hacia ${place.name}`}
            />
            <PositionMarker route={route} point={sim.point} width={width} height={topH} t={t} />
          </View>
        )}
      </Animated.View>

      <View style={[styles.divider, { backgroundColor: t.colors.primary }]} />

      <View style={styles.flex} onLayout={(e) => setMapH(Math.round(e.nativeEvent.layout.height))}>
        {mapH > 0 ? <NearbyMap
          route={route}
          point={sim.point}
          heading={sim.heading}
          segIndex={sim.segIndex}
          width={width}
          height={mapH}
          bottomInset={cardH + t.spacing.md * 2 + insets.bottom}
          accessibleMode={accessibleMode}
          label="Vista cercana orientada en tu dirección de avance"
        /> : null}
      </View>

      <View style={[styles.card, { bottom: t.spacing.md + insets.bottom }]} accessibilityLiveRegion="polite" onLayout={(e) => setCardH(Math.round(e.nativeEvent.layout.height))}>
        {sim.finished ? (
          <View style={styles.arrived}>
            <View style={[styles.check, { backgroundColor: t.colors.successSoft }]}>
              <Ionicons name="checkmark-circle" size={40} color={t.colors.success} />
            </View>
            <View style={styles.flex}>
              <AppText variant="title">Llegaste a {place.name}</AppText>
              <AppText color="textMuted">{place.building ? `Edif. ${place.building} · ` : ''}Piso {place.floor}</AppText>
            </View>
            <Button label="Volver al inicio" fullWidth onPress={() => { Speech.stop(); router.replace('/home'); }} />
          </View>
        ) : (
          <>
            <View style={styles.stepRow}>
              <View style={[styles.stepIcon, { backgroundColor: t.colors.primarySoft }]}>
                <MaterialCommunityIcons name={step.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={32} color={t.colors.primary} />
              </View>
              <View style={styles.flex}>
                <AppText variant="heading" numberOfLines={3}>{step.text}</AppText>
                <AppText variant="label" color="textMuted">
                  Paso {sim.stepIndex + 1} de {total} · faltan {sim.remainingM} m
                </AppText>
              </View>
            </View>
            <View style={styles.controls}>
              <Ctl label="Paso anterior" icon="chevron-back" onPress={sim.prev} disabled={sim.stepIndex === 0 && sim.progress < 0.01} t={t} />
              <Pressable
                onPress={sim.playing ? sim.pause : sim.play}
                accessibilityRole="button"
                accessibilityLabel={sim.playing ? 'Pausar recorrido' : 'Simular recorrido'}
                style={[styles.play, { backgroundColor: t.colors.primary }]}>
                <Ionicons name={sim.playing ? 'pause' : 'play'} size={22} color={t.colors.primaryText} />
                <AppText variant="label" style={{ color: t.colors.primaryText }}>{sim.playing ? 'Pausa' : 'Simular'}</AppText>
              </Pressable>
              <Ctl label="Paso siguiente" icon="chevron-forward" onPress={sim.next} t={t} />
              <Ctl
                label={speakOn ? 'Desactivar voz' : 'Activar voz'}
                icon={speakOn ? 'volume-high' : 'volume-mute'}
                onPress={() => { Speech.stop(); setVoice((v) => !v); }}
                active={speakOn}
                t={t}
              />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const IMG_W = 1313;
const IMG_H = 980;

/** Replica el recorte de RouteMap para dibujar la posición actual con halo. */
function PositionMarker({ route, point, width, height, t }: {
  route: RouteResult; point: { x: number; y: number }; width: number; height: number; t: ReturnType<typeof useAppTheme>;
}) {
  const pts = route.polyline.map((p) => ({ x: (p.x / 100) * IMG_W, y: (p.y / 100) * IMG_H }));
  const ar = width / height;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = 90;
  let w = Math.max(Math.max(...xs) - Math.min(...xs) + pad * 2, (Math.max(...ys) - Math.min(...ys) + pad * 2) * ar, 360);
  let h = w / ar;
  if (w > IMG_W) { w = IMG_W; h = w / ar; }
  if (h > IMG_H) { h = IMG_H; w = h * ar; }
  const l = Math.min(Math.max((Math.max(...xs) + Math.min(...xs)) / 2 - w / 2, 0), IMG_W - w);
  const tp = Math.min(Math.max((Math.max(...ys) + Math.min(...ys)) / 2 - h / 2, 0), IMG_H - h);
  const x = (((point.x / 100) * IMG_W - l) / w) * width;
  const y = (((point.y / 100) * IMG_H - tp) / h) * height;
  const R = 22;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x - R, top: y - R, width: R * 2, height: R * 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: R * 2, height: R * 2, borderRadius: R, backgroundColor: t.colors.primary, opacity: 0.3 }} />
      <View style={{ width: R, height: R, borderRadius: R / 2, backgroundColor: t.colors.primary, borderWidth: 4, borderColor: t.colors.surface }} />
    </View>
  );
}

function Ctl({ label, icon, onPress, disabled, active, t }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; active?: boolean;
  t: ReturnType<typeof useAppTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: active }}
      style={{
        width: t.minTouch,
        height: t.minTouch,
        borderRadius: t.radius.md,
        borderWidth: 2,
        borderColor: t.colors.primary,
        backgroundColor: active ? t.colors.primarySoft : t.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}>
      <Ionicons name={icon} size={24} color={t.colors.primary} />
    </Pressable>
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
    card: {
      position: 'absolute',
      left: t.spacing.md,
      right: t.spacing.md,
      bottom: t.spacing.md,
      padding: t.spacing.lg,
      gap: t.spacing.md,
      borderRadius: t.radius.lg,
      borderWidth: 2,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      ...t.shadow,
    },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    stepIcon: { width: 56, height: 56, borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center' },
    controls: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    play: {
      flex: 1,
      minHeight: t.minTouch,
      borderRadius: t.radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.xs,
    },
    arrived: { gap: t.spacing.md },
    check: { width: 64, height: 64, borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center' },
  });
