export const colors = {
  bg: '#F6F5F1',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F6',
  text: '#0F172A',
  textMuted: '#475569',
  border: '#D8DDE5',
  primary: '#1747D1',
  primaryText: '#FFFFFF',
  primarySoft: '#E3EAFD',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  success: '#15803D',
  successSoft: '#DCFCE7',
  overlay: 'rgba(15, 23, 42, 0.5)',
};

export type ColorToken = keyof typeof colors;
export type Colors = Record<ColorToken, string>;

export const highContrast: Colors = {
  bg: '#000000',
  surface: '#000000',
  surfaceAlt: '#1A1A1A',
  text: '#FFFFFF',
  textMuted: '#E5E5E5',
  border: '#FFFFFF',
  primary: '#FFD400',
  primaryText: '#000000',
  primarySoft: '#2A2400',
  warning: '#FFB020',
  warningSoft: '#2B1D00',
  danger: '#FF6B6B',
  dangerSoft: '#2E0000',
  success: '#4ADE80',
  successSoft: '#002A10',
  overlay: 'rgba(0, 0, 0, 0.8)',
};

export const largeTextScale = 1.25;

export type TypographyVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';
export type TypographyStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
};

export const typography: Record<TypographyVariant, TypographyStyle> = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 26, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

export const minTouch = 52;

export const shadow = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
} as const;

export const theme = { colors, typography, spacing, radius, minTouch, shadow, accessible: false };
export type AppTheme = Omit<typeof theme, 'colors' | 'accessible'> & {
  colors: Colors;
  accessible: boolean;
};
