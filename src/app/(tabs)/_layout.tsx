/**
 * Main tabs (Discover · Matches · Profile). Mounted only for onboarded users,
 * so it also owns signed-in lifecycle work: refreshing location on every
 * foreground, registering for push, and routing notification taps to chats.
 */
import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect } from 'react';
import { AppState, type ColorValue } from 'react-native';

import { colors, serif } from '@/constants/theme';
import { registerForPush, routeNotificationTaps } from '@/lib/push';
import { syncLocation } from '@/lib/location';

/** Tab icon: SF Symbol on iOS, Material Symbol on Android. */
const icon = (name: SymbolViewProps['name']) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={color} size={24} />;
  };

export default function TabsLayout() {
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
      tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.inkMuted,
      tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
      headerStyle: { backgroundColor: colors.paper }, headerShadowVisible: false,
      headerTitleStyle: { fontFamily: serif, fontWeight: '800', fontSize: 20, color: colors.ink },
      sceneStyle: { backgroundColor: colors.paper },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Discover', tabBarIcon: icon({ ios: 'books.vertical.fill', android: 'menu_book' }) }} />
      <Tabs.Screen name="matches" options={{ title: 'Book Dates', tabBarIcon: icon({ ios: 'bubble.left.and.bubble.right.fill', android: 'forum' }) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon({ ios: 'person.crop.circle.fill', android: 'account_circle' }) }} />
    </Tabs>
  );
}
