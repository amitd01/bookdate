#!/usr/bin/env node
/**
 * Creates the App Review demo accounts (clearly labelled test users, never
 * shown as real people):
 *   - reviewer@<domain>  : the account you give Apple in App Review notes
 *   - partner@<domain>   : a second test reader operated by the team
 * Both are placed at DEMO_LAT/DEMO_LNG (default: Apple Park, Cupertino) so the
 * reviewer is inside the 15 km radius. The partner pre-likes a handful of books,
 * the reviewer already has one match with a short chat, and swiping right on any
 * other book the partner liked ("n readers nearby loved this") matches live.
 *
 * Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_PASSWORD=... node scripts/seed-demo.mjs
 */
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD } = process.env;
const DOMAIN = process.env.DEMO_DOMAIN ?? 'bookdate.app';
const LAT = Number(process.env.DEMO_LAT ?? 37.3349);
const LNG = Number(process.env.DEMO_LNG ?? -122.009);
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !DEMO_PASSWORD) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD');
  process.exit(1);
}
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** Creates (or reuses) a confirmed user and returns a client signed in as them. */
async function signedInClient(email) {
  const { error } = await admin.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
  if (error && !/already/i.test(error.message)) throw error;
  // A normal (anon-key) client so every write goes through RLS exactly like the app.
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error: e2 } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (e2) throw e2;
  return { client, id: data.user.id };
}

async function setupReader(email, profile) {
  const r = await signedInClient(email);
  const { error } = await r.client.from('profiles').upsert({ id: r.id, ...profile });
  if (error) throw error;
  await r.client.rpc('update_location', { lat: LAT, lng: LNG });
  return r;
}

const common = { interested_in: ['woman', 'man', 'nonbinary'], age_min: 18, age_max: 99,
  genres: ['fantasy', 'classics', 'mystery', 'romance', 'science_fiction'] };
const partner = await setupReader(`partner@${DOMAIN}`, { ...common, display_name: 'Demo Reader (test account)',
  birthdate: '1994-05-01', gender: 'woman', bio: 'Test account run by the BookDate team.' });
const reviewer = await setupReader(`reviewer@${DOMAIN}`, { ...common, display_name: 'App Reviewer',
  birthdate: '1990-01-01', gender: 'man', bio: 'Demo account for App Review.' });

// Partner likes the 15 most popular books in the reviewer's genres.
const { data: books, error } = await admin.from('books').select('id,title')
  .overlaps('genres', common.genres).order('like_count', { ascending: false }).limit(15);
if (error || !books?.length) throw error ?? new Error('Seed books first: npm run seed:books');
for (const b of books) await partner.client.rpc('swipe', { p_book_id: b.id, p_liked: true });

// Reviewer likes the first one -> instant match, then a short chat.
const { data: match } = await reviewer.client.rpc('swipe', { p_book_id: books[0].id, p_liked: true });
const matchId = match?.[0]?.match_id;
if (matchId) {
  await partner.client.from('messages').insert({ match_id: matchId, sender_id: partner.id,
    body: `Hi! We both loved "${books[0].title}" — who was your favourite character?` });
}
console.log(`✅ Demo ready. Reviewer login: reviewer@${DOMAIN} / (DEMO_PASSWORD). Match: ${matchId ?? 'already existed'}`);
