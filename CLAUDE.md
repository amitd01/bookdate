# CLAUDE.md — BookDate

## What this project is
"Tinder for book lovers": swipe on book covers; a mutual like on the same book
within range opens a two-person book club chat. Expo (React Native) + Supabase,
shipped to both stores through EAS. v1.2.0 (visual refresh v2) is in TestFlight and Play internal testing; store production release is next.

## Where the rules live
- `AGENTS.md` — the engineering rules for this codebase (Expo versioning, Expo
  Router, commands, lint/typecheck before done). **It is authoritative; this file
  only points at it.**
- `BACKLOG.md` — what is next, in priority order.
- `docs/` — design notes and runbooks.
- `supabase/` — schema, migrations, RLS, SQL KPI views; `scripts/` — seeders.

## Session protocol
1. Read `HANDOVER.md`, then `BACKLOG.md`, then `AGENTS.md` (including **Secrets — never commit**).
2. Check `expo` major in `package.json` before touching any Expo API.
3. `npx expo lint && npx tsc --noEmit` before declaring a task done; CI (`.github/workflows/ci.yml`) runs the same.
4. Record anything that cost >15 min in `LEARNINGS.md`.

## Commit convention
Short imperative summary, PR number in parentheses when merged via PR
("seed-books: find modern works via the search API (#7)").
