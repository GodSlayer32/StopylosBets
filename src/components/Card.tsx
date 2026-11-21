import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { radius, shadow, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = ViewProps & { onPress?: () => void; accessibilityLabel?: string; accessibilityHint?: string };

export function Card({ onPress, accessibilityLabel, accessibilityHint, style, children, ...rest }: Props) {
  const { colors, accessible } = useTheme();
  // Material: tarjeta blanca con elevación; el borde solo aparece en alto contraste.
  const themed = accessible
    ? { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 2 }
    : { backgroundColor: colors.surface, ...shadow };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        android_ripple={{ color: colors.primarySoft }}
        style={({ pressed }) => [styles.card, themed, pressed && { backgroundColor: colors.surfaceAlt }, style]}>
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
    padding: spacing.lg,
  },
});
