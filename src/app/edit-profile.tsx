/** Edit profile & preferences (same questions as onboarding, one page; Cancel in the header). */
import { router, Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { ProfileWizard } from '@/components/ProfileWizard';
import { fonts } from '@/constants/theme';
import { analytics } from '@/lib/analytics';
import { saveProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function EditProfile() {
  const { profile, refreshProfile } = useAuth();
  const t = useTheme();
  if (!profile) return null;
  const { id: _id, ...initial } = profile;
  return (
    <>
      <Stack.Screen options={{
        headerLeft: () => (
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: t.accInk, fontFamily: fonts.uiSemi, fontSize: 17 }}>Cancel</Text>
          </Pressable>
        ),
      }} />
      <ProfileWizard
        mode="edit"
        initial={initial}
        onSubmit={async (p) => {
          await saveProfile(p);
          analytics.track('profile_updated', { looking_for: p.looking_for, mode_changed: p.looking_for !== profile.looking_for });
          await refreshProfile();
          router.back();
        }}
      />
    </>
  );
}
