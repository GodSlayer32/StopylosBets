import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getBuilding } from '@/lib/buildings';

type Props = {
  buildingId: string;
  currentLevel: number;
  destLevel?: number;
  destLabel?: string;
  via?: 'elevator' | 'stairs' | null;
  elevatorDown?: boolean;
  stairsAvoided?: boolean;
  /** Posición horizontal 0-1 del usuario dentro del corte */
  position?: number;
  height: number;
};

const LABEL_W = 64;
const TITLE_H = 40;
const ICON = 22;
const DOT = 14;

export function BuildingSection({
  buildingId, currentLevel, destLevel, destLabel, via, elevatorDown, stairsAvoided, position, height,
}: Props) {
  const { colors } = useTheme();
  const building = getBuilding(buildingId);
  const [width, setWidth] = useState(0);
  const floors = building ? [...building.floors].reverse() : []; // arriba -> abajo
  const n = floors.length || 1;
  const bandH = Math.max(24, (height - TITLE_H) / n);
  const topOf = (level: number) => {
    const i = floors.findIndex((f) => f.level === level);
    return TITLE_H + (i < 0 ? n - 1 : i) * bandH;
  };
  const slabX = LABEL_W;
  const slabW = Math.max(0, width - LABEL_W - spacing.sm);
  const elevX = slabX + (building?.elevator.x ?? 0.8) * slabW;
  const stairX = slabX + (building?.stairs.x ?? 0.14) * slabW;

  const [dotY] = useState(() => new Animated.Value(0));
  const [dotX] = useState(() => new Animated.Value(0));
  const first = useRef(true);
  const cy = (level: number) => topOf(level) + bandH / 2;
  const targetX = via === 'elevator' ? elevX : slabX + (position ?? 0.5) * slabW;
  const prevLevel = useRef(currentLevel);

  useEffect(() => {
    if (!width || !building) return;
    if (first.current) {
      first.current = false;
      dotY.setValue(cy(currentLevel));
      dotX.setValue(targetX);
      prevLevel.current = currentLevel;
      return;
    }
    const changed = prevLevel.current !== currentLevel;
    prevLevel.current = currentLevel;
    const opts = { duration: 800, easing: Easing.inOut(Easing.cubic), useNativeDriver: false };
    if (changed && via === 'elevator') {
      Animated.sequence([
        Animated.timing(dotX, { toValue: elevX, ...opts, duration: 250 }),
        Animated.timing(dotY, { toValue: cy(currentLevel), ...opts }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(dotY, { toValue: cy(currentLevel), ...opts, duration: changed ? 800 : 400 }),
        Animated.timing(dotX, { toValue: targetX, ...opts, duration: 400 }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, currentLevel, via, position, height]);

  if (!building) return null;

  const dest = destLevel != null ? building.floors.find((f) => f.level === destLevel) : undefined;
  const destName = destLabel ?? '';
  const hasChange = destLevel != null && destLevel !== currentLevel;
  const cur = building.floors.find((f) => f.level === currentLevel);
  const side = building.elevator.x >= 0.5 ? 'derecha' : 'izquierda';
  const viaText =
    via === 'elevator'
      ? ` Usa el ascensor a la ${side}.`
      : via === 'stairs'
        ? ` Usa la escalera a la ${side === 'derecha' ? 'izquierda' : 'derecha'}.`
        : '';
  const a11y =
    `Estás en el ${(cur?.label ?? `piso ${currentLevel}`).toLowerCase()} del ${building.name}.` +
    (dest
      ? hasChange
        ? ` Tu destino${destName ? `, ${destName},` : ''} está en el ${dest.label.toLowerCase()}.${viaText}`
        : ` Tu destino${destName ? `, ${destName},` : ''} está en este mismo piso.`
      : '');

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const elevColor = elevatorDown ? colors.danger : colors.text;
  const stairColor = colors.textMuted;

  return (
    <View
      style={[styles.wrap, { height, backgroundColor: colors.surface, borderColor: colors.border }]}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11y}>
      <View style={styles.header}>
        <AppText variant="label" numberOfLines={1} style={styles.title}>{building.name}</AppText>
        {dest && hasChange ? (
          <View style={[styles.chip, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
            <AppText variant="caption" style={{ color: colors.text }}>
              {cur?.label ?? `Piso ${currentLevel}`} → {dest.label}
            </AppText>
          </View>
        ) : null}
      </View>

      {width > 0 ? (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            {floors.map((f) => {
              const y = topOf(f.level);
              const isCur = f.level === currentLevel;
              return (
                <Rect
                  key={f.level}
                  x={slabX}
                  y={y + 2}
                  width={slabW}
                  height={bandH - 4}
                  rx={radius.sm / 2}
                  fill={isCur ? colors.primarySoft : colors.surfaceAlt}
                  stroke={isCur ? colors.primary : colors.border}
                  strokeWidth={isCur ? 2 : 1}
                />
              );
            })}
            {/* Columnas */}
            <Line x1={elevX} x2={elevX} y1={TITLE_H + 2} y2={TITLE_H + n * bandH - 2}
              stroke={elevatorDown ? colors.danger : colors.border} strokeWidth={2}
              strokeDasharray={elevatorDown ? '4,4' : undefined} />
            <Line x1={stairX} x2={stairX} y1={TITLE_H + 2} y2={TITLE_H + n * bandH - 2}
              stroke={colors.border} strokeWidth={2} strokeDasharray={stairsAvoided ? '4,4' : undefined} />
          </Svg>

          {floors.map((f) => {
            const y = topOf(f.level);
            const isDest = dest?.level === f.level;
            return (
              <View key={f.level}>
                <View style={[styles.floorLabel, { top: y, height: bandH, width: LABEL_W - spacing.sm }]}>
                  <AppText variant="caption" numberOfLines={1}
                    style={{ color: f.level === currentLevel ? colors.text : colors.textMuted, fontWeight: '700' }}>
                    {f.label}
                  </AppText>
                </View>
                {isDest ? (
                  <View style={[styles.destRow, { top: y, height: bandH, left: slabX + spacing.sm + ICON + 4 }]}>
                    <MaterialCommunityIcons name="map-marker" size={ICON} color={colors.danger}
                      style={styles.pinOffset} />
                    <AppText variant="caption" numberOfLines={1}
                      style={{ color: colors.text, fontWeight: '700', maxWidth: Math.max(40, slabW * 0.5) }}>
                      {destName || f.rooms[0]}
                    </AppText>
                  </View>
                ) : null}
              </View>
            );
          })}

          <View pointerEvents="none" style={[styles.iconAt, { left: elevX - ICON / 2, top: 6 }]}>
            <MaterialCommunityIcons name="elevator" size={ICON} color={elevColor} />
            {elevatorDown ? <View style={[styles.strike, { backgroundColor: colors.danger }]} /> : null}
          </View>
          <View pointerEvents="none" style={[styles.iconAt, { left: stairX - ICON / 2, top: 6 }]}>
            <MaterialCommunityIcons name="stairs" size={ICON} color={stairColor}
              style={stairsAvoided ? styles.dim : undefined} />
            {stairsAvoided ? <View style={[styles.strike, { backgroundColor: colors.danger }]} /> : null}
          </View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.dotHalo,
              { backgroundColor: colors.primary },
              { transform: [{ translateX: Animated.subtract(dotX, DOT) }, { translateY: Animated.subtract(dotY, DOT) }] },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dot,
              { backgroundColor: colors.primary, borderColor: colors.surface },
              { transform: [{ translateX: Animated.subtract(dotX, DOT / 2) }, { translateY: Animated.subtract(dotY, DOT / 2) }] },
            ]}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  header: {
    height: TITLE_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, gap: spacing.sm,
  },
  title: { flexShrink: 1 },
  chip: {
    borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  floorLabel: { position: 'absolute', left: spacing.sm, justifyContent: 'center' },
  destRow: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 2 },
  pinOffset: { marginLeft: -ICON },
  iconAt: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: ICON, height: ICON },
  strike: { position: 'absolute', width: ICON + 4, height: 2, transform: [{ rotate: '-45deg' }] },
  dim: { opacity: 0.5 },
  dot: {
    position: 'absolute', left: 0, top: 0, width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2,
  },
  dotHalo: {
    position: 'absolute', left: 0, top: 0, width: DOT * 2, height: DOT * 2, borderRadius: DOT,
    opacity: 0.25,
  },
});
