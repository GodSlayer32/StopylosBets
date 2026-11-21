export const colors = {
  bg: '#F6F5F1',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F6',
  text: '#0F172A',
  textMuted: '#475569',
  border: '#D8DDE5',
  borderStrong: '#7A8499',
  switchTrackOff: '#7A8499',
  switchThumb: '#FFFFFF',
  primary: '#1747D1',
  primaryPressed: '#0F36A8',
  primaryText: '#FFFFFF',
  primarySoft: '#E3EAFD',
  warning: '#9A4504',
  warningSoft: '#FEF3C7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  success: '#116A33',
  successSoft: '#DCFCE7',
  overlay: 'rgba(15, 23, 42, 0.5)',
  overlaySurface: 'rgba(255, 255, 255, 0.86)',
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
  borderStrong: '#E5E5E5',
  switchTrackOff: '#5C5C5C',
  switchThumb: '#FFFFFF',
  primary: '#FFD400',
  primaryPressed: '#C9A600',
  primaryText: '#000000',
  primarySoft: '#2A2400',
  warning: '#FFB020',
  warningSoft: '#2B1D00',
  danger: '#FF6B6B',
  dangerSoft: '#2E0000',
  success: '#4ADE80',
  successSoft: '#002A10',
  overlay: 'rgba(0, 0, 0, 0.8)',
  overlaySurface: '#000000',
};

export const mapColors = {
  bg: '#F3EFE6',
  street: '#D3CCBC',
  green: '#CFE3B8',
  patio: '#EADFC4',
  court: '#D9C7B0',
  plaza: '#E8E1D0',
  building: '#B7B2A6',
  buildingDim: '#D6D2C8',
  buildingActive: '#1747D1',
  buildingText: '#2A2A2A',
  buildingActiveText: '#FFFFFF',
  outline: '#8C877B',
  room: '#F8F5EE',
  roomActive: '#F5A524',
  corridor: '#FFFFFF',
  wc: '#A9D3E8',
  elevator: '#C9B8E8',
  stairs: '#F0C7A8',
  service: '#D9D5CB',
  roomText: '#2A2A2A',
  halo: '#FFFFFF',
  route: '#1747D1',
  routeCasing: '#FFFFFF',
  routeDone: '#8FA6E6',
  position: '#1747D1',
  pin: '#D93025',
  barrier: '#B45309',
  stairsMark: '#475569',
  path: '#FBF9F3',
  pathEdge: '#CFC8B8',
  streetLine: '#FFFFFF',
  tree: '#8DB574',
  door: '#7A5C2E',
  stairsHatch: '#B07A4A',
  rampChevron: '#2E8B57',
};
export type MapColors = typeof mapColors;

export const mapHighContrast: MapColors = {
  bg: '#000000',
  street: '#141414',
  green: '#0F2A12',
  patio: '#1C1C1C',
  court: '#222222',
  plaza: '#1A1A1A',
  building: '#CFCFCF',
  buildingDim: '#555555',
  buildingActive: '#FFD400',
  buildingText: '#000000',
  buildingActiveText: '#000000',
  outline: '#FFFFFF',
  room: '#E5E5E5',
  roomActive: '#FFD400',
  corridor: '#000000',
  wc: '#8FD3FF',
  elevator: '#D8B4FE',
  stairs: '#FFB38A',
  service: '#9A9A9A',
  roomText: '#000000',
  halo: '#000000',
  route: '#FFD400',
  routeCasing: '#000000',
  routeDone: '#8A7300',
  position: '#FFD400',
  pin: '#FF6B6B',
  barrier: '#FFB020',
  stairsMark: '#E5E5E5',
  path: '#3A3A3A',
  pathEdge: '#9A9A9A',
  streetLine: '#BDBDBD',
  tree: '#2F6B3A',
  door: '#FFD400',
  stairsHatch: '#FFB38A',
  rampChevron: '#4ADE80',
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

export const iconSize = { sm: 20, md: 24, lg: 32 } as const;

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

export const minTouch = 52;

export const shadow = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
} as const;

export const theme = { colors, map: mapColors, typography, spacing, radius, iconSize, minTouch, shadow, accessible: false };
export type AppTheme = Omit<typeof theme, 'colors' | 'map' | 'accessible'> & {
  colors: Colors;
  map: MapColors;
  accessible: boolean;
};
