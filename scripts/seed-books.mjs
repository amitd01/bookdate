#!/usr/bin/env node
/**
 * Seeds / refreshes the `books` catalogue from Open Library (free, no API key).
 * For every genre in src/constants/genres.json it pulls, from the matching
 * Open Library subject:
 *   1. the all-time top works (--per-genre, default 100), and
 *   2. the most-read works first published since 1990 (--modern-per-genre,
 *      default 250, via the search API), so the deck isn't dominated by classics.
 * Genres are merged when a work appears under several subjects. Only works
 * with a cover are kept — this is a cover-swiping app.
 *
 * Usage:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:books [-- --per-genre 100 --modern-per-genre 250]
 * Safe to re-run any time (idempotent upsert on ol_key).
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) || fallback : fallback;
};
const perGenre = arg('--per-genre', 100);
const modernPerGenre = arg('--modern-per-genre', 250);
const MODERN_FROM = 1990; // matches the "old book" line in get_feed's ranking
const UA = { 'User-Agent': 'BookDate/1.0 (seed script)' };
const genres = JSON.parse(readFileSync(new URL('../src/constants/genres.json', import.meta.url)));
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** ol_key -> book row; lets one work collect several genres. */
const books = new Map();

/** All-time top works of an Open Library subject (subjects API, sorted by popularity). */
async function fetchTop(subject, limit) {
  const res = await fetch(`https://openlibrary.org/subjects/${subject}.json?limit=${limit}`, { headers: UA });
  if (!res.ok) { console.warn(`skip ${subject}: HTTP ${res.status}`); return []; }
  return (await res.json()).works ?? [];
}

/**
 * Most-read works of a subject first published since 1990. Uses the search API,
 * which filters on the *work's* first publication year (the subjects API's
 * published_in matches any edition, so new reprints of classics crowd it out).
 * Results are reshaped to look like subjects-API works.
 */
async function fetchModern(subject, limit) {
  const q = `subject_key:${subject} AND first_publish_year:[${MODERN_FROM} TO ${new Date().getFullYear()}]`;
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&sort=readinglog&limit=${limit}`
    + '&fields=key,title,author_name,cover_i,first_publish_year';
  const res = await fetch(url, { headers: UA });
  if (!res.ok) { console.warn(`skip ${subject} (modern): HTTP ${res.status}`); return []; }
  const { docs = [] } = await res.json();
  return docs.map((d) => ({
    key: d.key, title: d.title, cover_id: d.cover_i, first_publish_year: d.first_publish_year,
    authors: d.author_name?.length ? [{ name: d.author_name[0] }] : [],
  }));
}

for (const g of genres) {
  const modernWorks = await fetchModern(g.subject, modernPerGenre);
  const works = [...await fetchTop(g.subject, perGenre), ...modernWorks];
  let kept = 0;
  for (const w of works) {
    if (!w.cover_id) continue;
    const existing = books.get(w.key);
    if (existing) { existing.genres.add(g.slug); continue; }
    books.set(w.key, {
      ol_key: w.key,
      title: w.title,
      author: w.authors?.[0]?.name ?? null,
      cover_url: `https://covers.openlibrary.org/b/id/${w.cover_id}-L.jpg`,
      first_published: w.first_publish_year ?? null,
      genres: new Set([g.slug]),
    });
    kept++;
  }
  console.log(`${g.label.padEnd(20)} ${String(kept).padStart(3)} new works (${modernWorks.length} modern found)`);
}

const rows = [...books.values()].map((b) => ({ ...b, genres: [...b.genres] }));
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await db.from('books').upsert(rows.slice(i, i + 500), { onConflict: 'ol_key' });
  if (error?.code === '42501') {
    console.error('Supabase refused the write: SUPABASE_SERVICE_ROLE_KEY must be the service_role (or sb_secret_…) key, not the anon/publishable key.');
    process.exit(1);
  }
  if (error) throw error;
}
const modern = rows.filter((b) => (b.first_published ?? 0) >= MODERN_FROM).length;
console.log(`✅ Upserted ${rows.length} books (${modern} first published ${MODERN_FROM} or later)`);
