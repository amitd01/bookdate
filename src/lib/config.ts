/**
 * Runtime configuration from EXPO_PUBLIC_* env vars (inlined at build time;
 * set them in .env locally and as EAS environment variables for store builds).
 * Legal/support defaults point at the GitHub Pages site built from docs/.
 */
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://amitd01.github.io/bookdate/terms/',
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://amitd01.github.io/bookdate/privacy/',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'amitdas+bookdatesupport@gmail.com',
};
