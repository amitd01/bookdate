/**
 * Root navigator. Access is decided by auth state via Stack.Protected:
 * signed out → sign-in · no profile yet → onboarding · otherwise → app.
 * Signed-in, onboarded readers get the shared inbox (matches + unread).
 */
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Button, EmptyState } from '@/components/ui';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { InboxProvider } from '@/lib/inbox';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { ready, session, profile, profileError, refreshProfile, signOut } = useAuth();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  // Signed in but the profile couldn't be loaded: retry rather than guess "new reader".
  if (session && !profile && profileError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper }}>
        <EmptyState icon="books" title="Couldn't reach BookDate" body="Check your internet connection and try again.">
          <Button title="Try again" onPress={() => refreshProfile().catch(() => undefined)} />
          <Button title="Sign out" variant="ghost" onPress={signOut} />
        </EmptyState>
      </View>
    );
  }

  const stack = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper },
      headerTintColor: colors.accent, headerStyle: { backgroundColor: colors.paper }, headerShadowVisible: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !profile}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !!profile}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: '', headerBackTitle: 'Book Dates' }} />
        <Stack.Screen name="search" options={{ headerShown: true, title: 'Search', headerBackTitle: 'Discover' }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: true, title: 'Edit profile', presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
  // Always rendered (so the navigator never remounts); idle until there's an onboarded reader.
  return <InboxProvider userId={session && profile ? session.user.id : null}>{stack}</InboxProvider>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
