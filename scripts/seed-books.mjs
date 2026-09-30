#!/usr/bin/env node
/**
 * Seeds / refreshes the `books` catalogue from Open Library (free, no API key).
 * For every genre in src/constants/genres.json it pulls the top works of the
 * matching Open Library subject and upserts them (genres are merged when a
 * work appears under several subjects). Only works with a cover are kept —
 * this is a cover-swiping app.
 *
 * Usage:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:books [-- --per-genre 120]
 * Safe to re-run any time (idempotent upsert on ol_key).
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const perGenre = Number(process.argv[process.argv.indexOf('--per-genre') + 1]) || 100;
const genres = JSON.parse(readFileSync(new URL('../src/constants/genres.json', import.meta.url)));
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** ol_key -> book row; lets one work collect several genres. */
const books = new Map();

for (const g of genres) {
  const url = `https://openlibrary.org/subjects/${g.subject}.json?limit=${perGenre}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'BookDate/1.0 (seed script)' } });
  if (!res.ok) { console.warn(`skip ${g.slug}: HTTP ${res.status}`); continue; }
  const { works = [] } = await res.json();
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
  console.log(`${g.label.padEnd(20)} ${kept} new works`);
}

const rows = [...books.values()].map((b) => ({ ...b, genres: [...b.genres] }));
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await db.from('books').upsert(rows.slice(i, i + 500), { onConflict: 'ol_key' });
  if (error) throw error;
}
console.log(`✅ Upserted ${rows.length} books`);
