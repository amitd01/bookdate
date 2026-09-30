/**
 * Runtime configuration from EXPO_PUBLIC_* env vars (inlined at build time;
 * set them in .env locally and as EAS environment variables for store builds).
 */
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://github.com/amitd01/bookdate/blob/main/docs/terms.md',
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://github.com/amitd01/bookdate/blob/main/docs/privacy.md',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@bookdate.app',
};
