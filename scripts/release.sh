#!/usr/bin/env bash
# Guided BookDate release (macOS): database → iOS → Android, then OTA notes.
# Runs every CLI step itself and pauses wherever a human has to answer or
# click. Each step asks first, so it's safe to re-run and skip what's done.
#
#   bash scripts/release.sh
set -euo pipefail
cd "$(dirname "$0")/.."

EAS="npx --yes eas-cli@latest"
SUPABASE_REF="kktjdmqjqzjnhncolsqo"
VERSION=$(node -p "require('./app.json').expo.version")

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
say()  { printf '  %s\n' "$*"; }
pause() { read -r -p "  ↳ $1 — press Enter when done " _; }
yes()  { local a; read -r -p "  ↳ $1 [Y/n] " a; [[ -z "$a" || "$a" =~ ^[Yy] ]]; }

bold "BookDate $VERSION release"

bold "0/5  Update code"
if yes "Pull latest main and install packages?"; then
  git checkout main && git pull --ff-only && npm install --no-audit --no-fund
fi

bold "1/5  Database (must go first: the new app needs the new columns and RPCs)"
say "Applies supabase/migrations/* that aren't on the live project yet."
if yes "Run supabase db push now?"; then
  npx --yes supabase link --project-ref "$SUPABASE_REF"
  npx --yes supabase db push
fi

bold "2/5  iOS build + TestFlight"
say "Answer the EAS prompts as before (same Apple account, reuse credentials)."
if yes "Build iOS $VERSION and submit it to App Store Connect?"; then
  $EAS build -p ios --profile production --auto-submit
fi

bold "3/5  Android build + Play internal testing"
if [[ -f google-play-service-account.json ]]; then
  if yes "Build Android $VERSION and submit it to the Play internal track?"; then
    $EAS build -p android --profile production --auto-submit
  fi
else
  say "No google-play-service-account.json yet, so the build can't be submitted automatically."
  say "Building the .aab now; upload it by hand in Play Console → Testing → Internal testing (see docs/PLAY_STORE.md)."
  if yes "Build Android $VERSION (.aab)?"; then
    $EAS build -p android --profile production
  fi
  if yes "Also build an installable test APK (preview channel)?"; then
    $EAS build -p android --profile preview
  fi
fi

bold "4/5  Store text"
say "What's New / release notes for $VERSION are in docs/APP_STORE.md §9 and docs/PLAY_STORE.md §E."
if yes "Open App Store Connect?"; then open "https://appstoreconnect.apple.com/apps"; fi
pause "TestFlight 'What to Test' / release notes filled in"

bold "5/5  Over-the-air updates from now on"
say "Builds from $VERSION check for updates on launch (channel = build profile)."
say "JS/asset-only fixes:   npm run update:production -- \"what changed\""
say "Test on preview APKs:  npm run update:preview -- \"what changed\""
say "Anything native (new module, permission, icon, app.json plugin) needs a new build and a version bump."
bold "Done 🎉"
