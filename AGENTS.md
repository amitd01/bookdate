This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Secrets — never commit (core rule)

These live **only** in EAS (env vars / `eas credentials`) or on the owner's machine, never in git, chats, PRs or issues:

- `google-services.json`, `GoogleService-Info.plist` (EAS file env `GOOGLE_SERVICES_JSON`, read by `app.config.js`)
- Firebase / Google service-account keys (`*firebase-adminsdk*.json`, `google-play-service-account.json`)
- Signing material: keystores (`*.jks`, `*.keystore`), `*.p8`, `*.p12`, `*.pem`, provisioning profiles
- `.env`, `.env.local` (pull with `npx eas-cli env:pull`), Supabase service-role keys, any API secret
- Design handoff zips / `design_handoff*/` folders

Flags that enforce this — **never bypass or weaken them** (no `--no-verify`, no editing the patterns to let a file through):

- `.gitignore` covers the patterns above.
- `scripts/check-secrets.sh` runs as a pre-commit hook (`.githooks/`, installed by `npm install`) and in CI; it also catches private-key content in any file.

If a check fires, unstage the file and stop; if a secret was ever pushed, tell the owner immediately so it can be rotated.

In `eas credentials`, never choose "Set up a new keystore" or "Delete your keystore" — Google Play is tied to the existing upload key.

## Release facts (don't undo)

- Google Play uses Play App Signing. Google Cloud has two Android OAuth clients: Play's app-signing SHA-1 and the EAS upload-key SHA-1. Keep both.
- Supabase → Auth → Google has **Skip nonce checks** on; iOS native Google sign-in fails without it.
- Store checklists: `docs/APP_STORE.md`, `docs/PLAY_STORE.md`.
