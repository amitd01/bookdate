# Handover — 2026-10-19

Last session: visual refresh v2 shipped to testers, store plumbing set up, secrets guard added.
Start here, then `BACKLOG.md` and `AGENTS.md`.

## Done this session
- **1.2.0 visual refresh** (#8): new theme tokens, dark mode (follows system), glass UI (expo-blur on iOS, solid on Android), gradients/SVG glows, brand fonts, all screens restyled, "Loved lately", live Looking-for switch, iOS 27 scene-lifecycle plugin.
- **Secrets guard** (#9): AGENTS.md core rule, broader `.gitignore`, `scripts/check-secrets.sh` as pre-commit hook + CI step.
- **iOS**: 1.2.0 (build 4) in TestFlight; Apple + Google sign-in verified on a real device.
- **Android**: new Play app `com.amitdas.bookdate`; 1.2.0 (versionCode 4, with FCM push) live in **internal testing** (tester list "Test1"). Play App Signing on.
- **Google sign-in**: two Android OAuth clients (Play app-signing SHA-1 + EAS upload SHA-1), iOS client, web client. Supabase "Skip nonce checks" on.
- **Push**: Firebase project `bookdate-74482`; `GOOGLE_SERVICES_JSON` EAS env (production + preview); FCM V1 key in `eas credentials`.
- **Play submit automation**: service account set up, so `npm run submit:android` works.

## Open — in priority order
1. **Store production release** (reminder set for 2026-10-23):
   - App Store: submit 1.2.0 for review with reviewer notes + demo account (`docs/APP_STORE.md`).
   - Play: store listing, privacy policy URL, App access (demo login), ads, content rating, target audience 18+, data safety (`docs/PLAY_STORE.md`), then promote internal → production.
2. **Auth email → Resend** (BACKLOG #26): auth emails currently go out from the owner's personal Gmail. Move SMTP to Resend on an owned domain, then revoke the Gmail app password.
3. **Reviewer / robot test accounts** (BACKLOG #27–28): a real-mailbox demo login for store review, plus credentials in Play pre-launch report settings. A pre-launch robot created `testuserbookdate123@gmail.com` (unconfirmed); delete it in Supabase → Auth → Users.
4. Deferred design items BACKLOG #21–25 (typing indicator, nearby search list, Android blur, cover-colour glow, icon colour).

## Things not to undo
See AGENTS.md → "Release facts" and LEARNINGS L-05…L-10. In short: keep both Android OAuth clients, keep Skip nonce checks, keep the scene-lifecycle plugin, never reset the EAS keystore, never commit keys.

## Local setup reminders (owner's Mac)
- After pulling: `npm install` (enables the secrets pre-commit hook).
- Local iOS: `npx eas-cli env:pull --environment production` → `npx expo prebuild --platform ios --clean` → build from Xcode.
- Simulator location for matches: `xcrun simctl location booted set 19.1176,72.9060` (Powai); dark mode: `xcrun simctl ui booted appearance dark`.
