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
| 6 | Android: keyboard could cover inputs under edge-to-edge (Android 15+) | `KeyboardAvoidingView` uses `padding` on both platforms (#3) | ✅ |
| 7 | Discover: "❤️ n readers near you" counts are fetched when the deck loads and never refresh, so likes made after that don't show until the app restarts | Deck re-ranks on focus and app foreground (keeps the visible card); top-ups also refresh counts on cards already loaded | ✅ #4 |
| 12 | Raw `java.net.UnknownHostException: Unable to resolve host …supabase.co` shown when the phone's connection drops (seen finishing onboarding) | Network errors now read "Couldn't reach BookDate. Check your internet connection and try again."; the form keeps what was entered | ✅ #4 |

## Improvements — release 1.1

Decisions (design proposal, all as recommended): the tab stays "Book Dates" with a Date / Friend tag per match · birthday locked after onboarding (support corrects it) · switching modes keeps matches · nearby chip shows buckets (just you / a few / 10+ / 50+, readers active in 30 days) · a genre filter lasts until the app is closed.

| # | Idea | Status |
|---|---|---|
| — | **Over-the-air updates** (`expo-updates`, runtime = app version, channels per EAS profile; `npm run update:production -- "message"`) | ✅ 1.1 |
| — | **Android app + Google sign-in** (cross-platform action sheet, Android date picker, Material icons, FCM push, Play docs) | ✅ #3 |
| 8 | **Browse other genres:** "For you ▾" picker on Discover; `get_feed(p_genre)` | ✅ 1.1 |
| 9 | **Search for a book:** catalogue search (`search_books`, trigram index) + Open Library fallback (`add_book`); the heart likes it like a right swipe, re-liking a passed book works | ✅ 1.1 |
| 10 | **"Just meeting people":** `looking_for` dating/friends; friends match any gender, only with friends; matches keep their mode (teal, "Book buddy") | ✅ 1.1 |
| 11 | **Design / UX audit** ([proposal](https://claude.ai/artifact/L8187VGfF4sUCwhMAtHVj9)) — all P0 items: accessibility (44 pt targets, strong borders, contrast, card actions) · onboarding in 4 chapters, no preselected gender/birthday, "You're 27" · permission explainers · Discover header + nearby chip + coach mark + honest empty states · match moment v2 (every match, partner card, opening moves) · Book Dates (new-match carousel, unread dots, timestamps, tab badge, "Your turn") · system icons, "LOVE IT" stamp · chat safety shield, notice, report with details · grouped Profile | ✅ 1.1 |
| 13 | **Choose your distance:** slider up to 15 km or 10 miles, km/mi toggle; age range slider | ✅ #4 |
| 14 | **Unmatch / report drops the person, keeps the book:** `unmatch()` silently blocks (no re-match on any book) and deletes the chat; your like stays so the book can match others | ✅ 1.1 |

### Next (P1, from the design proposal)

Dark mode · bundle Fraunces · seed-shelf onboarding step · weekly city shelf · "My shelf" + how others see you · undo last pass · discreet notification previews · invite card with deep link to a book · local (Indian) catalogue.

## Release status

| Platform | Version | Next step |
|---|---|---|
| Both | 1.1.0 (this release) | `npx supabase db push` → `npm run build:ios && npm run submit:ios` → `npm run build:android && npm run submit:android` |
| After 1.1 is installed | — | JS-only fixes ship with `npm run update:production -- "what changed"`; native changes (new modules, permissions, icons) still need a build and a version bump |
