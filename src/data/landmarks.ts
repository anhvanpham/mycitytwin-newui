import records from './landmarks.json';
import { projectLonLat } from './project';
import { insidePolygon } from './replaces';
import { LOCAL_ORIGIN_WGS84 } from '../scene/frame';
import { groundElevationOf } from '../scene/massing';
import type { CityModel } from './model';

/** Supplied CBD landmark/address QA list, including its historical sites. */
export interface Landmark {
  id: string;
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  siteStatus: 'current' | 'historical';
  addressSource: string;
  reviewNote: string;
  aliases: string[];
  anchorEN: [number, number];
}

const [originE, originN] = projectLonLat(LOCAL_ORIGIN_WGS84.lon, LOCAL_ORIGIN_WGS84.lat);
export const LANDMARKS: Landmark[] = records.map(record => {
  const [east, north] = projectLonLat(record.longitude, record.latitude);
  return { ...record, siteStatus: record.siteStatus as Landmark['siteStatus'], anchorEN: [east - originE, north - originN] };
});
const BY_ID = new Map(LANDMARKS.map(landmark => [landmark.id, landmark]));
export const getLandmark = (id: string | null | undefined): Landmark | null => id ? BY_ID.get(id) ?? null : null;

/** Height is only for camera framing and pin clearance, never a building match. */
export function landmarkTarget(model: CityModel, landmark: Landmark) {
  const ground = groundElevationOf(model.buildings);
  const covering = model.buildings.filter(part => part.footprint.some(polygon => insidePolygon(landmark.anchorEN, polygon)));
  const topAhdM = Math.max(ground, ...covering.map(part => part.topAhdM));
  return { anchorEN: landmark.anchorEN, topAhdM, heightM: topAhdM - ground };
}
