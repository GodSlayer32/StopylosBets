import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import incidentsJson from '../data/incidents.json';
import { BASE_ELEVATORS, compareWithShortest, findRoute } from '../lib/routing';
import { NOW_ISO, STALE_HOURS, formatAgo, minutesSince } from '../lib/time';
import type { Elevator, Incident, Profile, RouteComparison, RouteResult } from '../types';

export const DEFAULT_ORIGIN = 'acc_espana';
const LATENCY_MS = 400;
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
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>('crutches');
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [raining, setRaining] = useState(false);
  const [allIncidents, setAllIncidents] = useState<Incident[]>(incidentsJson.incidents as Incident[]);
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
          incidentId: inc.id, reportedAt: inc.reportedAt, lastConfirmedAt: lastSeen,
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
      const inc = allIncidents.find((i) => i.id === id && i.status === 'active');
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
    [allIncidents],
  );

  const getRoute = useCallback(
    async (destPlaceId: string) => {
      await wait(LATENCY_MS);
      return findRoute(origin, destPlaceId, profile, incidents, routingElevators, raining);
    },
    [origin, profile, incidents, routingElevators, raining],
  );

  const getComparison = useCallback(
    async (destPlaceId: string) => {
      await wait(LATENCY_MS);
      return compareWithShortest(origin, destPlaceId, profile, incidents, routingElevators, raining);
    },
    [origin, profile, incidents, routingElevators, raining],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      profile, setProfile, accessibleMode: profile === 'lowVision', origin, setOrigin, raining, setRaining,
      incidents, addIncident, elevators, confirmIncident, denyIncident, getRoute, getComparison,
    }),
    [profile, origin, raining, incidents, addIncident, elevators, confirmIncident, denyIncident, getRoute, getComparison],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
}
