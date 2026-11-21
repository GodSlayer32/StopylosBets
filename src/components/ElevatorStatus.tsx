import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { minTouch, radius, shadow, spacing, thumbSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAgo, formatConfirmations } from '@/lib/time';
import type { Elevator } from '@/types';

const STATE_LABEL = { ok: 'Funciona', down: 'Fuera de servicio', unconfirmed: 'Sin confirmar' } as const;

/** Frase de frescura y confianza; ej. "Reportado hace 12 min · 3 confirmaciones" */
export function elevatorDetail(e: Elevator): string {
  if (e.status === 'ok') return e.freshness ?? '';
  const base = `${e.freshness ?? ''} · ${formatConfirmations(e.confirmations ?? 0)}`;
  return e.status === 'unconfirmed' && e.lastConfirmedAt
    ? `${base} · última ${formatAgo(e.lastConfirmedAt)}`
    : base;
}

export function elevatorSentence(e: Elevator): string {
  const fuente = e.source === 'comunidad' ? 'Fuente: comunidad' : `Fuente: ${e.source}`;
  return `Ascensor Edif. ${e.building}, ${STATE_LABEL[e.status].toLowerCase()}. ${elevatorDetail(e)}. ${fuente}`;
}

type Props = { elevator: Elevator; onPress?: () => void };

export function ElevatorStatus({ elevator: e, onPress }: Props) {
  const { colors, accessible } = useTheme();
  const tone = {
    ok: { fg: colors.success, bg: colors.successSoft, icon: 'checkmark-circle' as const },
    down: { fg: colors.danger, bg: colors.dangerSoft, icon: 'close-circle' as const },
    unconfirmed: { fg: colors.warning, bg: colors.warningSoft, icon: 'help-circle' as const },
  }[e.status];
  const actionable = !!onPress && e.status !== 'ok';
  const content = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
        <MaterialCommunityIcons name="elevator-passenger" size={24} color={tone.fg} />
      </View>
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <AppText variant="label">Ascensor Edif. {e.building}</AppText>
          <View style={[styles.pill, { backgroundColor: tone.bg, borderColor: tone.fg }]}>
            <Ionicons name={tone.icon} size={14} color={tone.fg} />
            <AppText variant="caption" style={{ color: tone.fg }}>{STATE_LABEL[e.status]}</AppText>
          </View>
        </View>
        <AppText variant="caption" color="textMuted">{elevatorDetail(e)}</AppText>
        <AppText variant="caption" color="textMuted">
          Fuente: {e.source === 'comunidad' ? 'comunidad' : e.source}
        </AppText>
        {e.photoUri && e.status !== 'ok' ? (
          <View style={styles.photoRow}>
            <Image
              source={{ uri: e.photoUri }}
              style={[styles.thumb, { borderColor: colors.border }]}
              accessibilityRole="image"
              accessibilityLabel="Foto adjunta al reporte del ascensor"
            />
            <AppText variant="caption" color="textMuted">Foto del reporte</AppText>
          </View>
        ) : null}
      </View>
      {actionable ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null}
    </>
  );
  const style = [styles.row, accessible ? { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 2 } : { backgroundColor: colors.surface, ...shadow }];
  if (actionable) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={elevatorSentence(e)}
        accessibilityHint="Confirma si sigue fuera de servicio"
        style={style}>
        {content}
      </Pressable>
    );
  }
  return (
    <View accessible accessibilityLabel={elevatorSentence(e)} style={style}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xs },
  row: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  iconWrap: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: { width: thumbSize, height: thumbSize, borderRadius: radius.sm, borderWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
