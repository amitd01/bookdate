/**
 * Location is what makes a "book date" local: it is refreshed on every app
 * foreground and stored server-side rounded to ~100 m. Each reader picks a
 * match distance (profiles.max_km, at most 15 km or 10 miles).
 */
import * as Location from 'expo-location';

import { updateLocation } from './api';

export type LocationState = 'granted' | 'denied' | 'undetermined';

export async function getLocationPermission(): Promise<LocationState> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status as LocationState;
}

/** Asks for permission if needed, then uploads the current position. */
export async function syncLocation(ask = true): Promise<LocationState> {
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status === 'undetermined' && ask) ({ status } = await Location.requestForegroundPermissionsAsync());
  if (status !== 'granted') return status as LocationState;

  // Last known position is instant; fall back to a fresh (balanced) fix.
  const pos = (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }))
    ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  await updateLocation(pos.coords.latitude, pos.coords.longitude);
  return 'granted';
}
