import buildingsData from '@/data/buildings.json';
import nodesData from '@/data/nodes.json';
import type { Building, Node } from '@/types';

const buildings = buildingsData.buildings as Building[];
const nodes = nodesData.nodes as Node[];

export function getBuilding(id: string): Building | undefined {
  return buildings.find((b) => b.id === id);
}

export function floorOfNode(nodeId: string): number | undefined {
  return nodes.find((n) => n.id === nodeId)?.floor;
}

export function buildingOfNode(nodeId: string): string | undefined {
  return nodes.find((n) => n.id === nodeId)?.building;
}

/** El destino está sobre el piso 1 de un edificio sin ascensor (no hay ruta posible sin escaleras). */
export function lacksElevatorAccess(place: { building?: string; floor?: number }): boolean {
  if (!place.building || (place.floor ?? 1) <= 1) return false;
  const b = getBuilding(place.building);
  return !!b && !b.elevator;
}
