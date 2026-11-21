import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { SimState } from '@/hooks/use-route-simulation';
import { AMENITY_ICON, amenityShort } from '@/lib/amenities';
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
  /** Repite la instrucción actual por voz + háptico */
  onRepeat?: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Ruta parcial: la llegada es al punto alcanzable, no al destino */
  partial?: {
    reachedLabel: string;
    remainingM: number;
    assignee?: string;
    etaMin?: number;
    onViewTicket: () => void;
    onHelped: () => void;
  };
};

/** Frase corta para "Luego: …" */
const lueg = (m: Maneuver) => (m.type === 'arrive' ? 'llegas a tu destino' : m.verb);

/** Parte en negrita y parte normal de la instrucción grande. */
function split(m: Maneuver, dist: number): { strong: string; rest: string } {
  if (m.type === 'straight') return { strong: 'Sigue recto', rest: `${m.distanceM} m` };
  if (m.type === 'arrive') return { strong: dist < 5 ? 'Llegaste' : `En ${dist} m`, rest: dist < 5 ? 'a tu destino' : 'llegas a tu destino' };
  return { strong: dist < 5 ? 'Ahora' : `En ${dist} m`, rest: m.verb };
}

function InstructionCardBase({ sim, route, place, accessibleMode, speakOn, onToggleVoice, onHome, onRepeat, onLayout, partial }: Props) {
  const t = useAppTheme(accessibleMode);
  const insets = useSafeAreaInsets();
  const compact = !accessibleMode;
  const [collapsed, setCollapsed] = useState(false);
  const styles = useMemo(() => makeStyles(t, compact), [t, compact]);
  const m = sim.currentManeuver;
  const wrapStyle = [styles.card, { bottom: t.spacing.md + insets.bottom }];

  if (sim.finished && partial) {
    const status = partial.assignee
      ? `${partial.assignee} va en camino · llega en ~${partial.etaMin} min`
      : 'Pedimos apoyo, espera aquí';
    return (
      <View style={wrapStyle} onLayout={onLayout}>
        <View style={styles.arrived}>
          <View style={[styles.check, { backgroundColor: t.colors.successSoft }]}>
            <Ionicons name="checkmark-circle" size={40} color={t.colors.success} />
          </View>
          <View
            style={styles.flex}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`Llegaste a ${partial.reachedLabel}. Faltan ${partial.remainingM} metros hasta ${place.name}. ${status}`}>
            <AppText variant="title">Llegaste a {partial.reachedLabel}</AppText>
            <AppText color="textMuted">Faltan {partial.remainingM} m hasta {place.name}</AppText>
          </View>
          <View style={[styles.statusRow, { backgroundColor: t.colors.successSoft }]}>
            <Ionicons name={partial.assignee ? 'person-circle' : 'hourglass'} size={t.iconSize.sm} color={t.colors.success} />
            <AppText variant="caption" color="success" style={styles.flex}>{status}</AppText>
          </View>
          <Button label="Volver al inicio" variant="secondary" fullWidth onPress={onHome} />
          <Button label="Ya me ayudaron" icon="checkmark-circle" fullWidth onPress={partial.onHelped} />
          <Button label="Ver mi ticket" variant="secondary" fullWidth onPress={partial.onViewTicket} />
        </View>
      </View>
    );
  }

  if (sim.finished) {
    return (
      <View style={wrapStyle} onLayout={onLayout}>
        <View style={styles.arrived}>
          <View style={[styles.check, { backgroundColor: t.colors.successSoft }]}>
            <Ionicons name="checkmark-circle" size={40} color={t.colors.success} />
          </View>
          <View style={styles.flex} accessible accessibilityRole="header" accessibilityLabel={`Llegaste a ${place.name}. ${place.building ? `Edificio ${place.building}, ` : ''}piso ${place.floor}`}>
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
  const near = sim.nextAmenities.slice(0, 2);
  const amenityText = near.map((a) => (a.distM < 5 ? `${amenityShort(a.amenity.type)} aquí` : `${amenityShort(a.amenity.type)} a ${a.distM} m`)).join(' · ');
  const amenityLabel = near.length ? `Cerca: ${near.map((a) => (a.distM < 5 ? `${a.amenity.name} aquí` : `${a.amenity.name} a ${a.distM} metros`)).join(', ')}` : '';
  const label = `${sim.zone}. ${strong} ${rest}.${then ? ` Luego: ${lueg(then)}.` : ''}${m.cue ? ` ${m.cue}.` : ''} Faltan ${sim.remainingM} metros, ${minutes} minutos.${amenityLabel ? ` ${amenityLabel}.` : ''}`;

  const toggle = (
    <Pressable
      onPress={() => setCollapsed((c) => !c)}
      accessibilityRole="button"
      accessibilityLabel={collapsed ? 'Ver instrucciones' : 'Ver mapa'}
      accessibilityState={{ expanded: !collapsed }}
      style={styles.toggle}>
      <Ionicons name={collapsed ? 'chevron-up' : 'chevron-down'} size={26} color={t.colors.primary} />
    </Pressable>
  );

  return (
    <View style={wrapStyle} onLayout={onLayout}>
      <View accessible accessibilityLabel={label} accessibilityLiveRegion={sim.playing ? 'none' : 'polite'} style={styles.info}>
        {collapsed ? null : (
          <View style={styles.zoneRow}>
            <Ionicons name="location" size={t.typography.caption.fontSize} color={t.colors.textMuted} />
            <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>{sim.zone}</AppText>
            {toggle}
          </View>
        )}
        <View style={styles.mainRow}>
          <View style={[styles.icon, { backgroundColor: t.colors.primary }]}>
            <MaterialCommunityIcons name={m.icon as Glyph} size={compact ? 24 : 32} color={t.colors.primaryText} />
          </View>
          <AppText variant="title" numberOfLines={collapsed ? 1 : 2} style={[styles.flex, compact && styles.mainText]}>
            <AppText variant="title" style={[compact && styles.mainText, styles.bold]}>{strong}</AppText>
            {` ${rest}`}
          </AppText>
          {collapsed ? toggle : null}
        </View>
        {collapsed ? null : (
          <>
            {m.cue ? (
              <AppText variant={compact ? 'caption' : 'body'} color="textMuted" numberOfLines={compact ? 1 : 2}>
                {m.cue.charAt(0).toUpperCase() + m.cue.slice(1)}
              </AppText>
            ) : null}
            {compact && near.length ? (
              <View style={styles.amenityRow}>
                <MaterialCommunityIcons name={AMENITY_ICON[near[0].amenity.type] as Glyph} size={16} color={t.colors.primary} />
                <AppText variant="caption" numberOfLines={1} style={styles.flex}>{amenityText}</AppText>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              {then ? (
                <AppText variant="label" color="textMuted" numberOfLines={compact ? 2 : 1} style={compact ? undefined : styles.flex}>Luego: {lueg(then)}</AppText>
              ) : null}
              <AppText variant="caption" color="textMuted" tabular>Faltan {sim.remainingM} m · {minutes} min</AppText>
            </View>
          </>
        )}
      </View>
      {!compact && onRepeat ? (
        <Pressable
          onPress={onRepeat}
          accessibilityRole="button"
          accessibilityLabel="Repetir instrucción"
          accessibilityHint="Vuelve a decir la instrucción y repite la vibración"
          style={({ pressed }) => [styles.repeat, { backgroundColor: t.colors.primary }, pressed && { opacity: 0.85 }]}>
          <MaterialCommunityIcons name="replay" size={36} color={t.colors.primaryText} />
          <AppText variant="title" style={{ color: t.colors.primaryText }}>Repetir instrucción</AppText>
        </Pressable>
      ) : null}
      {collapsed ? null : <View style={styles.controls}>
        <Ctl compact={compact} label="Paso anterior" icon="chevron-back" onPress={sim.prev} disabled={sim.stepIndex === 0 && sim.progress < 0.01} t={t} />
        <Pressable
          onPress={sim.playing ? sim.pause : sim.play}
          accessibilityRole="button"
          accessibilityLabel={sim.playing ? 'Pausar recorrido' : 'Simular recorrido'}
          style={[styles.play, { backgroundColor: t.colors.primary }]}>
          <Ionicons name={sim.playing ? 'pause' : 'play'} size={22} color={t.colors.primaryText} />
          <AppText variant="label" style={{ color: t.colors.primaryText }}>{sim.playing ? 'Pausa' : 'Simular'}</AppText>
        </Pressable>
        <Ctl compact={compact} label="Paso siguiente" icon="chevron-forward" onPress={sim.next} t={t} />
        <Ctl compact={compact}
          label={speakOn ? 'Desactivar voz' : 'Activar voz'}
          icon={speakOn ? 'volume-high' : 'volume-mute'}
          onPress={onToggleVoice}
          active={speakOn}
          t={t}
        />
      </View>}
    </View>
  );
}

function Ctl({ label, icon, onPress, disabled, active, t, compact }: {
  compact: boolean; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; active?: boolean; t: Theme;
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
        borderWidth: compact ? 1 : 2,
        borderColor: disabled ? t.colors.border : t.colors.borderStrong,
        backgroundColor: disabled ? 'transparent' : active ? t.colors.primarySoft : t.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon} size={compact ? 22 : 24} color={disabled ? t.colors.textMuted : t.colors.primary} />
    </Pressable>
  );
}

const makeStyles = (t: Theme, compact: boolean) =>
  StyleSheet.create({
    flex: { flex: 1 },
    card: {
      position: 'absolute',
      left: t.spacing.md,
      right: t.spacing.md,
      padding: t.spacing.md,
      gap: t.spacing.sm,
      borderRadius: t.radius.lg,
      borderWidth: compact ? 0 : 2,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      ...t.shadow,
    },
    info: { gap: t.spacing.xs },
    zoneRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
    mainRow: { flexDirection: 'row', alignItems: 'center', gap: compact ? t.spacing.sm : t.spacing.md },
    icon: compact
      ? { width: 40, height: 40, borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center' }
      : { width: 52, height: 52, borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center' },
    bold: { fontWeight: '800' },
    mainText: { ...t.typography.heading, fontWeight: '600' },
    metaRow: compact ? { gap: t.spacing.xs } : { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    toggle: { width: t.minTouch, height: t.minTouch, alignItems: 'center', justifyContent: 'center', marginVertical: -t.spacing.sm },
    amenityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      alignSelf: 'stretch',
      paddingHorizontal: compact ? t.spacing.sm : t.spacing.md,
      paddingVertical: compact ? t.spacing.xs : t.spacing.sm,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.primarySoft,
    },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: compact ? 'space-between' : undefined, gap: t.spacing.sm },
    play: {
      flex: compact ? undefined : 1,
      paddingHorizontal: compact ? t.spacing.lg : 0,
      minHeight: t.minTouch,
      borderRadius: t.radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.xs,
    },
    repeat: {
      alignSelf: 'stretch',
      minHeight: 64,
      borderRadius: t.radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md, borderRadius: t.radius.md },
    arrived: { gap: t.spacing.md },
    check: { width: 64, height: 64, borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center' },
  });

export const InstructionCard = memo(InstructionCardBase);
