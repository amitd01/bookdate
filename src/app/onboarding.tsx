/** First-run setup: You · Looking for · Your shelf · Ground rules, then location + push explainers. */
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
        analytics.track('onboarding_completed', { genres: p.genres, gender: p.gender, interested_in: p.interested_in, looking_for: p.looking_for });
        await syncLocation(false).catch(() => undefined); // permission was asked on the explainer screen
        await refreshProfile(); // flips the guard → main app
      }}
    />
  );
}
