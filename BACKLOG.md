# Backlog — next build

Running list of bugs and improvements from TestFlight, batched into the next build.
Status: ✅ done (on `main` or in an open PR) · 🔧 to do · ⚙️ config (Supabase/App Store, no build needed) · ❓ decision needed

## Bugs

| # | Issue | Fix | Status |
|---|---|---|---|
| 1 | Chat: suggestion chips balloon to half the screen until the keyboard opens | Pin the horizontal prompts list to its content height (`bf65239`) | ✅ |
| 2 | Email sign-up: confirmation link opens `localhost` | Landing page `/confirmed/` ✅; app now sends `emailRedirectTo` it (#3) — add it to Supabase **Redirect URLs** and set it as Site URL | ✅ |
| 3 | Email sign-up: email is generic Supabase, no BookDate branding | Custom "Confirm signup" template (subject + body with link **and** code) | ✅ |
| 4 | Email sign-up: Supabase's built-in sender only reaches project team members and is rate-limited — other testers never get the email | Custom SMTP via Gmail app password, sender "BookDate" (move to Resend/Brevo + own domain before public launch) | ✅ |
| 5 | Email sign-up leaves the app to confirm | In-app code entry after sign-up (`verifyOtp`, type `signup`), 60 s resend cooldown; signing in to an unconfirmed account jumps to the code step (#3) | ✅ |

## Improvements

| # | Idea | Status |
|---|---|---|
| — | Over-the-air updates (`expo-updates`) so JS fixes ship without a rebuild | ❓ |
| — | **Android app + Google sign-in** (cross-platform action sheet, Android date picker, Material icons, FCM push, Play docs) | ✅ #3 |
| 6 | Android: keyboard could cover inputs under edge-to-edge (Android 15+) | `KeyboardAvoidingView` uses `padding` on both platforms (#3) | ✅ |

## Release status

| Platform | Includes all fixes above? | Next step |
|---|---|---|
| Android | ✅ from its first build | `npm run build:android:apk` → test → Play closed test |
| iOS | ❌ TestFlight build 2 predates #1, #5, Google sign-in | `npm run build:ios && npm run submit:ios` for the next release |
