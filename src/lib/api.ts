/**
 * Thin, typed data layer over Supabase. Screens never talk to Supabase
 * directly, so the backend can evolve (or be swapped) behind this file.
 * Every function throws on error; callers show a friendly message.
 */
import { analytics } from './analytics';
import { supabase } from './supabase';
import type { FeedBook, Match, Message, NearbyBucket, NewMatch, Profile, ProfileInput, ReportReason, SearchBook } from './types';

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

async function uid() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

// ---------------------------------------------------------------- profile ---

export async function getMyProfile(): Promise<Profile | null> {
  const id = await uid();
  return unwrap(await supabase.from('profiles')
    .select('id,display_name,birthdate,gender,interested_in,looking_for,age_min,age_max,max_km,distance_unit,genres,bio')
    .eq('id', id).maybeSingle());
}

export async function saveProfile(input: ProfileInput): Promise<void> {
  const id = await uid();
  unwrap(await supabase.from('profiles').upsert({ id, ...input }));
}

export async function updateLocation(lat: number, lng: number) {
  unwrap(await supabase.rpc('update_location', { lat, lng }));
}

export async function savePushToken(token: string | null) {
  const id = await uid();
  unwrap(await supabase.from('profiles').update({ push_token: token }).eq('id', id));
}

export async function deleteAccount() {
  unwrap(await supabase.rpc('delete_account'));
  analytics.track('account_deleted');
  await supabase.auth.signOut();
}

// ------------------------------------------------------------ discovery ---

/** Personalised deck; `genre` narrows it while browsing another genre. */
export async function getFeed(limit = 20, genre: string | null = null): Promise<FeedBook[]> {
  return unwrap(await supabase.rpc('get_feed', { p_limit: limit, p_genre: genre })) ?? [];
}

/**
 * Records a swipe (or a like from search). Resolves to every match it made:
 * one like can match several nearby readers who loved the same book.
 */
export async function swipe(book: Pick<FeedBook, 'id' | 'genres' | 'nearby_likes'>, liked: boolean, source: 'deck' | 'search' = 'deck') {
  const matches = (unwrap(await supabase.rpc('swipe', { p_book_id: book.id, p_liked: liked })) ?? []) as NewMatch[];
  analytics.track('book_swiped', { liked, source, book_id: book.id, genres: book.genres, nearby_likes: book.nearby_likes });
  if (matches.length) analytics.track('match_created', { book_id: book.id, count: matches.length, mode: matches[0].mode });
  return matches;
}

/** Catalogue search by title or author (2+ characters). */
export async function searchBooks(query: string): Promise<SearchBook[]> {
  return unwrap(await supabase.rpc('search_books', { p_query: query, p_limit: 20 })) ?? [];
}

/**
 * Adds an Open Library work to the catalogue so it can be liked; returns its id.
 * Only the work key (and our genre guess) is sent: the server fetches the
 * title, author and cover from Open Library itself.
 */
export async function addBook(b: Pick<SearchBook, 'ol_key' | 'genres'>): Promise<number> {
  return unwrap(await supabase.rpc('add_book', { p_ol_key: b.ol_key, p_genres: b.genres })) as number;
}

export async function getNearbyReaders(): Promise<NearbyBucket> {
  return unwrap(await supabase.rpc('nearby_readers')) as NearbyBucket;
}

// -------------------------------------------------------- matches & chat ---

export async function getMatches(): Promise<Match[]> {
  return unwrap(await supabase.rpc('get_matches')) ?? [];
}

export async function getMessages(matchId: string): Promise<Message[]> {
  return unwrap(await supabase.from('messages').select('*')
    .eq('match_id', matchId).order('created_at', { ascending: true }).limit(500)) ?? [];
}

export async function sendMessage(matchId: string, body: string): Promise<Message> {
  const sender_id = await uid();
  const msg = unwrap(await supabase.from('messages')
    .insert({ match_id: matchId, sender_id, body: body.trim() }).select().single()) as Message;
  analytics.track('message_sent', { length: body.length });
  return msg;
}

/** Live stream of new messages in one match (RLS-filtered server side). */
export function subscribeToMessages(matchId: string, onMessage: (m: Message) => void) {
  const channel = supabase
    .channel(`match:${matchId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
      (payload) => onMessage(payload.new as Message))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/** Fires on any change to the user's matches or a new message in them (lists, badges). */
export function subscribeToMatches(onChange: () => void) {
  const channel = supabase
    .channel('my-matches')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ---------------------------------------------------------------- safety ---

/**
 * Removes the person for good (a silent block: you never match again, on any
 * book) and deletes the chat for both. Your like on the book stays, so it can
 * still match you with other readers.
 */
export async function unmatch(matchId: string) {
  unwrap(await supabase.rpc('unmatch', { p_match_id: matchId }));
  analytics.track('unmatched');
}

/** Files a report for the safety team and unmatches, in one step (same rules as above). */
export async function reportAndUnmatch(matchId: string, reason: ReportReason, details?: string) {
  unwrap(await supabase.rpc('report_and_unmatch', { p_match_id: matchId, p_reason: reason, p_details: details ?? null }));
  analytics.track('user_reported', { reason, with_details: !!details?.trim() });
}
