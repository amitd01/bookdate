/**
 * Platform-native tab bars (refresh v2):
 *   - iOS: a floating glass capsule (300×66), centred above the home indicator;
 *     the active tab sits on an accSoft pill.
 *   - Android: a Material 3 navigation bar, full width; the active icon sits
 *     on a 64×32 accSoft pill with its label below.
 * Both float over the screen, so scrolling content uses `useTabInset()` as
 * bottom padding to clear them.
 */
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Glass } from '@/components/ui';
import { fonts, type Theme } from '@/constants/theme';
import { useStyles, useTheme } from '@/lib/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const IOS = Platform.OS === 'ios';
const CAPSULE_H = 66;
const ANDROID_H = 64;

/** Bottom offset of the iOS capsule: just above the home indicator. */
const capsuleBottom = (safeBottom: number) => Math.max(safeBottom - 8, 16);

/** Bottom padding scrolling content needs to clear the tab bar. */
export function useTabInset() {
  const { bottom } = useSafeAreaInsets();
  return IOS ? capsuleBottom(bottom) + CAPSULE_H + 16 : ANDROID_H + bottom;
}

/** Icon per route name (Discover · Book Dates · Profile). */
const ICONS: Record<string, IconName> = { index: 'discover', matches: 'chats', profile: 'profile' };

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const t = useTheme();
  const s = useStyles(make);
  const { bottom } = useSafeAreaInsets();

  const items = state.routes.map((route, i) => {
    const { options } = descriptors[route.key];
    const focused = state.index === i;
    const label = typeof options.title === 'string' ? options.title : route.name;
    const badge = options.tabBarBadge;
    const onPress = () => {
      const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !e.defaultPrevented) navigation.navigate(route.name, route.params);
    };
    const color = focused ? t.accInk : t.ink2;
    const icon = (
      <View>
        <Icon name={ICONS[route.name] ?? 'books'} size={22} color={color} />
        {badge != null && (
          <View style={s.badge}><Text style={s.badgeText}>{badge}</Text></View>
        )}
      </View>
    );
    return (
      <Pressable key={route.key} onPress={onPress} style={IOS ? [s.iosTab, focused && s.iosTabOn] : s.androidTab}
        accessibilityRole="tab" accessibilityState={{ selected: focused }}
        accessibilityLabel={badge != null ? `${label}, ${badge} unread` : label}>
        {IOS ? icon : <View style={[s.androidPill, focused && { backgroundColor: t.accSoft }]}>{icon}</View>}
        <Text style={[s.label, { color }, focused && { fontFamily: fonts.uiBold }]} numberOfLines={1}>{label}</Text>
      </Pressable>
    );
  });

  if (IOS) {
    return (
      <View style={[s.iosWrap, { bottom: capsuleBottom(bottom) }]} pointerEvents="box-none">
        {/* Shadow on a wrapper: Glass clips its content, which would clip the shadow too. */}
        <View style={s.capsuleShadow}>
          <Glass strong intensity={70} style={s.capsule}>{items}</Glass>
        </View>
      </View>
    );
  }
  return <View style={[s.android, { paddingBottom: bottom, height: ANDROID_H + bottom }]}>{items}</View>;
}

const make = (t: Theme) => StyleSheet.create({
  iosWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  capsuleShadow: { borderRadius: CAPSULE_H / 2, shadowColor: t.shadow, shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 12 } },
  capsule: { width: 300, height: CAPSULE_H, borderRadius: CAPSULE_H / 2, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  iosTab: { flex: 1, height: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iosTabOn: { backgroundColor: t.accSoft },
  android: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row',
    backgroundColor: t.surface2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line, paddingTop: 8,
  },
  androidTab: { flex: 1, alignItems: 'center', gap: 4 },
  androidPill: { width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.uiSemi, fontSize: IOS ? 11 : 12 },
  badge: {
    position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: t.acc, alignItems: 'center', justifyContent: 'center',
    shadowColor: t.acc, shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  badgeText: { color: '#FFFFFF', fontFamily: fonts.uiHeavy, fontSize: 11 },
});
