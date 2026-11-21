import campusMapData from '../data/campus-map.json';
import floorplansData from '../data/floorplans.json';
import type {
  BuildingFloorPlans,
  CampusMap,
  FloorPlan,
  MapPoint,
} from '../types';

export const CAMPUS_MAP = campusMapData as unknown as CampusMap;
export const FLOORPLANS = (floorplansData as unknown as {
  buildings: Record<string, BuildingFloorPlans>;
}).buildings;

export function getFloorPlan(buildingId: string, level: number): FloorPlan | undefined {
  return FLOORPLANS[buildingId]?.floors[String(level)];
}

export function getBuildingPolygon(id: string): MapPoint[] | undefined {
  return CAMPUS_MAP.buildings.find((b) => b.id === id)?.polygon;
}

export function bboxOf(polygon: MapPoint[]) {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
