# Learnings

> Things that already cost time. Check here before debugging anything odd. Add an entry for anything that took >15 minutes.

| # | Area | Learning | Where it matters |
|---|---|---|---|
| L-01 | Expo | APIs change every SDK; always read the versioned docs for the `expo` major in `package.json` rather than trusting memory. | any Expo/EAS change (`AGENTS.md`) |
| L-02 | Dependencies | `npx expo install` resolves SDK-compatible versions; `npm add` does not and breaks builds. | adding packages |
| L-03 | Catalogue | Open Library's search API finds modern works that the subjects endpoint misses; seed scripts use search. | `scripts/seed-books` (#7) |
| L-04 | UI | expo-blur glass chrome works on iOS only; Android gets a solid fallback. | visual refresh v2 (#8) |
