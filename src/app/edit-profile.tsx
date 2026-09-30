/** Edit profile & preferences (same form as onboarding, single page). */
import { router } from 'expo-router';

import { ProfileWizard } from '@/components/ProfileWizard';
import { analytics } from '@/lib/analytics';
import { saveProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function EditProfile() {
  const { profile, refreshProfile } = useAuth();
  if (!profile) return null;
  const { id: _id, ...initial } = profile;
  return (
    <ProfileWizard
      mode="edit"
      initial={initial}
      onSubmit={async (p) => {
        await saveProfile(p);
        analytics.track('profile_updated');
        await refreshProfile();
        router.back();
      }}
    />
  );
}
