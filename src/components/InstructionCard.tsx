import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { SimState } from '@/hooks/use-route-simulation';
import type { Maneuver } from '@/lib/maneuvers';
import type { Place, RouteResult } from '@/types';

type Theme = ReturnType<typeof useAppTheme>;
type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

type Props = {
  sim: SimState;
  route: RouteResult;
  place: Place;
  accessibleMode: boolean;
  speakOn: boolean;
  onToggleVoice: () => void;
  onHome: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
};

/** Frase corta para "Luego: …" */
const lueg = (m: Maneuver) => (m.type === 'arrive' ? 'llegas a tu destino' : m.verb);

/** Parte en negrita y parte normal de la instrucción grande. */
function split(m: Maneuver, dist: number): { strong: string; rest: string } {
  if (m.type === 'straight') return { strong: 'Sigue recto', rest: `${m.distanceM} m` };
  if (m.type === 'arrive') return { strong: dist < 5 ? 'Llegaste' : `En ${dist} m`, rest: dist < 5 ? 'a tu destino' : 'llegas a tu destino' };
  return { strong: dist < 5 ? 'Ahora' : `En ${dist} m`, rest: m.verb };
}

export function InstructionCard({ sim, route, place, accessibleMode, speakOn, onToggleVoice, onHome, onLayout }: Props) {
  const t = useAppTheme(accessibleMode);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(t), [t]);
  const m = sim.currentManeuver;
  const wrapStyle = [styles.card, { bottom: t.spacing.md + insets.bottom }];

  if (sim.finished) {
    return (
      <View style={wrapStyle} accessibilityLiveRegion="polite" onLayout={onLayout}>
        <View style={styles.arrived}>
          <View style={[styles.check, { backgroundColor: t.colors.successSoft }]}>
            <Ionicons name="checkmark-circle" size={40} color={t.colors.success} />
          </View>
          <View style={styles.flex}>
            <AppText variant="title">Llegaste a {place.name}</AppText>
            <AppText color="textMuted">{place.building ? `Edif. ${place.building} · ` : ''}Piso {place.floor}</AppText>
          </View>
          <Button label="Volver al inicio" fullWidth onPress={onHome} />
        </View>
      </View>
    );
  }

  if (!m) return <View style={wrapStyle} onLayout={onLayout} />;

  const { strong, rest } = split(m, sim.distanceToManeuverM);
  const minutes = Math.max(1, Math.ceil((sim.remainingM / Math.max(1, route.distanceM)) * route.minutes));
  const then = sim.nextManeuver;
  const label = `${sim.zone}. ${strong} ${rest}.${then ? ` Luego: ${lueg(then)}.` : ''} Faltan ${sim.remainingM} metros, ${minutes} minutos.`;

  return (
    <View style={wrapStyle} onLayout={onLayout}>
      <View accessible accessibilityLabel={label} accessibilityLiveRegion="polite" style={styles.info}>
        {sim.zone ? (
          <View style={styles.zoneRow}>
            <Ionicons name="location" size={16} color={t.colors.textMuted} />
            <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>{sim.zone}</AppText>
          </View>
        ) : null}
        <View style={styles.mainRow}>
          <View style={[styles.icon, { backgroundColor: t.colors.primary }]}>
            <MaterialCommunityIcons name={m.icon as Glyph} size={38} color={t.colors.primaryText} />
          </View>
          <AppText variant="title" numberOfLines={3} style={styles.flex}>
            <AppText variant="title" style={styles.bold}>{strong}</AppText>
            {` ${rest}`}
          </AppText>
        </View>
        <View style={styles.metaRow}>
          {then ? (
            <AppText variant="label" color="textMuted" numberOfLines={1}>Luego: {lueg(then)}</AppText>
          ) : null}
          <AppText variant="caption" color="textMuted">Faltan {sim.remainingM} m · {minutes} min</AppText>
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
          onPress={onToggleVoice}
          active={speakOn}
          t={t}
        />
      </View>
    </View>
  );
}

function Ctl({ label, icon, onPress, disabled, active, t }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; active?: boolean; t: Theme;
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

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    card: {
      position: 'absolute',
      left: t.spacing.md,
      right: t.spacing.md,
      padding: t.spacing.lg,
      gap: t.spacing.md,
      borderRadius: t.radius.lg,
      borderWidth: 2,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      ...t.shadow,
    },
    info: { gap: t.spacing.sm },
    zoneRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
    mainRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    icon: { width: 64, height: 64, borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center' },
    bold: { fontWeight: '800' },
    metaRow: { gap: t.spacing.xs },
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
