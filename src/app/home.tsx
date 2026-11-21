import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ScreenState } from '@/components/ScreenState';
import { radius, spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { getNode, getPlace, PLACES } from '@/lib/routing';
import scheduleJson from '@/data/schedule.json';
import type { Place, Profile } from '@/types';

const PROFILE_LABEL: Record<Profile, string> = {
  crutches: 'Muletas o lesión temporal',
  wheelchair: 'Silla de ruedas',
  lowVision: 'Baja visión',
  none: 'Sin necesidades especiales',
};

const ORIGINS = ['acc_espana', 'acc_placeres', 'acc_san_luis'];

type Quick = { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; match: (p: Place) => boolean };
const QUICK: Quick[] = [
  { id: 'banos', label: 'Baños accesibles', icon: 'accessibility', match: (p) => p.id.startsWith('bano') },
  { id: 'biblioteca', label: 'Biblioteca', icon: 'book', match: (p) => p.category === 'biblioteca' },
  { id: 'casino', label: 'Casino', icon: 'restaurant', match: (p) => p.category === 'comida' },
  { id: 'salud', label: 'Enfermería', icon: 'medkit', match: (p) => p.category === 'salud' },
  { id: 'estudio', label: 'Salas de estudio', icon: 'library', match: (p) => p.category === 'estudio' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]/g, '');
const placeSub = (p: Place) => `${p.building ? `Edif. ${p.building} · ` : ''}Piso ${p.floor}`;

export default function Home() {
  const router = useRouter();
  const { profile, origin, setOrigin, incidents, elevators } = useApp();
  const { colors, minTouch, typography } = useTheme();
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<string | null>(null);
  const [pickingOrigin, setPickingOrigin] = useState(false);

  const nextClass = scheduleJson.classes.find((c) => c.id === scheduleJson.nextClassId);
  const classPlace = nextClass ? getPlace(nextClass.placeId) : undefined;
  const firstName = scheduleJson.student.name.split(' ')[0];

  const downElevators = elevators.filter(
    (e) => e.status === 'down' && !incidents.some((i) => i.elevatorId === e.id),
  );
  const alerts = [
    ...incidents.map((i) => ({
      key: i.id,
      tone: (i.type === 'elevator' ? 'danger' : 'warning') as 'danger' | 'warning',
      text: i.description,
      detail: `${i.description}\n\nReportado por ${i.reportedBy} hace ${i.minutesAgo} min.${
        i.blocksRoute ? ' Este tramo queda fuera de tus rutas.' : ''
      }`,
    })),
    ...downElevators.map((e) => ({
      key: e.id,
      tone: 'danger' as const,
      text: `Ascensor del Edificio ${e.building} fuera de servicio`,
      detail: `Ascensor del Edificio ${e.building} fuera de servicio. Recalculamos tus rutas sin usarlo.`,
    })),
  ];

  const q = norm(query.trim());
  const active = q.length > 0 || quick !== null;
  const results = useMemo(() => {
    const qk = QUICK.find((x) => x.id === quick);
    return PLACES.filter((p) => {
      if (qk && !qk.match(p)) return false;
      if (!q) return true;
      return norm(p.name).includes(q) || norm(p.id).includes(q) || norm(`edif${p.building ?? ''}`).includes(q);
    });
  }, [q, quick]);

  const originLabel = getNode(origin)?.label ?? 'Acceso';
  const inputStyle = { color: colors.text, minHeight: minTouch, fontSize: typography.body.fontSize };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} scroll>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="display" accessibilityRole="header">
            Hola, {firstName}
          </AppText>
        </View>
      </View>
      <View style={styles.chips}>
        <Chip
          icon="person-circle"
          label={`Perfil: ${PROFILE_LABEL[profile]}`}
          onPress={() => router.replace('/')}
        />
      </View>

      {alerts.length > 0 ? (
        <View style={styles.gap}>
          <AppText variant="label" color="textMuted">
            {alerts.length === 1 ? '1 aviso activo en el campus' : `${alerts.length} avisos activos en el campus`}
          </AppText>
          {alerts.map((a) => (
            <Banner key={a.key} tone={a.tone} text={a.text} onPress={() => Alert.alert('Detalle del aviso', a.detail)} />
          ))}
        </View>
      ) : null}

      {nextClass && classPlace ? (
        <Card style={[styles.gap, { borderColor: colors.primary, borderWidth: 2 }]}>
          <AppText variant="label" color="primary">
            Tu próxima clase
          </AppText>
          <AppText variant="title">{nextClass.course}</AppText>
          <AppText color="textMuted">
            Sala {classPlace.name} · Edif. {classPlace.building} · {nextClass.start} a {nextClass.end}
          </AppText>
          <Button
            label="Llévame"
            icon="navigate"
            fullWidth
            accessibilityLabel={`Llévame a la sala ${classPlace.name}`}
            onPress={() => router.push(`/route/${classPlace.id}`)}
          />
        </Card>
      ) : null}

      <Pressable
        onPress={() => setPickingOrigin((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`Desde: ${originLabel}. Toca para cambiar el punto de partida`}
        accessibilityState={{ expanded: pickingOrigin }}
        style={[styles.row, styles.origin, { minHeight: minTouch }]}>
        <Ionicons name="location" size={22} color={colors.primary} />
        <AppText variant="label" style={styles.flex}>
          Desde: {originLabel}
        </AppText>
        <Ionicons name={pickingOrigin ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>
      {pickingOrigin ? (
        <View style={styles.chips}>
          {ORIGINS.map((id) => (
            <Chip
              key={id}
              label={getNode(id)?.label ?? id}
              selected={id === origin}
              onPress={() => {
                setOrigin(id);
                setPickingOrigin(false);
              }}
            />
          ))}
        </View>
      ) : null}

      <View
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, minHeight: minTouch }]}>
        <Ionicons name="search" size={22} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Busca sala, edificio o lugar"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Buscar destino por nombre, código o edificio"
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.input, inputStyle]}
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Borrar búsqueda"
            hitSlop={8}
            style={styles.clear}>
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chips}>
        {QUICK.map((c) => (
          <Chip
            key={c.id}
            icon={c.icon}
            label={c.label}
            selected={quick === c.id}
            onPress={() => setQuick(quick === c.id ? null : c.id)}
          />
        ))}
      </View>

      {active ? (
        results.length === 0 ? (
          <ScreenState
            variant="empty"
            title={`No encontramos '${query.trim()}'`}
            message="Prueba con el código de sala, ej. C-210"
          />
        ) : (
          <View style={styles.gap}>
            {results.map((p) => (
              <Card
                key={p.id}
                onPress={() => router.push(`/route/${p.id}`)}
                accessibilityLabel={`${p.name}, ${placeSub(p)}. Ver ruta`}
                style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
                  <MaterialCommunityIcons
                    name={p.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={26}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.flex}>
                  <AppText variant="heading">{p.name}</AppText>
                  <AppText variant="label" color="textMuted">
                    {placeSub(p)}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
              </Card>
            ))}
          </View>
        )
      ) : null}

      <Button
        label="Reportar barrera"
        variant="secondary"
        icon="flag"
        fullWidth
        onPress={() => router.push('/report')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  gap: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  origin: { paddingHorizontal: spacing.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  input: { flex: 1 },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
