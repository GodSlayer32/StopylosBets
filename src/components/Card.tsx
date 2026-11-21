import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { radius, shadow, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = ViewProps & { onPress?: () => void; accessibilityLabel?: string; accessibilityHint?: string };

export function Card({ onPress, accessibilityLabel, accessibilityHint, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  const themed = { backgroundColor: colors.surface, borderColor: colors.border };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [styles.card, themed, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View {...rest} accessible={accessibilityLabel ? true : rest.accessible} accessibilityLabel={accessibilityLabel} style={[styles.card, themed, style]}>
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
