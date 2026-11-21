import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import incidentsJson from '../data/incidents.json';
import { BASE_ELEVATORS, compareWithShortest, explainNoRoute, findNearestReachable, findRoute, getPlace } from '../lib/routing';
import { buildTicket, detectElevatorCause, SUPPORT_TEAM } from '../lib/support-ticket';
import { NOW_ISO, STALE_HOURS, formatAgo, minutesSince } from '../lib/time';
import type {
  Elevator, Incident, NoRouteDiagnosis, PartialRoute, Profile, RouteComparison, RouteResult, SupportTicket,
} from '../types';

export const DEFAULT_ORIGIN = 'c_labs';
const LATENCY_MS = 400;
/** Demo: cuanto tarda el portal en asignar el ticket a alguien. */
const ASSIGN_MS = 3500;
/** Demo: el apoyo llega a este tiempo de haberse asignado. */
const ARRIVE_MS = 15000;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type NewIncident = Omit<
  Incident,
  'id' | 'reportedAt' | 'minutesAgo' | 'blocksRoute' | 'confirmations' | 'denials' | 'lastConfirmedAt' | 'status' | 'resolvedAt'
> & {
  blocksRoute?: boolean;
};

interface AppContextValue {
  profile: Profile;
  setProfile: (p: Profile) => void;
  /** true cuando el perfil es de baja visión (UI de alto contraste / letra grande) */
  accessibleMode: boolean;
  /** id de nodo de origen */
  origin: string;
  setOrigin: (nodeId: string) => void;
  /** Modo lluvia: la ruta prioriza tramos techados */
  raining: boolean;
  setRaining: (v: boolean) => void;
  /** Silla de ruedas con acompañante: acepta pendientes de hasta 10% */
  assisted: boolean;
  setAssisted: (v: boolean) => void;
  /** Motivo por el que una silla autónoma no tiene ruta (null si no aplica) */
  getNoRouteReason: (destPlaceId: string) => NoRouteDiagnosis | null;
  incidents: Incident[];
  addIncident: (i: NewIncident) => Incident;
  /** Con status ok | down | unconfirmed, fuente y frescura */
  elevators: Elevator[];
  /** Suma una confirmación a un incidente activo */
  confirmIncident: (id: string) => void;
  /** Suma un "ya funciona"; con suficientes votos lo marca resuelto. Devuelve true si se resolvió. */
  denyIncident: (id: string) => boolean;
  /** Simula 400 ms de latencia. Resuelve null si no hay ruta. */
  getRoute: (destPlaceId: string) => Promise<RouteResult | null>;
  getComparison: (destPlaceId: string) => Promise<RouteComparison | null>;
  /** Hasta donde se puede llegar cuando no hay ruta completa (null si no aplica) */
  getNearestReachable: (destPlaceId: string) => PartialRoute | null;
  /** Tickets de apoyo levantados en esta sesion */
  tickets: SupportTicket[];
  /**
   * Levanta el ticket de apoyo para un destino sin ruta. Es idempotente: el
   * mismo trayecto devuelve el ticket que ya existe en vez de duplicarlo.
   */
  openTicket: (destPlaceId: string, partial: PartialRoute) => SupportTicket | null;
  /** "Ya me ayudaron": cierra el ticket y fija el origen donde quedo la persona. Devuelve ese nodo. */
  resolveTicket: (ticketId: string) => string | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>('wheelchair');
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [raining, setRaining] = useState(false);
  const [assisted, setAssisted] = useState(false);
  const [allIncidents, setAllIncidents] = useState<Incident[]>(incidentsJson.incidents as Incident[]);
  const incidentsRef = useRef(allIncidents);
  useEffect(() => {
    incidentsRef.current = allIncidents;
  }, [allIncidents]);
  // Solo los activos (incluye los "sin confirmar"); con minutesAgo derivado del reloj simulado.
  const incidents = useMemo<Incident[]>(
    () =>
      allIncidents
        .filter((i) => i.status === 'active')
        .map((i) => ({ ...i, minutesAgo: minutesSince(i.reportedAt) })),
    [allIncidents],
  );
  const elevators = useMemo<Elevator[]>(
    () =>
      BASE_ELEVATORS.map((e) => {
        const inc = incidents.find((i) => i.type === 'elevator' && i.elevatorId === e.id);
        if (!inc) {
          const resolved = allIncidents.find((i) => i.elevatorId === e.id && i.status === 'resolved');
          const last = resolved?.resolvedAt ?? e.lastUpdate;
          return {
            ...e, status: 'ok' as const, source: 'comunidad', lastUpdate: last,
            freshness: resolved ? `Funciona · confirmado ${formatAgo(last)}` : `Sin reportes · revisado ${formatAgo(last)}`,
            confirmations: 0, denials: 0,
          };
        }
        const lastSeen = inc.lastConfirmedAt ?? inc.reportedAt;
        const stale = minutesSince(lastSeen) > STALE_HOURS * 60;
        return {
          ...e,
          status: stale ? ('unconfirmed' as const) : ('down' as const),
          source: e.officialSource ?? 'comunidad',
          freshness: `Reportado ${formatAgo(inc.reportedAt)}`,
          incidentId: inc.id, photoUri: inc.photoUri, reportedAt: inc.reportedAt, lastConfirmedAt: lastSeen,
          confirmations: inc.confirmations, denials: inc.denials,
        };
      }),
    [incidents, allIncidents],
  );
  // El ruteo evita ascensores caídos y también los "sin confirmar" (por seguridad).
  const routingElevators = useMemo<Elevator[]>(
    () => elevators.map((e) => (e.status === 'unconfirmed' ? { ...e, status: 'down' as const } : e)),
    [elevators],
  );

  const addIncident = useCallback((i: NewIncident) => {
    const incident: Incident = {
      blocksRoute: i.type === 'blocked' || i.type === 'elevator',
      ...i,
      id: `inc-${Date.now()}`,
      reportedAt: NOW_ISO,
      minutesAgo: 0,
      confirmations: 1,
      denials: 0,
      lastConfirmedAt: NOW_ISO,
      status: 'active',
    };
    setAllIncidents((prev) => [incident, ...prev]);
    return incident;
  }, []);

  const confirmIncident = useCallback((id: string) => {
    setAllIncidents((prev) =>
      prev.map((i) => (i.id === id && i.status === 'active' ? { ...i, confirmations: i.confirmations + 1, lastConfirmedAt: NOW_ISO } : i)),
    );
  }, []);

  const denyIncident = useCallback(
    (id: string) => {
      const inc = incidentsRef.current.find((i) => i.id === id && i.status === 'active');
      if (!inc) return false;
      const denials = inc.denials + 1;
      // Con 2+ negaciones y peso suficiente frente a las confirmaciones, se da por resuelto.
      const resolved = denials >= 2 && denials * 3 > inc.confirmations;
      setAllIncidents((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, denials, ...(resolved ? { status: 'resolved' as const, resolvedAt: NOW_ISO } : {}) } : i,
        ),
      );
      return resolved;
    },
    [],
  );

  const getRoute = useCallback(
    async (destPlaceId: string) => {
      await wait(LATENCY_MS);
      return findRoute(origin, destPlaceId, profile, incidents, routingElevators, raining, assisted);
    },
    [origin, profile, incidents, routingElevators, raining, assisted],
  );

  const getComparison = useCallback(
    async (destPlaceId: string) => {
      await wait(LATENCY_MS);
      return compareWithShortest(origin, destPlaceId, profile, incidents, routingElevators, raining, assisted);
    },
    [origin, profile, incidents, routingElevators, raining, assisted],
  );

  const getNoRouteReason = useCallback(
    (destPlaceId: string) => explainNoRoute(origin, destPlaceId, profile, incidents, routingElevators, raining, assisted),
    [origin, profile, incidents, routingElevators, raining, assisted],
  );

  const getNearestReachable = useCallback(
    (destPlaceId: string) =>
      findNearestReachable(origin, destPlaceId, profile, incidents, routingElevators, raining, assisted),
    [origin, profile, incidents, routingElevators, raining, assisted],
  );

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const ticketsRef = useRef(tickets);
  useEffect(() => { ticketsRef.current = tickets; }, [tickets]);
  const assignTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { assignTimers.current.forEach(clearTimeout); }, []);

  const openTicket = useCallback(
    (destPlaceId: string, partial: PartialRoute) => {
      const place = getPlace(destPlaceId);
      if (!place) return null;
      const cause = detectElevatorCause(origin, place, partial, elevators);
      const nuevo = buildTicket(partial, place, profile, origin, NOW_ISO, cause);
      const mismoDestino = ticketsRef.current.filter((x) => x.placeId === place.id && x.profile === profile);
      // Un pedido de apoyo abierto sigue vigente aunque cambie el origen (p. ej. al llegar al punto alcanzable).
      const abierto = mismoDestino.find((x) => x.status !== 'resolved');
      if (abierto) return abierto;
      // Resuelto para este destino: no se reabre solo mientras el origen sea distinto.
      if (mismoDestino.some((x) => x.originNodeId !== origin)) return null;
      ticketsRef.current = [nuevo, ...ticketsRef.current.filter((x) => x.key !== nuevo.key)];
      setTickets(ticketsRef.current);
      // El portal responde: queda asignado a alguien de apoyo en terreno.
      assignTimers.current.push(
        setTimeout(() => {
          setTickets((prev) =>
            prev.map((x) => (x.id === nuevo.id && x.status === 'sent' ? { ...x, status: 'assigned' as const, assignee: SUPPORT_TEAM } : x)),
          );
        }, ASSIGN_MS),
        setTimeout(() => {
          setTickets((prev) =>
            prev.map((x) => (x.id === nuevo.id && x.status === 'assigned' ? { ...x, status: 'arrived' as const } : x)),
          );
        }, ASSIGN_MS + ARRIVE_MS),
      );
      return nuevo;
    },
    [origin, profile, elevators],
  );

  const resolveTicket = useCallback((ticketId: string) => {
    const t = ticketsRef.current.find((x) => x.id === ticketId);
    if (!t) return null;
    ticketsRef.current = ticketsRef.current.map((x) => (x.id === ticketId ? { ...x, status: 'resolved' as const } : x));
    setTickets(ticketsRef.current);
    setOrigin(t.resumeNodeId);
    return t.resumeNodeId;
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      profile, setProfile, accessibleMode: profile === 'lowVision', origin, setOrigin, raining, setRaining,
      assisted, setAssisted, getNoRouteReason, incidents, addIncident, elevators, confirmIncident, denyIncident, getRoute, getComparison,
      getNearestReachable, tickets, openTicket, resolveTicket,
    }),
    [profile, origin, raining, assisted, getNoRouteReason, incidents, addIncident, elevators, confirmIncident, denyIncident, getRoute, getComparison,
     getNearestReachable, tickets, openTicket, resolveTicket],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
}
