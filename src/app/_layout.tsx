/**
 * Root navigator. Access is decided by auth state via Stack.Protected:
 * signed out → sign-in · no profile yet → onboarding · otherwise → app.
 * Signed-in, onboarded readers get the shared inbox (matches + unread).
 * The theme follows the system scheme and the reader's mode; the splash
 * stays up until auth and the brand fonts are ready.
 */
import { BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Button, EmptyState } from '@/components/ui';
import { fonts } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { InboxProvider } from '@/lib/inbox';
import { ThemeProvider, useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { ready, session, profile, profileError, refreshProfile, signOut } = useAuth();
  const t = useTheme();

  useEffect(() => {
    if (ready && fontsReady) SplashScreen.hideAsync();
  }, [ready, fontsReady]);
  if (!ready || !fontsReady) return null;

  // Signed in but the profile couldn't be loaded: retry rather than guess "new reader".
  if (session && !profile && profileError) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <EmptyState icon="books" title="Couldn't reach BookDate" body="Check your internet connection and try again.">
          <Button title="Try again" onPress={() => refreshProfile().catch(() => undefined)} />
          <Button title="Sign out" variant="ghost" onPress={signOut} />
        </EmptyState>
      </View>
    );
  }

  const stack = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg },
      headerTintColor: t.accInk, headerStyle: { backgroundColor: t.bg }, headerShadowVisible: false,
      headerTitleStyle: { fontFamily: fonts.uiHeavy, color: t.ink } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !profile}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !!profile}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="edit-profile" options={{ headerShown: true, title: 'Edit profile', presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
  // Always rendered (so the navigator never remounts); idle until there's an onboarded reader.
  return <InboxProvider userId={session && profile ? session.user.id : null}>{stack}</InboxProvider>;
}

/** Theme from the signed-in reader's mode (dating until there's a profile). */
function Themed({ fontsReady }: { fontsReady: boolean }) {
  const { profile } = useAuth();
  return (
    <ThemeProvider mode={profile?.looking_for ?? 'dating'}>
      <StatusBar style="auto" />
      <RootNavigator fontsReady={fontsReady} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // A font load error still lets the app start, on system fonts.
  const [loaded, error] = useFonts({
    BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic,
  });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Themed fontsReady={loaded || !!error} />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
