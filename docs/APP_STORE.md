# App Store submission guide

Everything needed to get BookDate through App Review. Items marked **✅ built-in** are already
implemented in code; items marked **☐ you** need an action in Apple/Supabase/EAS consoles.

## 1. One-time accounts & identifiers

- ☐ Apple Developer Program membership (organisation account recommended for a dating app).
- ☐ Change `ios.bundleIdentifier` in `app.json` if needed (default `com.amitdas.bookdate`) and match it in Supabase Apple provider *Client IDs* and `supabase/config.toml`.
- ☐ App Store Connect → **My Apps → +** → new iOS app with that bundle id. Put its *Apple ID* number into `eas.json → submit.production.ios.ascAppId`.
- ☐ `npx eas-cli init` (links the EAS project, writes `extra.eas.projectId` — required for push tokens).
- ☐ Sign in with Apple capability: EAS enables it automatically from `ios.usesAppleSignIn` when it creates the provisioning profile.
- ☐ Push: on first `eas build`, answer **yes** to "Generate a new Apple Push Notifications service key" (or upload one with `eas credentials`).

## 2. Legal & support pages (GitHub Pages)

`docs/` is published with GitHub Pages (repo **Settings → Pages → Deploy from a branch → `main` / `/docs`**):

| Page | URL | Where it's used |
|---|---|---|
| Privacy Policy | https://amitd01.github.io/bookdate/privacy/ | App (default), App Store Connect → App Privacy |
| Terms & Community Rules | https://amitd01.github.io/bookdate/terms/ | App (default), onboarding agreement |
| Support | https://amitd01.github.io/bookdate/support/ | App Store Connect → Support URL |
| Marketing | https://amitd01.github.io/bookdate/ | App Store Connect → Marketing URL (optional) |

The app already defaults to these URLs and to `amitdas+bookdatesupport@gmail.com`; the `EXPO_PUBLIC_*` env vars only override them.

## 3. Demo account for the reviewer (guideline 2.1)

Reviewers are usually in Cupertino, where there are no real users yet. Create clearly-labelled test
accounts located there, so the reviewer can see a match, chat, and match live:

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_PASSWORD='<strong password>' \
  node scripts/seed-demo.mjs
```
This creates `reviewer@bookdate.app` (the login you give Apple) and `partner@bookdate.app`
(a team-operated test reader). Override the domain / location with `DEMO_DOMAIN`, `DEMO_LAT`, `DEMO_LNG`.

## 4. Build & submit

```bash
npm run build:ios      # eas build -p ios --profile production (auto-increments build number)
npm run submit:ios     # uploads the latest build to App Store Connect / TestFlight
```
Test the TestFlight build on a real device first: sign in with Apple, onboarding, swipe, match (with the demo partner), chat, push, report/block, delete account.

## 5. App Store Connect answers

**Age rating** — answer the questionnaire honestly; a dating app with user-generated chat should
select *Unrestricted Web Access: No*, *User-Generated Content: Yes*, *Dating/Mature themes* → results in **18+**.

**App Privacy ("nutrition label")** — Data *linked to the user*, *not used for tracking*:

| Data type | Collected | Purpose |
|---|---|---|
| Contact info → Email address | Yes (email sign-in / Apple relay) | App functionality |
| Contact info → Name | Yes (first name) | App functionality |
| Location → Coarse location | Yes (rounded ~100 m) | App functionality |
| User content → Other user content (messages, bio) | Yes | App functionality |
| Sensitive info → Gender / dating preferences | Yes | App functionality |
| Identifiers → User ID | Yes | App functionality, Analytics |
| Usage data → Product interaction | Yes (if PostHog enabled) | Analytics |
| Diagnostics | No | — |

No tracking → no App Tracking Transparency prompt.

**Export compliance** — `usesNonExemptEncryption: false` is set (standard HTTPS only).

## 6. Guideline compliance built into the app

| Guideline | How it's met |
|---|---|
| 1.2 UGC: terms acceptance | ✅ Onboarding requires agreeing to Terms & Community Rules with zero-tolerance wording |
| 1.2 UGC: filter objectionable content | ✅ Server-side profanity masking on names, bios, messages (`banned_words`) |
| 1.2 UGC: report | ✅ Chat menu → Report (6 reasons) → stored in `reports`, auto-blocks |
| 1.2 UGC: block | ✅ Chat menu → Block (removes match + chat instantly, prevents future matches) |
| 1.2 UGC: act within 24 h / contact info | ☐ Monitor `reports`; support email shown in Profile |
| 4.8 Login services | ✅ Sign in with Apple offered first |
| 5.1.1(v) Account deletion | ✅ Profile → Delete account (deletes auth user + all data) |
| 5.1.1 Purpose strings | ✅ Location "when in use" only, with clear purpose string |
| 5.1.2 Data use | ✅ Exact location never stored or shown; no ads, no tracking |
| 2.1 Completeness | ✅ Demo accounts (above); no placeholder content; empty states everywhere |
| 18+ | ✅ Birthday picker capped at 18 years ago + DB `check` constraint |

## 7. Suggested App Review notes

> BookDate matches readers who like the same book cover and live near each other (each reader picks a distance of up to 15 km or 10 miles).
> Demo login (email/password on the sign-in screen): reviewer@bookdate.app / <password>.
> The account already has one match ("Demo Reader (test account)") with a message. Swiping right on
> covers labelled "1 reader near you loved this" creates a new match instantly while you are near
> Cupertino. Safety tools: open a chat → shield icon (top right) → Safety tips / Report / Unmatch & block. Account deletion: Profile → Delete account.
> Location is used only while the app is open to find readers nearby; exact coordinates are never shown.

## 8. Store listing copy (edit freely)

- **Name:** BookDate – Date by the Book
- **Subtitle:** Swipe covers. Meet readers.
- **Keywords:** book,dating,reader,book club,reading,novel,literature,match,bookish,library
- **Promotional text:** Judge a book by its cover — then meet the reader nearby who loved it too.
- **Description:**
  BookDate is the dating app for people who'd rather talk about books. Swipe right on covers you love, left on the ones you'd skip. When a reader near you loves the same book, it's a book date — and your chat opens as a two-person book club about that very book.
  • Pick your favourite genres and who you'd like to meet
  • Swipe a personalised stream of covers from every genre
  • See which books readers near you are loving
  • Match over a shared favourite and start talking with built-in discussion prompts
  • Always local: choose up to 15 km or 10 miles
  • Safe by design: no photos, report & block in every chat, exact location never shared
- **Screenshots:** 6.9" iPhone required (1320×2868). Capture Discover, match screen, chat, onboarding genres, profile from the TestFlight build.

## 9. What's New — version 1.1

```
• Just meeting people: a new friends mode alongside dating
• Search for a book you love and like it straight from the results
• Browse covers from any genre without changing your profile
• Choose how far to look: up to 15 km or 10 miles
• See every reader you matched with, and send an opening move
• Unread dots, timestamps and a clearer, safer chat
• Easier to read and use with VoiceOver and larger text
```
