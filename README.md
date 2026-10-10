# BookDate 📚❤️

**Tinder for book lovers.** Swipe right or left on book *covers*. When a nearby reader (you choose: up to 15 km or 10 miles)
loves the same book, it's a match — and your chat opens as a two-person book club about that book.

iOS and Android app built with **Expo (React Native) + Supabase** from one codebase, built and submitted
to the App Store and Google Play from any machine (no Mac required) through **EAS Build / Submit**.

---

## Features

| Area | What's in v1 |
|---|---|
| **Onboarding** | Sign in with Apple (iOS), Google, or email → name, birthday (18+ gate), gender → who to meet (genders, age range) → ≥3 favourite genres → optional bio + community rules → location & push permissions |
| **Discover** | Gesture swipe deck of covers (drag, fling, or ✕/♥ buttons), haptics, "❤️ 3 readers near you loved this" hints, "It's a book date!" match celebration |
| **Matching** | Mutual right-swipe on the same book **+** within **both readers' chosen distance** (1–15 km or 1–10 mi; the smaller applies) **+** each fits the other's gender & age preferences **+** no block either way |
| **Book club chat** | Realtime 1:1 chat headed by the shared book and partner's reading profile, discussion-prompt chips, push notifications for matches & messages |
| **Personalisation** | Server-side feed ranking: chosen genres + learned genre affinity from swipes + nearby social proof + popularity + exploration |
| **Profile** | View/edit profile & preferences, legal links, support, sign out, **in-app account deletion** |
| **Safety** | Report (auto-blocks), block, unmatch, server-side profanity masking, 18+ enforced in DB, locations rounded to ~100 m and never exposed |
| **Analytics** | PostHog product events (funnel from sign-up → swipe → match → message) + SQL KPI views (`analytics_daily`, `analytics_top_books`) |

Design choice: **no profile photos** — BookDate is cover-first ("judge a book by its cover, not a
person"). Readers see name, age, bio and genres only. This also keeps UGC moderation small.

## Architecture

```
 iOS app (Expo SDK 57, expo-router, Reanimated)            Supabase
┌──────────────────────────────────────────┐   HTTPS    ┌───────────────────────────────────────┐
│ src/app/*        screens (file routes)   │──────────▶│ Auth (Apple, email)                     │
│ src/lib/api.ts   typed data layer        │   RPC      │ Postgres + PostGIS                      │
│ src/lib/auth.tsx session/profile context │◀──────────│  profiles · books · swipes · matches     │
│ src/lib/location / push / analytics      │  Realtime  │  messages · blocks · reports             │
└──────────────────────────────────────────┘ websocket  │  RLS on every table, SECURITY DEFINER    │
          │ events                                       │  RPCs: get_feed, swipe, get_matches…     │
          ▼                                              │  trigger: right swipe ⇒ match            │
      PostHog                                            │  trigger ⇒ pg_net ⇒ Expo Push service    │
                                                         └───────────────────────────────────────┘
 Open Library (covers + catalogue) ──▶ scripts/seed-books.mjs ──▶ books table
```

**Why this stack**

- **Expo + EAS** — one TypeScript codebase, native iOS UI, cloud builds/signing/submission (works from Linux/Windows), OTA updates via `eas update`.
- **Supabase** — Postgres with **PostGIS** makes the distance rule a single indexed `ST_DWithin`; Auth has native Sign in with Apple; Realtime streams chat; RLS keeps the client thin and secure. Scales vertically a long way and all logic is portable SQL.
- **Open Library** — free, key-less catalogue and cover images across every genre.
- **PostHog** — product analytics without IDFA (no App Tracking Transparency prompt needed). Optional.
- **Push from Postgres** — triggers call Expo's push API via `pg_net`; no extra servers or edge functions to operate.

## Repository layout

```
src/app/                 expo-router screens
  _layout.tsx            auth-guarded root stack (sign-in → onboarding → app)
  sign-in.tsx            Apple + email auth
  onboarding.tsx         first-run wizard      edit-profile.tsx   same wizard, edit mode
  (tabs)/index.tsx       Discover swipe deck   (tabs)/matches.tsx  Book Dates list
  (tabs)/profile.tsx     profile & settings    chat/[id].tsx       book-club chat
src/components/          SwipeCard, BookCover, ProfileWizard, ui primitives
src/lib/                 supabase client, api, auth, location, push, analytics, types
src/constants/           theme tokens, genres.json (shared with seed script)
supabase/migrations/     schema, RLS, RPCs, matching & push triggers, analytics views
supabase/tests/          PostGIS scenario tests (run in CI)
scripts/                 seed-books.mjs, seed-demo.mjs, make-icons.py
docs/                    APP_STORE.md, PLAY_STORE.md (store guides) + GitHub Pages site: privacy, terms, support, delete-account
```

## Setup

### 1. Backend (Supabase) — ~10 min

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push          # runs supabase/migrations/*
   ```
3. **Auth → Providers → Apple**: enable, and add your bundle id (`com.amitdas.bookdate`, see `app.json`) under *Client IDs*. Native sign-in needs no secret.
4. **Auth → Providers → Email**: keep enabled (needed for the App Review demo account).
5. Seed the catalogue (up to ~2,000 books with covers, from Open Library):
   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service key> npm run seed:books
   ```

### 2. App

```bash
npm install
cp .env.example .env      # fill in Supabase URL + anon key (PostHog optional)
npx eas-cli@latest login
npx eas-cli@latest init   # creates the EAS project & fills extra.eas.projectId (needed for push)
npx eas-cli@latest build -p ios --profile development   # dev client for your iPhone
npx expo start
```
On a Mac you can instead run `npx expo run:ios` for the simulator (Sign in with Apple and push need a real device).

### 3. Quality checks

```bash
npm run typecheck && npm run lint
PGHOST=localhost PGUSER=postgres PGPASSWORD=... supabase/tests/run.sh   # needs Postgres + PostGIS
```

## Ship to the App Store

Full checklist, review notes, privacy-label answers and store copy: **[docs/APP_STORE.md](docs/APP_STORE.md)**.
Short version:

```bash
# set production env vars once
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext
# (+ EXPO_PUBLIC_POSTHOG_KEY if using analytics; legal URLs default to the GitHub Pages site)

npm run build:ios     # eas build -p ios --profile production  (EAS handles certificates & profiles)
npm run submit:ios    # eas submit -p ios --latest  → TestFlight / App Store Connect
```

## Android & Google sign-in

Same code, platform tweaks only (Material icons, Android date dialog, cross-platform action sheet, edge-to-edge keyboard).
Setup for Google sign-in, Android push (Firebase) and Google Play: **[docs/PLAY_STORE.md](docs/PLAY_STORE.md)**.

```bash
npm run build:android:apk   # installable APK for testers
npm run build:android       # AAB for Google Play
```

## Analytics

Events (PostHog): `signed_up`, `signed_in`, `onboarding_completed`, `book_swiped` (liked, genres, nearby_likes),
`match_created`, `match_opened`, `message_sent`, `profile_updated`, `unmatched`, `user_blocked`,
`user_reported`, `account_deleted`, plus app lifecycle events.
Server KPIs (SQL editor / service role): `select * from analytics_daily;` and `select * from analytics_top_books;`.

## Personalisation (how `get_feed` ranks covers)

```
score = 2.0 × |book genres ∩ my genres|
      + Σ learned affinity of the book's genres   (my likes +1, passes −0.5, averaged per genre)
      + 3.0 × ln(1 + compatible readers in range who liked it)   ← raises match odds
      + 0.3 × ln(1 + global likes)
      + random(0‥1.5)                                                ← exploration
```

## Moderation operations

- `reports` table = moderation queue (status `open` → `actioned`/`dismissed`). Reporting auto-blocks the reported reader for the reporter.
- To ban a user: delete them in **Auth → Users** (cascades everything).
- Extend `banned_words` to tune profanity masking.
- Commit to reviewing reports within 24 h (Apple guideline 1.2).

## Roadmap ideas

Group book clubs per book & neighbourhood · "currently reading" shelf · Goodreads import · meet-up spots (bookshops/cafés) · Android build (the codebase is already cross-platform).
