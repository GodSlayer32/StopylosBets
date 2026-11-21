import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { radius, shadow, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = ViewProps & { onPress?: () => void; accessibilityLabel?: string };

export function Card({ onPress, accessibilityLabel, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  const themed = { backgroundColor: colors.surface, borderColor: colors.border };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, themed, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View {...rest} accessibilityLabel={accessibilityLabel} style={[styles.card, themed, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadow,
  },
  pressed: { opacity: 0.9 },
});
