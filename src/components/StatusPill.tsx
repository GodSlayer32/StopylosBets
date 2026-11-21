import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Tone = 'success' | 'warning' | 'danger' | 'neutral';

const ICON: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  warning: 'alert-circle',
  danger: 'close-circle',
  neutral: 'time',
};

export function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  const { colors } = useTheme();
  const fg = tone === 'neutral' ? colors.textMuted : colors[tone];
  const bg = tone === 'neutral' ? colors.surfaceAlt : colors[`${tone}Soft` as 'successSoft'];
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: fg }]}>
      <Ionicons name={ICON[tone]} size={16} color={fg} />
      <AppText variant="caption" style={{ color: fg, fontWeight: '700' }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
