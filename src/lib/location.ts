/**
 * Location is what makes a "book date" local: it is refreshed on every app
 * foreground and stored server-side rounded to ~100 m. Each reader picks a
 * match distance (profiles.max_km, at most 15 km or 10 miles).
 */
import * as Location from 'expo-location';

import { updateLocation } from './api';

export type LocationState = 'granted' | 'denied' | 'undetermined';

const FIX_TIMEOUT_MS = 15_000;

export async function getLocationPermission(): Promise<LocationState> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status as LocationState;
}

/** Asks for location permission (from an explainer screen, never cold). */
export async function requestLocationPermission(): Promise<LocationState> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status as LocationState;
}

/** Asks for permission if needed (and `ask`), then uploads the current position. */
export async function syncLocation(ask = true): Promise<LocationState> {
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status === 'undetermined' && ask) ({ status } = await Location.requestForegroundPermissionsAsync());
  if (status !== 'granted') return status as LocationState;

  // Last known position is instant; fall back to a fresh (balanced) fix. A fresh
  // fix can wait forever with no signal (or a simulator with no location set),
  // so give up after FIX_TIMEOUT_MS rather than leave callers hanging.
  const pos = (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }))
    ?? (await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('No location fix')), FIX_TIMEOUT_MS)),
    ]));
  await updateLocation(pos.coords.latitude, pos.coords.longitude);
  return 'granted';
}
