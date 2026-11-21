import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Niveles del edificio; vacío = vista exterior */
  levels: number[];
  current: number;
  dest?: number;
  onSelect?: (level: number) => void;
};

const ROW = 36;

export function FloorRail({ levels, current, dest, onSelect }: Props) {
  const t = useTheme();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [current, pulse]);

  const box = [styles.rail, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.md, padding: t.spacing.xs }];

  if (levels.length === 0) {
    return (
      <View style={box} accessibilityLabel="Vista exterior">
        <View style={[styles.row, { width: ROW + 8, backgroundColor: t.colors.primary, borderRadius: t.radius.sm }]}>
          <Ionicons name="map-outline" size={18} color={t.colors.primaryText} />
          <AppText variant="caption" style={{ color: t.colors.primaryText, fontSize: 11, lineHeight: 14 }}>Exterior</AppText>
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
        const fg = active ? t.colors.primaryText : t.colors.text;
        return (
          <Pressable
            key={lv}
            disabled={!onSelect}
            onPress={() => onSelect?.(lv)}
            accessibilityRole="button"
            accessibilityLabel={`Piso ${lv}${active ? ', actual' : ''}${isDest ? ', destino' : ''}`}
            accessibilityState={{ selected: active }}
            style={[styles.row, { backgroundColor: active ? t.colors.primary : 'transparent', borderRadius: t.radius.sm }]}
          >
            {active ? (
              <Animated.View style={{ position: 'absolute', left: 3, top: 3, opacity: pulse }}>
                <MaterialCommunityIcons name="elevator-passenger" size={13} color={fg} />
              </Animated.View>
            ) : null}
            <AppText variant="label" style={{ color: fg, fontSize: 15, lineHeight: 20 }}>{lv}</AppText>
            {isDest ? (
              <Ionicons name="location" size={14} color={active ? t.colors.primaryText : t.colors.danger} style={styles.pin} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  row: { width: ROW, height: ROW, alignItems: 'center', justifyContent: 'center' },
  pin: { position: 'absolute', right: 3, bottom: 3 },
});
