import { Text, type TextProps } from 'react-native';

import { type ColorToken, type TypographyVariant } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextProps & { variant?: TypographyVariant; color?: ColorToken; tabular?: boolean };

export function AppText({ variant = 'body', color = 'text', tabular, style, ...rest }: Props) {
  const t = useTheme();
  return <Text maxFontSizeMultiplier={1.6} {...rest} style={[t.typography[variant], { color: t.colors[color] }, tabular && { fontVariant: ['tabular-nums'] }, style]} />;
}
