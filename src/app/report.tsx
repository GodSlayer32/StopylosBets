import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { useApp } from '@/context/app-context';
import { thumbSize } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { EDGES, PLACES, getNode } from '@/lib/routing';
import { formatAgo, formatConfirmations } from '@/lib/time';
import type { IncidentType } from '@/types';

type Kind = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; type: IncidentType };
const KINDS: Kind[] = [
  { key: 'elevator', label: 'Ascensor fuera de servicio', icon: 'swap-vertical', type: 'elevator' },
  { key: 'ramp', label: 'Rampa bloqueada', icon: 'trending-up', type: 'blocked' },
  { key: 'works', label: 'Obra / desvío', icon: 'construct', type: 'obstacle' },
  { key: 'slippery', label: 'Piso resbaloso', icon: 'water', type: 'slippery' },
  { key: 'other', label: 'Otro', icon: 'ellipsis-horizontal', type: 'crowd' },
];
const REPORTER = 'Camila';
const SEND_MS = 600;

export default function Report() {
  const router = useRouter();
  const params = useLocalSearchParams<{ edgeIds?: string }>();
  const { elevators, addIncident, confirmIncident, accessibleMode, origin } = useApp();
  const t = useAppTheme(accessibleMode);
  const styles = useMemo(() => makeStyles(t), [t]);

  const routeEdges = useMemo(
    () =>
      (params.edgeIds ? params.edgeIds.split(',') : [])
        .map((id) => EDGES.find((e) => e.id === id))
        .filter((e): e is NonNullable<typeof e> => !!e && e.type !== 'elevator'),
    [params.edgeIds],
  );
  const routeElevatorId = useMemo(
    () => (params.edgeIds ? params.edgeIds.split(',') : []).map((id) => EDGES.find((e) => e.id === id)?.elevatorId).find(Boolean),
    [params.edgeIds],
  );

  const [kind, setKind] = useState<string | null>(null);
  const [elevatorId, setElevatorId] = useState<string | undefined>(routeElevatorId);
  const [edgeId, setEdgeId] = useState<string | undefined>();
  const [nodeId, setNodeId] = useState<string | undefined>();
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'form' | 'sending' | 'done'>('form');
  const [wasConfirm, setWasConfirm] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const selected = KINDS.find((k) => k.key === kind);
  const isElevator = selected?.type === 'elevator';
  const pickedElevator = isElevator ? elevators.find((e) => e.id === elevatorId) : undefined;
  const alreadyReported = !!pickedElevator && pickedElevator.status !== 'ok' && !!pickedElevator.incidentId;

  const selectKind = (k: Kind) => {
    setKind(k.key);
    if (k.type === 'elevator' && !elevatorId) {
      const b = getNode(origin)?.building;
      const near = b ? elevators.find((e) => e.building === b) : undefined;
      if (near) setElevatorId(near.id);
    }
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    setPhotoError(null);
    try {
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setPhotoError(
          source === 'camera'
            ? 'No tenemos permiso para usar la cámara. Puedes activarlo en Ajustes o elegir una foto de la galería.'
            : 'No tenemos permiso para ver tus fotos. Puedes activarlo en Ajustes o tomar una foto.',
        );
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, allowsEditing: false };
      const res = source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled && res.assets[0]?.uri) setPhotoUri(res.assets[0].uri);
    } catch {
      setPhotoError('No pudimos abrir la cámara o la galería en este dispositivo. Puedes enviar el reporte sin foto.');
    }
  };

  const submit = () => {
    if (!selected) return;
    setPhase('sending');
    setWasConfirm(alreadyReported);
    timer.current = setTimeout(() => {
      if (alreadyReported && pickedElevator?.incidentId) {
        confirmIncident(pickedElevator.incidentId);
      } else addIncident({
        type: selected.type,
        description: description.trim() || selected.label,
        reportedBy: REPORTER,
        ...(photoUri ? { photoUri } : {}),
        ...(isElevator ? { elevatorId } : { edgeId, nodeId }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPhase('done');
      timer.current = setTimeout(() => router.back(), 1400);
    }, SEND_MS);
  };

  if (phase === 'done') {
    return (
      <Screen contentStyle={styles.center}>
        <View style={styles.check} accessibilityElementsHidden>
          <Ionicons name="checkmark" size={56} color={t.colors.success} />
        </View>
        <AppText variant="title" style={styles.centerText} accessibilityRole="alert">
          {wasConfirm ? '¡Gracias! Tu confirmación hace más confiable el estado del ascensor' : '¡Gracias! Ya avisamos a quienes pasan por aquí'}
        </AppText>
        {photoUri && !wasConfirm ? (
          <Image source={{ uri: photoUri }} style={styles.donePhoto} accessibilityRole="image" accessibilityLabel="Foto adjunta a tu reporte" />
        ) : null}
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <Screen scroll>
      <AppText variant="title" accessibilityRole="header">¿Qué barrera encontraste?</AppText>

      <View style={styles.wrap} accessibilityRole="radiogroup">
        {KINDS.map((k) => (
          <Chip key={k.key} label={k.label} icon={k.icon} selected={kind === k.key} role="radio" checked={kind === k.key} onPress={() => selectKind(k)} />
        ))}
      </View>

      {selected ? (
        <View style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {isElevator ? '¿Cuál ascensor?' : routeEdges.length ? '¿En qué tramo?' : '¿Dónde está?'}
          </AppText>
          <View style={styles.wrap} accessibilityRole="radiogroup">
            {isElevator
              ? elevators.map((e) => (
                    <Chip key={e.id} label={e.status !== 'ok' ? `Edif. ${e.building} · reportado` : `Edif. ${e.building}`} icon={e.status !== 'ok' ? 'checkmark-circle' : 'business'} selected={elevatorId === e.id} role="radio" checked={elevatorId === e.id} onPress={() => setElevatorId(e.id)} accessibilityLabel={e.status !== 'ok' ? `Ascensor del edificio ${e.building}, ya reportado ${formatAgo(e.reportedAt ?? '')}, ${formatConfirmations(e.confirmations ?? 0)}` : `Ascensor del edificio ${e.building}`} />
                ))
              : routeEdges.length
                ? routeEdges.map((e) => (
                    <Chip
                      key={e.id}
                      label={e.name ?? `${getNode(e.from)?.label ?? ''} → ${getNode(e.to)?.label ?? ''}`}
                      selected={edgeId === e.id}
                      role="radio"
                      checked={edgeId === e.id}
                      onPress={() => { setEdgeId(e.id); setNodeId(undefined); }}
                    />
                  ))
                : PLACES.slice(0, 8).map((p) => (
                    <Chip
                      key={p.id}
                      label={p.name}
                      selected={nodeId === p.nodeId}
                      role="radio"
                      checked={nodeId === p.nodeId}
                      onPress={() => { setNodeId(p.nodeId); setEdgeId(undefined); }}
                    />
                  ))}
          </View>
        </View>
      ) : null}

      {selected && !alreadyReported ? (
        <View style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">Foto (opcional, ayuda a confirmar)</AppText>
          {photoUri ? (
            <View style={styles.photoRow}>
              <Image source={{ uri: photoUri }} style={styles.thumb} accessibilityRole="image" accessibilityLabel="Vista previa de la foto adjunta" />
              <Button label="Quitar foto" icon="trash" variant="secondary" onPress={() => setPhotoUri(undefined)} accessibilityLabel="Quitar foto adjunta" />
            </View>
          ) : (
            <View style={styles.wrap}>
              <Button label="Tomar foto" icon="camera" variant="secondary" onPress={() => pickPhoto('camera')} accessibilityHint="Abre la cámara para fotografiar la barrera" />
              <Button label="Elegir de la galería" icon="images" variant="secondary" onPress={() => pickPhoto('library')} accessibilityHint="Abre tu galería de fotos" />
            </View>
          )}
          {photoError ? <AppText variant="caption" style={styles.photoError} accessibilityRole="alert">{photoError}</AppText> : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">Detalles (opcional)</AppText>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Ej: La rampa está cubierta de materiales de la obra"
          placeholderTextColor={t.colors.textMuted}
          multiline
          accessibilityLabel="Descripción de la barrera, opcional"
          style={styles.input}
        />
        <AppText variant="caption" color="textMuted">Reportado por {REPORTER}</AppText>
      </View>

      <Button
        label={alreadyReported ? 'Confirmar que sigue caído' : 'Enviar reporte'}
        icon={alreadyReported ? 'checkmark-done' : 'send'}
        fullWidth
        disabled={!selected || (isElevator && !elevatorId)}
        loading={phase === 'sending'}
        onPress={submit}
      />
      {!selected ? <AppText variant="caption" color="textMuted" style={styles.centerText}>Elige un tipo de barrera para continuar</AppText> : null}
    </Screen>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    section: { gap: t.spacing.md },
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    thumb: { width: thumbSize, height: thumbSize, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border },
    donePhoto: { width: thumbSize * 2, height: thumbSize * 2, borderRadius: t.radius.md, marginTop: t.spacing.lg },
    photoError: { color: t.colors.danger },
    done: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surfaceAlt,
      opacity: 0.8,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    centerText: { textAlign: 'center' },
    check: {
      width: 104,
      height: 104,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.successSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      minHeight: 96,
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surface,
      color: t.colors.text,
      textAlignVertical: 'top',
      ...t.typography.body,
    },
  });
