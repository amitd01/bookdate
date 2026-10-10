/**
 * Thin, typed data layer over Supabase. Screens never talk to Supabase
 * directly, so the backend can evolve (or be swapped) behind this file.
 * Every function throws on error; callers show a friendly message.
 */
import { analytics } from './analytics';
import { supabase } from './supabase';
import type { FeedBook, Match, Message, Profile, ProfileInput, ReportReason } from './types';

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
    .select('id,display_name,birthdate,gender,interested_in,age_min,age_max,max_km,distance_unit,genres,bio')
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

export async function getFeed(limit = 20): Promise<FeedBook[]> {
  return unwrap(await supabase.rpc('get_feed', { p_limit: limit })) ?? [];
}

/** Records a swipe; resolves to the new match (if the swipe created one). */
export async function swipe(book: FeedBook, liked: boolean) {
  const rows = unwrap(await supabase.rpc('swipe', { p_book_id: book.id, p_liked: liked })) as
    { match_id: string; other_name: string }[] | null;
  const match = rows?.[0] ?? null;
  analytics.track('book_swiped', { liked, book_id: book.id, genres: book.genres, nearby_likes: book.nearby_likes });
  if (match) analytics.track('match_created', { book_id: book.id });
  return match;
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

/** Fires whenever the user gets a new match (to refresh lists / badges). */
export function subscribeToMatches(onChange: () => void) {
  const channel = supabase
    .channel('my-matches')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ---------------------------------------------------------------- safety ---

export async function unmatch(matchId: string) {
  unwrap(await supabase.from('matches').delete().eq('id', matchId));
  analytics.track('unmatched');
}

export async function blockUser(userId: string) {
  unwrap(await supabase.rpc('block_user', { p_user_id: userId }));
  analytics.track('user_blocked');
}

export async function reportUser(userId: string, reason: ReportReason, details?: string) {
  const reporter_id = await uid();
  unwrap(await supabase.from('reports').insert({ reporter_id, reported_id: userId, reason, details }));
  analytics.track('user_reported', { reason });
}
