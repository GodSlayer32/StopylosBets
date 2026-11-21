import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { minTouch, radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function Chip({ label, selected, onPress, icon, accessibilityLabel, accessibilityHint }: Props) {
  const { colors } = useTheme();
  const fg = selected ? colors.primaryText : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: !!selected }}
      style={[
        styles.chip,
        { borderColor: colors.border, backgroundColor: colors.surface },
        selected && { backgroundColor: colors.primary, borderColor: colors.primary },
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
    borderWidth: 2,
  },
});
