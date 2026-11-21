import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { minTouch, radius, spacing, type Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Tone = 'warning' | 'danger' | 'info';
type Props = { tone?: Tone; text: string; onPress?: () => void };

const icons: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  warning: 'warning',
  danger: 'close-circle',
  info: 'information-circle',
};
const toneColors = (c: Colors): Record<Tone, { bg: string; fg: string }> => ({
  warning: { bg: c.warningSoft, fg: c.warning },
  danger: { bg: c.dangerSoft, fg: c.danger },
  info: { bg: c.primarySoft, fg: c.primary },
});

export function Banner({ tone = 'info', text, onPress }: Props) {
  const { colors } = useTheme();
  const t = toneColors(colors)[tone];
  const content = (
    <>
      <Ionicons name={icons[tone]} size={24} color={t.fg} />
      <AppText variant="label" style={styles.text}>
        {text}
      </AppText>
      {onPress ? <Ionicons name="chevron-forward" size={20} color={t.fg} /> : null}
    </>
  );
  const style = [styles.base, { backgroundColor: t.bg, borderColor: t.fg }];
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={text} accessibilityHint="Toca para ver el detalle" style={style}>
        {content}
      </Pressable>
    );
  }
  return (
    <View accessible accessibilityRole="alert" accessibilityLabel={text} accessibilityLiveRegion="polite" style={style}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  text: { flex: 1 },
});
