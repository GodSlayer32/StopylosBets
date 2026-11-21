import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, shadow, spacing } from '@/constants/theme';

type Props = ViewProps & { onPress?: () => void; accessibilityLabel?: string };

export function Card({ onPress, accessibilityLabel, style, children, ...rest }: Props) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View {...rest} accessibilityLabel={accessibilityLabel} style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow,
  },
  pressed: { opacity: 0.9 },
});
