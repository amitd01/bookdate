# Learnings

> Things that already cost time. Check here before debugging anything odd. Add an entry for anything that took >15 minutes.

| # | Area | Learning | Where it matters |
|---|---|---|---|
| L-01 | Expo | APIs change every SDK; always read the versioned docs for the `expo` major in `package.json` rather than trusting memory. | any Expo/EAS change (`AGENTS.md`) |
| L-02 | Dependencies | `npx expo install` resolves SDK-compatible versions; `npm add` does not and breaks builds. | adding packages |
| L-03 | Catalogue | Open Library's search API finds modern works that the subjects endpoint misses; seed scripts use search. | `scripts/seed-books` (#7) |
| L-04 | UI | expo-blur glass chrome works on iOS only; Android gets a solid fallback. | visual refresh v2 (#8) |
| L-05 | iOS | iOS 27 asserts at launch without the UIScene lifecycle; `plugins/withSceneLifecycle.js` opts into Expo's `ExpoAppSceneDelegate`. Remove once Expo's template adopts scenes. | prebuild / iOS launch crash |
| L-06 | Auth | iOS native Google sign-in fails with "Passed nonce and nonce in id_token should either both exist or not" unless Supabase → Auth → Google → **Skip nonce checks** is on. | Google sign-in on iOS |
| L-07 | Auth | Play App Signing re-signs builds: Google sign-in needs an Android OAuth client for Play's app-signing SHA-1 **and** one for the EAS upload-key SHA-1 (sideloaded/dev builds). Keep both. | Google sign-in on Android (`DEVELOPER_ERROR` / code 10) |
| L-08 | Local dev | Run `npx eas-cli env:pull --environment production` **before** `npx expo prebuild --clean`, or the Google URL scheme and Supabase URL are missing. | local iOS builds |
| L-09 | Email | Auth emails go through the owner's Gmail SMTP, so bounces (e.g. Play pre-launch robot sign-ups ~15 min after a testing-track upload) land in that inbox and the Sent copy shows the code. Not a leak. | auth email, BACKLOG #26–27 |
| L-10 | SVG | react-native-svg ignores alpha inside `rgba()` stopColor; use `svgStop()` from `components/ui.tsx` (splits into stopColor + stopOpacity). | gradients/glows |
