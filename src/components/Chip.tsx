import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { minTouch, radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  selected?: boolean;
  role?: 'button' | 'radio' | 'checkbox';
  checked?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function Chip({ label, selected, role = 'button', checked, onPress, icon, accessibilityLabel, accessibilityHint }: Props) {
  const { colors } = useTheme();
  const fg = selected ? colors.primaryText : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={role === 'button' ? { selected: !!selected } : { checked: checked ?? !!selected }}
      android_ripple={{ color: selected ? colors.primaryPressed : colors.primarySoft }}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: colors.borderStrong, backgroundColor: pressed ? colors.surfaceAlt : colors.surface },
        selected && { backgroundColor: pressed ? colors.primaryPressed : colors.primary, borderColor: colors.primary },
      ]}>
      {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
      <AppText variant="label" style={{ color: fg }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
