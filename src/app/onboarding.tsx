/** First-run setup: profile → preferences → genres → rules, then location + push. */
import { ProfileWizard } from '@/components/ProfileWizard';
import { analytics } from '@/lib/analytics';
import { saveProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { syncLocation } from '@/lib/location';

export default function Onboarding() {
  const { refreshProfile, suggestedName } = useAuth();
  return (
    <ProfileWizard
      mode="onboarding"
      initial={{ display_name: suggestedName }}
      onSubmit={async (p) => {
        await saveProfile(p);
        analytics.track('onboarding_completed', { genres: p.genres, gender: p.gender, interested_in: p.interested_in });
        await syncLocation().catch(() => undefined); // Discover explains if denied
        await refreshProfile(); // flips the guard → main app
      }}
    />
  );
}
