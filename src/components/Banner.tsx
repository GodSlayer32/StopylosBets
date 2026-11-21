import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, minTouch, radius, spacing } from '@/constants/theme';

type Tone = 'warning' | 'danger' | 'info';
type Props = { tone?: Tone; text: string; onPress?: () => void };

const tones: Record<Tone, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'warning' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, icon: 'close-circle' },
  info: { bg: colors.primarySoft, fg: colors.primary, icon: 'information-circle' },
};

export function Banner({ tone = 'info', text, onPress }: Props) {
  const t = tones[tone];
  const content = (
    <>
      <Ionicons name={t.icon} size={24} color={t.fg} />
      <AppText variant="label" style={[styles.text, { color: colors.text }]}>
        {text}
      </AppText>
      {onPress ? <Ionicons name="chevron-forward" size={20} color={t.fg} /> : null}
    </>
  );
  const style = [styles.base, { backgroundColor: t.bg, borderColor: t.fg }];
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={text} style={style}>
        {content}
      </Pressable>
    );
  }
  return (
    <View accessibilityRole="alert" style={style}>
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
