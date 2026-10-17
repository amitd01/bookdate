# TOOLING.md — BookDate

## Environment
| Concern | State |
|---|---|
| App | Expo SDK 57 (`expo ~57.0.26`), React Native 0.86, Expo Router 57, TypeScript |
| Backend | Supabase (Postgres, auth, realtime, storage); config in `supabase/` |
| Build / release | EAS Build + Submit (`eas.json`); OTA JS updates via EAS Update (`npm run update:production -- "msg"`) |
| Dev build | `expo-dev-client` added 2026-10-16 for development builds |
| Analytics | PostHog events + SQL views `analytics_daily`, `analytics_top_books` |
| Test data | `scripts/synthetic-readers.sql` — 10,062 synthetic readers across Mumbai and Bengaluru |

## Commands
`npx expo start` · `npx expo lint` · `npx tsc --noEmit` · `npx expo-doctor` · `npx expo install <pkg>` (never plain npm add)

## Version control
- `github.com/amitd01/bookdate` (public), branch `main`, PR-based merges, CI in `.github/workflows/ci.yml`.
- `package-lock.json` version bumps that appear as local noise after a release can be discarded.

## Cost ledger
Supabase free/pro tier + EAS build minutes; no paid acquisition.
