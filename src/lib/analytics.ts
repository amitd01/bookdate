/**
 * Product analytics via PostHog (no IDFA, so no ATT prompt is needed).
 * If EXPO_PUBLIC_POSTHOG_KEY is unset every call is a no-op, so dev builds
 * and forks work without an analytics account.
 *
 * Funnel events: signed_up, onboarding_completed, book_swiped (source deck|search),
 * book_searched, match_created, message_sent, match_opened, unmatched,
 * user_reported, invite_shared, profile_updated, account_deleted.
 */
import PostHog from 'posthog-react-native';

import { config } from './config';

const client = config.posthogKey
  ? new PostHog(config.posthogKey, { host: config.posthogHost, captureAppLifecycleEvents: true })
  : null;

type Props = Record<string, string | number | boolean | null | string[]>;

export const analytics = {
  identify: (userId: string, props?: Props) => client?.identify(userId, props),
  track: (event: string, props?: Props) => client?.capture(event, props),
  screen: (name: string) => client?.screen(name),
  reset: () => client?.reset(),
};
