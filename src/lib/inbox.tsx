/**
 * Inbox: the match list plus what's unread, shared by the Book Dates tab,
 * its tab badge and the chat screen. Kept live by Realtime (RLS limits events
 * to the reader's own matches) and refreshed on app foreground.
 *
 * "Seen" marks are stored on the device per account, as server timestamps
 * (the newest message, or the match time) so device clock skew can't matter.
 * A match is unread when the other reader wrote after the mark, or when it's
 * a new match nobody has opened. Rendered for everyone; idle when signed out.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getMatches, subscribeToMatches } from './api';
import { toMs } from './time';
import type { Match } from './types';

type Seen = Record<string, string>; // match_id -> server timestamp last seen
const keyFor = (userId: string) => `inbox.seen.v1:${userId}`;

type Inbox = {
  matches: Match[];
  loading: boolean;
  refresh: () => void;
  isUnread: (m: Match) => boolean;
  unreadCount: number;
  /** Marks a chat as read up to `at` (a server timestamp). */
  markSeen: (matchId: string, at: string) => void;
};

const InboxContext = createContext<Inbox | null>(null);

export function InboxProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  // State is tagged with its owner, so switching accounts never shows the previous reader's data.
  const [list, setList] = useState<{ owner: string | null; matches: Match[] }>({ owner: null, matches: [] });
  const [seenState, setSeenState] = useState<{ owner: string | null; seen: Seen }>({ owner: null, seen: {} });
  const pending = useRef<Seen>({}); // marks made before the stored map finished loading
  const loadedFor = useRef<string | null>(null);

  const matches = useMemo(() => (list.owner === userId ? list.matches : []), [list, userId]);
  const seen = seenState.owner === userId ? seenState.seen : null;
  const loading = !!userId && list.owner !== userId;

  const refresh = useCallback(() => {
    if (!userId) return;
    getMatches().then((m) => setList({ owner: userId, matches: m })).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    refresh();
    const stop = subscribeToMatches(refresh);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refresh(); });
    return () => { stop(); sub.remove(); };
  }, [userId, refresh]);

  // Load this account's seen marks. First run: everything that already exists
  // counts as seen, so old chats don't all light up after an update.
  useEffect(() => {
    if (!userId) return;
    loadedFor.current = null;
    (async () => {
      const raw = await AsyncStorage.getItem(keyFor(userId)).catch(() => null);
      const stored: Seen = raw ? JSON.parse(raw)
        : Object.fromEntries((await getMatches().catch(() => [])).map((m) => [m.match_id, m.last_message_at ?? m.created_at]));
      const merged = { ...stored, ...pending.current };
      pending.current = {};
      loadedFor.current = userId;
      setSeenState({ owner: userId, seen: merged });
      AsyncStorage.setItem(keyFor(userId), JSON.stringify(merged)).catch(() => undefined);
    })();
  }, [userId]);

  const markSeen = useCallback((matchId: string, at: string) => {
    if (!userId) return;
    if (loadedFor.current !== userId) { pending.current[matchId] = at; return; }
    setSeenState((cur) => {
      const next = { ...cur.seen, [matchId]: at };
      AsyncStorage.setItem(keyFor(userId), JSON.stringify(next)).catch(() => undefined);
      return { owner: userId, seen: next };
    });
  }, [userId]);

  const isUnread = useCallback((m: Match) => {
    if (!seen) return false;
    const at = seen[m.match_id];
    if (!at) return true; // a new match nobody has opened yet
    return !!m.last_message_at && m.last_sender !== userId && toMs(m.last_message_at) > toMs(at);
  }, [seen, userId]);

  const value = useMemo<Inbox>(() => ({
    matches, loading, refresh, isUnread, markSeen,
    unreadCount: matches.filter(isUnread).length,
  }), [matches, loading, refresh, isUnread, markSeen]);

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox must be used inside <InboxProvider>');
  return ctx;
}
