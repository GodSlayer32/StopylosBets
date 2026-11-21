export type Profile = 'crutches' | 'wheelchair' | 'lowVision' | 'none';
export type EdgeType = 'flat' | 'ramp' | 'stairs' | 'elevator' | 'slope';
export type PlaceCategory =
  | 'sala' | 'biblioteca' | 'auditorio' | 'comida' | 'laboratorio'
  | 'servicio' | 'deporte' | 'salud' | 'estudio';

export interface Node {
  id: string;
  label: string;
  /** Posición en % del plano (0-100) */
  x: number;
  y: number;
  building?: string;
  floor?: number;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  distanceM: number;
  type: EdgeType;
  steps?: number;
  slopePct?: number;
  elevatorId?: string;
  covered?: boolean;
  name?: string;
}

export interface Place {
  id: string;
  name: string;
  nodeId: string;
  building?: string;
  floor: number;
  category: PlaceCategory;
  /** Nombre de MaterialCommunityIcons */
  icon: string;
}

export interface Elevator {
  id: string;
  building: string;
  floors: number[];
  status: 'ok' | 'down';
  lastUpdate: string;
}

export type IncidentType = 'blocked' | 'obstacle' | 'elevator' | 'slippery' | 'crowd';

export interface Incident {
  id: string;
  type: IncidentType;
  edgeId?: string;
  nodeId?: string;
  elevatorId?: string;
  description: string;
  reportedBy: string;
  minutesAgo: number;
  reportedAt: string;
  blocksRoute: boolean;
}

export interface ClassItem {
  id: string;
  course: string;
  professor: string;
  start: string;
  end: string;
  placeId: string;
}

export interface RouteStep {
  text: string;
  type: EdgeType;
  /** Nombre de MaterialCommunityIcons */
  icon: string;
  distanceM: number;
  fromNodeId: string;
  toNodeId: string;
  edgeIds: string[];
}

export interface AvoidedItem {
  text: string;
  reason: string;
  kind?: 'stairs' | 'slope' | 'incident';
  steps?: number;
  name?: string;
  edgeId?: string;
}

export interface RouteResult {
  profile: Profile;
  placeId: string;
  steps: RouteStep[];
  distanceM: number;
  minutes: number;
  /** Escalones que hay que subir/bajar en esta ruta */
  stairsCount: number;
  /** Escalones de la ruta más corta que esta ruta evita */
  stepsAvoided: number;
  avoided: AvoidedItem[];
  polyline: { x: number; y: number }[];
  nodeIds: string[];
  edgeIds: string[];
  usesElevator: boolean;
}

export interface RouteComparison {
  route: RouteResult;
  shortest: RouteResult;
  extraMeters: number;
  extraMinutes: number;
  stepsAvoided: number;
}

export interface BuildingFloor {
  level: number;
  label: string;
  rooms: string[];
}

export interface BuildingEntrance {
  level: number;
  side: 'left' | 'right';
  label: string;
}

export interface Building {
  id: string;
  name: string;
  /** Ordenados de abajo hacia arriba */
  floors: BuildingFloor[];
  elevator: { id: string; x: number };
  stairs: { x: number };
  entrances: BuildingEntrance[];
}
