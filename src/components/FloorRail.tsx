import { memo, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Niveles del edificio; vacío = vista exterior */
  levels: number[];
  current: number;
  dest?: number;
  onSelect?: (level: number) => void;
};

/** Fila visual 44 + hitSlop 4 por lado = 52 de área táctil */
const ROW = 44;
const HIT = 4;
const CHIP_RADIUS = 12;

function FloorRailBase({ levels, current, dest, onSelect }: Props) {
  const t = useTheme();
  const m = t.map;
  const reduceMotion = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [current, pulse, reduceMotion]);

  const box = [styles.rail, { backgroundColor: m.chip, shadowColor: m.shadow, borderRadius: CHIP_RADIUS, padding: t.spacing.xs }];

  if (levels.length === 0) {
    return (
      <View style={box} accessibilityLabel="Vista exterior">
        <View style={[styles.row, { width: ROW + t.spacing.sm, backgroundColor: m.chipActive, borderRadius: t.radius.sm }]}>
          <Ionicons name="map-outline" size={18} color={m.chipActiveText} />
          <AppText variant="caption" style={{ color: m.chipActiveText }}>Exterior</AppText>
        </View>
      </View>
    );
  }

  const sorted = [...levels].sort((a, b) => b - a);
  return (
    <View style={box} accessibilityRole="tablist">
      {sorted.map((lv) => {
        const active = lv === current;
        const isDest = dest === lv;
        const fg = active ? m.chipActiveText : m.chipText;
        return (
          <Pressable
            key={lv}
            disabled={!onSelect}
            hitSlop={HIT}
            onPress={() => onSelect?.(lv)}
            accessibilityRole="button"
            accessibilityLabel={`Piso ${lv}${active ? ', actual' : ''}${isDest ? ', destino' : ''}`}
            accessibilityState={{ selected: active }}
            style={[styles.row, { backgroundColor: active ? m.chipActive : 'transparent', borderRadius: t.radius.sm }]}
          >
            {active ? (
              <Animated.View style={{ position: 'absolute', left: 3, top: 3, opacity: pulse }}>
                <MaterialCommunityIcons name="elevator-passenger" size={13} color={fg} />
              </Animated.View>
            ) : null}
            <AppText variant="label" style={{ color: fg }}>{lv}</AppText>
            {isDest ? (
              <Ionicons name="location" size={14} color={active ? m.chipActiveText : m.pin} style={styles.pin} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    alignItems: 'center',
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  row: { width: ROW, height: ROW, alignItems: 'center', justifyContent: 'center' },
  pin: { position: 'absolute', right: 3, bottom: 3 },
});

export const FloorRail = memo(FloorRailBase);
