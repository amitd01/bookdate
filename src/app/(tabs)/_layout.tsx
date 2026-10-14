/**
 * Main tabs (Discover · Book Dates · Profile). Mounted only for onboarded
 * users, so it also owns signed-in lifecycle work: refreshing location on
 * every foreground, saving the push token (when allowed), and routing
 * notification taps to chats. Book Dates shows an unread badge.
 * The tab bar is custom and platform-specific (components/TabBar.tsx);
 * screens draw their own titles, so there are no navigator headers.
 */
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { TabBar } from '@/components/TabBar';
import { useInbox } from '@/lib/inbox';
import { syncLocation } from '@/lib/location';
import { registerForPush, routeNotificationTaps } from '@/lib/push';
import { useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const { unreadCount } = useInbox();
  const t = useTheme();
  useEffect(() => {
    registerForPush().catch(() => undefined);
    const stopTaps = routeNotificationTaps();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') syncLocation(false).catch(() => undefined);
    });
    return () => { stopTaps(); sub.remove(); };
  }, []);

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Discover' }} />
      <Tabs.Screen name="matches" options={{ title: 'Book Dates', tabBarBadge: unreadCount || undefined }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
