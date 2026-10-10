/**
 * Match distance. Readers choose 1–15 km or 1–10 miles; the database stores
 * kilometres (profiles.max_km, capped at 16.1 = 10 mi, see public.match_radius_m()).
 */
import { getLocales } from 'expo-localization';

export type DistanceUnit = 'km' | 'mi';

const KM_PER_MI = 1.609344;
export const DISTANCE_MAX: Record<DistanceUnit, number> = { km: 15, mi: 10 };

/** Miles where the device locale uses US or UK measures; kilometres everywhere else. */
export const defaultUnit = (): DistanceUnit => {
  const system = getLocales()[0]?.measurementSystem;
  return system === 'us' || system === 'uk' ? 'mi' : 'km';
};

/** Stored km → whole number in the reader's unit, for the slider. */
export const toUnit = (km: number, unit: DistanceUnit) =>
  Math.min(DISTANCE_MAX[unit], Math.max(1, Math.round(unit === 'mi' ? km / KM_PER_MI : km)));

/** Slider value in the reader's unit → km for storage (one decimal, as in the DB). */
export const toKm = (n: number, unit: DistanceUnit) => Math.round((unit === 'mi' ? n * KM_PER_MI : n) * 10) / 10;

export const formatDistance = (km: number, unit: DistanceUnit) => `${toUnit(km, unit)} ${unit === 'mi' ? 'mi' : 'km'}`;
