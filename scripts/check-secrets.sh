#!/usr/bin/env bash
# Flags secrets and private files before they reach git.
#   scripts/check-secrets.sh          -> checks staged files (pre-commit hook)
#   scripts/check-secrets.sh --all    -> checks every tracked file (CI)
# Exits 1 and names the offending files if any match. See AGENTS.md "Secrets".
set -euo pipefail

# Paths that must never be committed (extended regex, matched against the path).
BLOCKED='(^|/)(google-services\.json|GoogleService-Info\.plist|google-play-service-account\.json|[^/]*firebase-adminsdk[^/]*\.json|[^/]*service[-_]?account[^/]*\.json|\.env(\.[^/]*)?|[^/]*\.(jks|keystore|p8|p12|pem|key|mobileprovision))$|(^|/)design_handoff[^/]*/|(^|/)[^/]*\.zip$'
ALLOWED='(^|/)\.env\.example$'
# Content that looks like a private key or a Google service-account file.
CONTENT='-----BEGIN [A-Z ]*PRIVATE KEY-----|"type": *"service_account"'

if [[ "${1:-}" == "--all" ]]; then files=$(git ls-files); else files=$(git diff --cached --name-only --diff-filter=ACMR); fi

bad=$(printf '%s\n' "$files" | grep -E "$BLOCKED" | grep -Ev "$ALLOWED" || true)
for f in $files; do
  [[ -f "$f" ]] && [[ "$f" != scripts/check-secrets.sh ]] && grep -Eq -- "$CONTENT" "$f" && bad+=$'\n'"$f (contains a private key)"
done
bad=$(printf '%s\n' "$bad" | sed '/^$/d')

if [[ -n "$bad" ]]; then
  echo "✋ Secret / private files blocked (see AGENTS.md → Secrets):" >&2
  printf '%s\n' "$bad" | sed 's/^/   /' >&2
  echo "Unstage them (git restore --staged <file>) and keep them in EAS env/credentials instead." >&2
  exit 1
fi
