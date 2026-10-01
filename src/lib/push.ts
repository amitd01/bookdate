/** Expo push notifications: token registration + tap-to-open-chat routing. */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { savePushToken } from './api';

// Show banners while the app is open (except we don't need badges).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

/** Requests permission (once) and stores the Expo push token on the profile. */
export async function registerForPush() {
  if (!Device.isDevice) return; // simulators can't receive pushes
  // Android 8+ needs a channel before notifications can be shown.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Matches & messages', importance: Notifications.AndroidImportance.HIGH, lightColor: '#8C1C3A',
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  const status = existing === 'undetermined'
    ? (await Notifications.requestPermissionsAsync()).status
    : existing;
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return; // set by `eas init`
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await savePushToken(data);
}

/** Opens the chat referenced by a tapped notification. Returns an unsubscribe fn. */
export function routeNotificationTaps() {
  const open = (r: Notifications.NotificationResponse | null) => {
    const matchId = r?.notification.request.content.data?.matchId;
    if (typeof matchId === 'string') router.push({ pathname: '/chat/[id]', params: { id: matchId } });
  };
  open(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
