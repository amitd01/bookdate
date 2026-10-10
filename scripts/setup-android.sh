#!/usr/bin/env bash
# Guided Android + Google sign-in setup for BookDate (macOS).
# Runs every CLI step itself and pauses — opening the right web page — wherever
# a human has to click or paste (Google Cloud console, Supabase dashboard).
# Safe to re-run: each step asks before doing anything.
#
#   bash scripts/setup-android.sh
set -euo pipefail
cd "$(dirname "$0")/.."

EAS="npx --yes eas-cli@latest"
SUPABASE_REF="kktjdmqjqzjnhncolsqo"
PKG="com.amitdas.bookdate"
ENVS=(--environment production --environment preview --environment development)

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
say()  { printf '  %s\n' "$*"; }
pause() { read -r -p "  ↳ $1 — press Enter when done " _; }
ask()  { local v; read -r -p "  ↳ $1: " v; printf '%s' "$v"; }
yes()  { local a; read -r -p "  ↳ $1 [Y/n] " a; [[ -z "$a" || "$a" =~ ^[Yy] ]]; }
client_id() { # prompt until it looks like a Google OAuth client ID
  local v
  while true; do
    v=$(ask "$1")
    [[ "$v" == *.apps.googleusercontent.com ]] && { printf '%s' "$v"; return; }
    say "That doesn't look like a client ID (ends in .apps.googleusercontent.com). Try again."
  done
}

bold "0/6  Update code"
git pull --ff-only && npm install --no-audit --no-fund

bold "1/6  Google consent screen (manual, ~3 min)"
say "In the page that opens (project BookDate):"
say "  • User type External · App name BookDate · support email amitdas+bookdatesupport@gmail.com"
say "  • Privacy policy: https://amitd01.github.io/bookdate/privacy/"
say "  • Scopes: leave defaults (email, profile, openid)"
say "  • Audience → PUBLISH APP (so any Google account can sign in)"
if yes "Open the consent-screen page now?"; then open "https://console.cloud.google.com/auth/overview"; fi
pause "Consent screen configured and published"

bold "2/6  Web + iOS OAuth clients (manual: create, then paste IDs here)"
say "Clients → + Create client:"
say "  a) Application type: Web application · Name: BookDate Supabase → Create"
say "  b) Application type: iOS · Bundle ID: $PKG → Create"
if yes "Open the Clients page now?"; then open "https://console.cloud.google.com/auth/clients"; fi
WEB_ID=$(client_id "Paste the WEB client ID")
IOS_ID=$(client_id "Paste the iOS client ID")

bold "3/6  Store client IDs in EAS (automatic)"
# env:set creates or updates, so re-running is safe.
$EAS env:set "${ENVS[@]}" --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "$WEB_ID" --visibility plaintext --non-interactive
$EAS env:set "${ENVS[@]}" --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value "$IOS_ID" --visibility plaintext --non-interactive
say "✔ Saved."

bold "4/6  Build the Android test APK (automatic, ~15–25 min on EAS)"
say "If asked 'Generate a new Android Keystore?' → answer Yes."
say "If asked 'Install and run on an emulator?' → answer No (install from the link/QR on your phone)."
# Don't abort the walkthrough if only the optional emulator step fails.
if yes "Start the build now?"; then npm run build:android:apk || say "(Build command exited non-zero — if the build itself finished, continue.)"; fi

bold "5/6  Android OAuth client (manual: needs the keystore SHA-1)"
say "In the menu that opens: choose 'Android' → 'production' (or 'preview') → 'Keystore'"
say "→ note the SHA1 Fingerprint, then exit with Ctrl+C or 'Go back'/'Exit'."
pause "Ready to view the SHA-1"
$EAS credentials -p android || true
say "Now in Google Cloud → Clients → + Create client → Android:"
say "  Package name: $PKG · SHA-1: (the fingerprint you just saw)"
if yes "Open the Clients page now?"; then open "https://console.cloud.google.com/auth/clients"; fi
ANDROID_ID=$(client_id "Paste the ANDROID client ID")

bold "6/6  Enable Google in Supabase (manual: paste these values)"
say "Sign In / Providers → Google → Enable, then:"
say "  Client IDs        : $WEB_ID,$IOS_ID,$ANDROID_ID"
say "  Client Secret     : (the WEB client's secret, from Google Cloud → the web client)"
say "  Skip nonce checks : ON"
printf '%s' "$WEB_ID,$IOS_ID,$ANDROID_ID" | pbcopy && say "(Client IDs copied to your clipboard.)"
if yes "Open Supabase auth providers now?"; then open "https://supabase.com/dashboard/project/$SUPABASE_REF/auth/providers"; fi
pause "Google provider saved in Supabase"

bold "✅ Done"
say "Install the APK from the EAS link/QR on an Android phone and try 'Sign in with Google'."
say "Optional next: Firebase push (docs/PLAY_STORE.md part B) and Play Console (part D)."
say "iOS gets Google sign-in in its next build: npm run build:ios && npm run submit:ios"
