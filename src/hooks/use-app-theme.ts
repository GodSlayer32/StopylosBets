import {
  colors,
  highContrast,
  mapColors,
  mapHighContrast,
  largeTextScale,
  radius,
  shadow,
  spacing,
  minTouch,
  typography,
  type AppTheme,
  type TypographyVariant,
} from '@/constants/theme';

const scaledTypography = Object.fromEntries(
  Object.entries(typography).map(([k, v]) => [
    k,
    {
      ...v,
      fontSize: Math.round(v.fontSize * largeTextScale),
      lineHeight: Math.round(v.lineHeight * largeTextScale),
    },
  ]),
) as AppTheme['typography'];

export function useAppTheme(accessibleMode: boolean = false): AppTheme {
  return {
    colors: accessibleMode ? highContrast : colors,
    map: accessibleMode ? mapHighContrast : mapColors,
    typography: accessibleMode ? scaledTypography : typography,
    spacing,
    radius,
    minTouch,
    shadow,
    accessible: accessibleMode,
  };
}

export type { TypographyVariant };
