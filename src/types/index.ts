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
  /** Zona corta para mostrar ("Av. España", "Edificio C · Piso 1") */
  zone?: string;
  /** Cómo reconocer el lugar al llegar (puertas, texturas, braille...). Simulado. */
  arrivalCue?: string;
}

/** Hito táctil/visual en una arista; `side` es relativo al sentido from -> to. */
export interface EdgeCue {
  at: 'start' | 'mid' | 'end';
  side?: 'left' | 'right' | 'ahead';
  text: string;
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
  cues?: EdgeCue[];
  /** Ancho libre de la puerta/paso en cm */
  widthCm?: number;
  /** Rebaje de solera presente (false = solera sin rebaje) */
  curbCut?: boolean;
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

export type ElevatorState = 'ok' | 'down' | 'unconfirmed';

export interface Elevator {
  id: string;
  building: string;
  floors: number[];
  status: ElevatorState;
  lastUpdate: string;
  /** Personas que lo usan por día (simulado) */
  dailyUsers?: number;
  /** Fuente oficial simulada, si la hay */
  officialSource?: string;
  /** 'comunidad' o la fuente oficial (se deriva en el contexto) */
  source?: string;
  /** Texto de frescura ("Reportado hace 12 min"), derivado */
  freshness?: string;
  incidentId?: string;
  reportedAt?: string;
  lastConfirmedAt?: string;
  confirmations?: number;
  denials?: number;
  /** Medidas interiores de la cabina en cm */
  cabinCm?: { widthCm: number; depthCm: number };
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
  confirmations: number;
  denials: number;
  lastConfirmedAt?: string;
  status: 'active' | 'resolved';
  resolvedAt?: string;
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
  /** % de los metros de la ruta que van bajo techo (0-100) */
  coveredPct: number;
  /** Metros a la intemperie */
  uncoveredM: number;
  /** Verificaciones de accesibilidad (solo silla de ruedas) */
  wheelchair?: WheelchairChecks;
}

export interface WheelchairChecks {
  /** Ancho mínimo de puerta anotado en la ruta (cm); undefined si no hay datos */
  minDoorCm?: number;
  curbCutsOk: boolean;
  /** Edificios de los ascensores usados (todos con cabina apta) */
  elevatorBuildings: string[];
  /** Ruta con acompañante: pendiente máxima que requiere ayuda (%) y metros */
  helpSlopePct?: number;
  helpSlopeM?: number;
  helpStreet?: string;
}

/** Por qué no hay ruta autónoma en silla de ruedas */
export interface NoRouteDiagnosis {
  kind: 'slope' | 'cabin' | 'other';
  street?: string;
  slopePct?: number;
  meters?: number;
  elevatorBuilding?: string;
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
  elevator?: { id: string; x: number };
  stairs: { x: number };
  entrances: BuildingEntrance[];
}

/** Punto [x, y] en % del plano (0-100) */
export type MapPoint = [number, number];

export interface MapBuilding {
  id: string;
  name: string;
  polygon: MapPoint[];
  holes?: MapPoint[][];
  labelAt: MapPoint;
}

export type MapAreaKind = 'patio' | 'green' | 'court' | 'street' | 'plaza';

export interface MapArea {
  id: string;
  name: string;
  kind: MapAreaKind;
  polygon: MapPoint[];
  labelAt?: MapPoint;
}

export interface CampusMap {
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  buildings: MapBuilding[];
  areas: MapArea[];
}

export type RoomKind = 'room' | 'lab' | 'wc' | 'elevator' | 'stairs' | 'service';

export interface Room {
  id: string;
  name: string;
  polygon: MapPoint[];
  kind: RoomKind;
}

export interface FloorPlan {
  rooms: Room[];
  corridors: MapPoint[][];
}

export interface BuildingFloorPlans {
  levels: number[];
  floors: Record<string, FloorPlan>;
}

export type AmenityType = 'bench' | 'wc' | 'water' | 'shade' | 'rest-area';

export interface Amenity {
  id: string;
  type: AmenityType;
  name: string;
  /** Si está en un nodo del grafo; si no, usa x/y */
  nodeId?: string;
  /** Posición en % del plano (mismo sistema que nodes.json) */
  x?: number;
  y?: number;
  building?: string;
  floor?: number;
  accessible?: boolean;
  note: string;
}

export interface RouteAmenity {
  amenity: Amenity;
  /** Metros desde el inicio de la ruta */
  atM: number;
}
