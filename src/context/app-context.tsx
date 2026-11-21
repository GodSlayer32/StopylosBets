import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import incidentsJson from '../data/incidents.json';
import { BASE_ELEVATORS, compareWithShortest, findRoute } from '../lib/routing';
import type { Elevator, Incident, Profile, RouteComparison, RouteResult } from '../types';

export const DEFAULT_ORIGIN = 'acc_espana';
const LATENCY_MS = 400;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type NewIncident = Omit<Incident, 'id' | 'reportedAt' | 'minutesAgo' | 'blocksRoute'> & {
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
  incidents: Incident[];
  addIncident: (i: NewIncident) => Incident;
  elevators: Elevator[];
  /** Simula 400 ms de latencia. Resuelve null si no hay ruta. */
  getRoute: (destPlaceId: string) => Promise<RouteResult | null>;
  getComparison: (destPlaceId: string) => Promise<RouteComparison | null>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>('crutches');
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [incidents, setIncidents] = useState<Incident[]>(incidentsJson.incidents as Incident[]);
  const [elevators, setElevators] = useState<Elevator[]>(BASE_ELEVATORS);

  useEffect(() => {
    const downIds = incidents
      .filter((i) => i.type === 'elevator' && i.elevatorId)
      .map((i) => i.elevatorId!);
    if (!downIds.length) return;
    setElevators((prev) => {
      if (prev.every((e) => !downIds.includes(e.id) || e.status === 'down')) return prev;
      return prev.map((e) =>
        downIds.includes(e.id) && e.status !== 'down'
          ? { ...e, status: 'down', lastUpdate: new Date().toISOString() }
          : e,
      );
    });
  }, [incidents]);

  const addIncident = useCallback((i: NewIncident) => {
    const incident: Incident = {
      blocksRoute: i.type === 'blocked' || i.type === 'elevator',
      ...i,
      id: `inc-${Date.now()}`,
      reportedAt: new Date().toISOString(),
      minutesAgo: 0,
    };
    setIncidents((prev) => [incident, ...prev]);
    return incident;
  }, []);

  const getRoute = useCallback(
    async (destPlaceId: string) => {
      await wait(LATENCY_MS);
      return findRoute(origin, destPlaceId, profile, incidents, elevators);
    },
    [origin, profile, incidents, elevators],
  );

  const getComparison = useCallback(
    async (destPlaceId: string) => {
      await wait(LATENCY_MS);
      return compareWithShortest(origin, destPlaceId, profile, incidents, elevators);
    },
    [origin, profile, incidents, elevators],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      profile, setProfile, accessibleMode: profile === 'lowVision', origin, setOrigin,
      incidents, addIncident, elevators, getRoute, getComparison,
    }),
    [profile, origin, incidents, addIncident, elevators, getRoute, getComparison],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
}
