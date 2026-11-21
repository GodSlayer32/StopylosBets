import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { minTouch, radius, spacing, type Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

type Palette = { bg: string; fg: string; border: string; pressedBg: string; ripple: string };
const makePalette = (colors: Colors): Record<Variant, Palette> => ({
  primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary, pressedBg: colors.primaryPressed, ripple: colors.primaryPressed },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary, pressedBg: colors.primarySoft, ripple: colors.primarySoft },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent', pressedBg: colors.primarySoft, ripple: colors.primarySoft },
  danger: { bg: colors.danger, fg: colors.primaryText, border: colors.danger, pressedBg: colors.danger, ripple: colors.dangerSoft },
});

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  fullWidth,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const { colors } = useTheme();
  const p = makePalette(colors)[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={() => {
        if (variant === 'primary') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      android_ripple={{ color: p.ripple }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? p.pressedBg : p.bg, borderColor: p.border },
        fullWidth && styles.full,
        pressed && variant === 'danger' && styles.pressed,
        inactive && styles.disabled,
      ]}>
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : icon ? (
          <Ionicons name={icon} size={22} color={p.fg} />
        ) : null}
        <AppText variant="label" style={[styles.label, { color: p.fg }]}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouch,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: 17 },
  full: { alignSelf: 'stretch' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
