import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  variant: 'loading' | 'empty' | 'error';
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const defaults = {
  loading: { title: 'Cargando…', message: 'Un momento, estamos preparando todo.' },
  empty: { title: 'Nada por aquí', message: 'Todavía no hay información para mostrar.' },
  error: { title: 'Algo salió mal', message: 'No pudimos cargar esto. Intenta de nuevo.' },
};

export function ScreenState({ variant, title, message, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  const d = defaults[variant];
  const isError = variant === 'error';
  return (
    <View style={styles.wrap} accessibilityRole={isError ? 'alert' : undefined} accessibilityLiveRegion="polite">
      {variant === 'loading' ? (
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Cargando" />
      ) : (
        <View style={[styles.icon, { backgroundColor: isError ? colors.dangerSoft : colors.primarySoft }]}>
          <Ionicons
            name={isError ? 'alert-circle-outline' : 'search-outline'}
            size={36}
            color={isError ? colors.danger : colors.primary}
          />
        </View>
      )}
      <AppText variant="heading" accessibilityRole="header" style={styles.center}>
        {title ?? d.title}
      </AppText>
      <AppText color="textMuted" style={styles.center}>
        {message ?? d.message}
      </AppText>
      {onAction ? (
        <Button
          label={actionLabel ?? (isError ? 'Reintentar' : 'Entendido')}
          variant={isError ? 'primary' : 'secondary'}
          icon={isError ? 'refresh' : undefined}
          onPress={onAction}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
