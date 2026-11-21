export const colors = {
  bg: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F4',
  text: '#0F172A',
  textMuted: '#5F6368',
  border: '#E3E6EA',
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
  bg: '#F1F3F4',
  street: '#FFFFFF',
  streetEdge: '#C4C8CD',
  streetText: '#70757A',
  green: '#C8E6CC',
  patio: '#F8F1E7',
  court: '#CDE7D0',
  courtLine: '#FFFFFF',
  plaza: '#F8F1E7',
  building: '#DADCE0',
  buildingDim: '#E3E5E8',
  buildingActive: '#D2E3FC',
  buildingActiveEdge: '#1A73E8',
  buildingActiveExtrude: '#AECBFA',
  buildingActiveText: '#174EA6',
  buildingText: '#3C4043',
  extrude: '#B4B8BE',
  shadow: '#000000',
  outline: '#B9BDC3',
  room: '#FFFFFF',
  roomEdge: '#BDC1C6',
  roomActive: '#FEEFC3',
  roomActiveEdge: '#F9AB00',
  corridor: '#E8EAED',
  wc: '#E3F2FD',
  elevator: '#EDE7F6',
  stairs: '#FCE8E6',
  service: '#E8EAED',
  roomText: '#5F6368',
  halo: '#FFFFFF',
  route: '#1A73E8',
  routeEdge: '#185ABC',
  routeCasing: '#FFFFFF',
  routeDone: '#7BA3EB',
  routeDoneEdge: '#3F6FC4',
  position: '#1A73E8',
  positionHalo: 'rgba(26, 115, 232, 0.15)',
  pin: '#EA4335',
  pinDot: '#FFFFFF',
  barrier: '#F29900',
  barrierText: '#202124',
  stairsMark: '#5F6368',
  path: '#FFFFFF',
  pathEdge: '#C4C8CD',
  streetLine: '#DADCE0',
  tree: '#9CCFA0',
  door: '#7A5C2E',
  stairsHatch: '#B07A4A',
  rampChevron: '#188038',
  chip: '#FFFFFF',
  chipText: '#3C4043',
  chipActive: '#1A73E8',
  chipActiveText: '#FFFFFF',
};
export type MapColors = typeof mapColors;

export const mapHighContrast: MapColors = {
  bg: '#000000',
  street: '#141414',
  streetEdge: '#6B6B6B',
  streetText: '#FFFFFF',
  green: '#0F2A12',
  patio: '#1C1C1C',
  court: '#222222',
  courtLine: '#BDBDBD',
  plaza: '#1A1A1A',
  building: '#CFCFCF',
  buildingDim: '#555555',
  buildingActive: '#FFD400',
  buildingActiveEdge: '#FFFFFF',
  buildingActiveExtrude: '#8A7300',
  buildingActiveText: '#000000',
  buildingText: '#000000',
  extrude: '#8A8A8A',
  shadow: '#000000',
  outline: '#FFFFFF',
  room: '#E5E5E5',
  roomEdge: '#FFFFFF',
  roomActive: '#FFD400',
  roomActiveEdge: '#FFFFFF',
  corridor: '#000000',
  wc: '#8FD3FF',
  elevator: '#D8B4FE',
  stairs: '#FFB38A',
  service: '#9A9A9A',
  roomText: '#000000',
  halo: '#FFFFFF',
  route: '#FFD400',
  routeEdge: '#000000',
  routeCasing: '#000000',
  routeDone: '#8A7300',
  routeDoneEdge: '#000000',
  position: '#FFD400',
  positionHalo: 'rgba(255, 212, 0, 0.3)',
  pin: '#FF6B6B',
  pinDot: '#000000',
  barrier: '#FFB020',
  barrierText: '#000000',
  stairsMark: '#E5E5E5',
  path: '#3A3A3A',
  pathEdge: '#9A9A9A',
  streetLine: '#BDBDBD',
  tree: '#2F6B3A',
  door: '#FFD400',
  stairsHatch: '#FFB38A',
  rampChevron: '#4ADE80',
  chip: '#FFFFFF',
  chipText: '#000000',
  chipActive: '#FFD400',
  chipActiveText: '#000000',
};

export const largeTextScale = 1.25;

export type TypographyVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';
export type TypographyStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
};

export const typography: Record<TypographyVariant, TypographyStyle> = {
  display: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 26, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const iconSize = { sm: 20, md: 24, lg: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const minTouch = 52;

export const shadow = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 2,
} as const;

export const theme = { colors, map: mapColors, typography, spacing, radius, iconSize, minTouch, shadow, accessible: false };
export type AppTheme = Omit<typeof theme, 'colors' | 'map' | 'accessible'> & {
  colors: Colors;
  map: MapColors;
  accessible: boolean;
};
