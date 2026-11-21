import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useApp } from '@/context/app-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/constants/theme';
import { meetTo } from '@/lib/meeting-point';
import type { PartialRoute, Place, SupportTicket } from '@/types';

type Props = {
  ticket: SupportTicket;
  partial: PartialRoute;
  place: Place;
  accessibleMode: boolean;
};

/**
 * El ticket ya levantado. No tiene botón de "enviar": cuando esta tarjeta
 * aparece, la solicitud ya salió. Lo que ofrece es seguimiento y el detalle
 * exacto de lo que se pidió en nombre de la persona.
 */
export function SupportTicketCard({ ticket, partial, place, accessibleMode }: Props) {
  const t = useAppTheme(accessibleMode);
  const styles = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const { resolveTicket } = useApp();
  const [openDetail, setOpenDetail] = useState(false);
  const llego = ticket.status === 'arrived';
  const asignado = ticket.status === 'assigned' || llego;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.icon, asignado && styles.iconOk]}>
          <MaterialCommunityIcons
            name={asignado ? 'account-check' : 'ticket-confirmation'}
            size={t.iconSize.md}
            color={asignado ? t.colors.success : t.colors.primary}
          />
        </View>
        <View style={styles.flex}>
          <AppText variant="heading">Pedimos ayuda por ti</AppText>
          <AppText variant="caption" color="textMuted">
            Ticket {ticket.id} · portal de atención USM
          </AppText>
        </View>
      </View>

      <View
        style={[styles.estado, asignado ? styles.estadoOk : styles.estadoEnvio]}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={
          llego
            ? `El apoyo llegó, te ayudan a ${ticket.supportVerb}`
            : asignado
            ? `Ticket asignado a ${ticket.assignee}, llega en unos ${ticket.etaMin} minutos`
            : 'Ticket enviado, esperando asignación'
        }
      >
        <Ionicons
          name={asignado ? 'checkmark-circle' : 'paper-plane'}
          size={t.iconSize.sm}
          color={asignado ? t.colors.success : t.colors.primary}
        />
        <AppText variant="caption" style={styles.flex} color={asignado ? 'success' : 'primary'}>
          {llego
            ? `El apoyo llegó · te ayudan a ${ticket.supportVerb}`
            : asignado
            ? `${ticket.assignee} va en camino · llega en ~${ticket.etaMin} min ${meetTo(ticket.reachedLabel)}`
            : 'Enviado · esperando asignación'}
        </AppText>
      </View>

      <AppText variant="caption" color="textMuted">
        {ticket.supportText
          ? `${ticket.supportText}.`
          : `Pedimos acompañamiento para los últimos ${ticket.remainingM} m hasta ${place.name}, desde ${ticket.reachedLabel}.`}
      </AppText>

      <Button
        label="Ya me ayudaron"
        icon="checkmark-circle"
        variant={llego ? 'primary' : 'secondary'}
        fullWidth
        accessibilityLabel="Ya me ayudaron: cerrar el ticket y continuar la ruta"
        onPress={() => {
          const resume = resolveTicket(ticket.id);
          if (!resume) return;
          router.replace((resume === place.nodeId ? '/home' : { pathname: '/route/[destId]', params: { destId: place.id, resumed: '1' } }) as Href);
        }}
      />

      <Pressable
        onPress={() => setOpenDetail((v) => !v)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: openDetail }}
        accessibilityLabel={openDetail ? 'Ocultar el detalle enviado' : 'Ver el detalle enviado'}
      >
        <AppText variant="caption" color="primary">
          {openDetail ? 'Ocultar el detalle enviado' : 'Ver el detalle enviado'}
        </AppText>
        <Ionicons name={openDetail ? 'chevron-up' : 'chevron-down'} size={t.iconSize.sm} color={t.colors.primary} />
      </Pressable>

      {openDetail ? (
        <View style={styles.detalle}>
          <AppText variant="caption" color="textMuted" style={styles.mono}>
            {ticket.detail}
          </AppText>
        </View>
      ) : null}

      <Pressable
        onPress={() => { Linking.openURL(ticket.portalUrl).catch(() => {}); }}
        style={styles.toggle}
        accessibilityRole="link"
        accessibilityLabel="Abrir el portal de atención USM en el navegador"
      >
        <Ionicons name="open-outline" size={t.iconSize.sm} color={t.colors.primary} />
        <AppText variant="caption" color="primary">Seguirlo en el portal USM</AppText>
      </Pressable>

      {partial.route.steps.length === 0 && !ticket.supportText ? (
        <AppText variant="caption" color="textMuted">
          Desde donde estás no se puede avanzar sola o solo: el apoyo llega hasta tu punto de partida.
        </AppText>
      ) : null}
    </Card>
  );
}

function makeStyles(t: AppTheme) {
  return StyleSheet.create({
    card: { gap: t.spacing.md, borderColor: t.colors.primary, borderWidth: 1.5 },
    head: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    flex: { flex: 1 },
    icon: {
      width: 44,
      height: 44,
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.primarySoft,
    },
    iconOk: { backgroundColor: t.colors.successSoft },
    estado: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      padding: t.spacing.md,
      borderRadius: t.radius.md,
    },
    estadoEnvio: { backgroundColor: t.colors.primarySoft },
    estadoOk: { backgroundColor: t.colors.successSoft },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: t.minTouch },
    detalle: {
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    mono: { fontVariant: ['tabular-nums'] },
  });
}
