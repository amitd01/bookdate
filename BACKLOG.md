# Backlog — next build

Running list of bugs and improvements from TestFlight, batched into the next build.
Status: ✅ done (on `main`) · 🔧 to do · ⚙️ config (Supabase/App Store, no build needed) · ❓ decision needed

## Bugs

| # | Issue | Fix | Status |
|---|---|---|---|
| 1 | Chat: suggestion chips balloon to half the screen until the keyboard opens | Pin the horizontal prompts list to its content height (`bf65239`) | ✅ |
| 2 | Email sign-up: confirmation link opens `localhost` | Site URL → `https://amitd01.github.io/bookdate/confirmed/` (new landing page) | ⚙️ |
| 3 | Email sign-up: email is generic Supabase, no BookDate branding | Custom "Confirm signup" template (subject + body with link **and** 6‑digit code) | ⚙️ |
| 4 | Email sign-up: Supabase's built-in sender only reaches project team members and is rate-limited — other testers never get the email | Custom SMTP (e.g. Brevo/Resend) with sender name "BookDate" | ⚙️ before external testers |
| 5 | Email sign-up leaves the app to confirm | In-app 6-digit code entry after sign-up (`verifyOtp`, type `signup`) + "resend code" | 🔧 |

## Improvements

| # | Idea | Status |
|---|---|---|
| — | Over-the-air updates (`expo-updates`) so JS fixes ship without a rebuild | ❓ |
| — | **Android app + Google sign-in** (cross-platform action sheet, Android date picker, Material icons, FCM push, Play docs) | 🔧 PR open |
