/**
 * Main tabs (Discover · Book Dates · Profile). Mounted only for onboarded
 * users, so it also owns signed-in lifecycle work: refreshing location on
 * every foreground, saving the push token (when allowed), and routing
 * notification taps to chats. Book Dates shows an unread badge.
 */
import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { AppState, View, type ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/ui';
import { colors, serif, space } from '@/constants/theme';
import { useInbox } from '@/lib/inbox';
import { syncLocation } from '@/lib/location';
import { registerForPush, routeNotificationTaps } from '@/lib/push';

/** Tab icon: SF Symbol on iOS, Material Symbol on Android. */
const icon = (name: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} color={color} size={24} />;
  };

export default function TabsLayout() {
  const { unreadCount } = useInbox();
  useEffect(() => {
    registerForPush().catch(() => undefined);
    const stopTaps = routeNotificationTaps();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') syncLocation(false).catch(() => undefined);
    });
    return () => { stopTaps(); sub.remove(); };
  }, []);

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.ink3,
      tabBarBadgeStyle: { backgroundColor: colors.accent, color: '#fff', fontSize: 11 },
      tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
      headerStyle: { backgroundColor: colors.paper }, headerShadowVisible: false,
      headerTitleStyle: { fontFamily: serif, fontWeight: '800', fontSize: 20, color: colors.ink },
      sceneStyle: { backgroundColor: colors.paper },
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Discover', tabBarIcon: icon('books'),
        headerRight: () => (
          <View style={{ marginRight: space(4) }}>
            <IconButton icon="search" label="Search for a book" onPress={() => router.push('/search')} />
          </View>
        ),
      }} />
      <Tabs.Screen name="matches" options={{ title: 'Book Dates', tabBarIcon: icon('chats'), tabBarBadge: unreadCount || undefined }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('profile') }} />
    </Tabs>
  );
}
