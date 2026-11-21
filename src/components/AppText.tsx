import { Text, type TextProps } from 'react-native';

import { type ColorToken, type TypographyVariant } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextProps & { variant?: TypographyVariant; color?: ColorToken };

export function AppText({ variant = 'body', color = 'text', style, ...rest }: Props) {
  const t = useTheme();
  return <Text {...rest} style={[t.typography[variant], { color: t.colors[color] }, style]} />;
}
