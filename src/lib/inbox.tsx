/**
 * Inbox: the match list plus what's unread, shared by the Book Dates tab,
 * its tab badge and the chat screen. Kept live by Realtime (RLS limits events
 * to the reader's own matches) and refreshed on app foreground.
 * "Seen" times are stored on the device: a match is unread when it has a
 * message from the other reader newer than the last time this chat was open,
 * or when it is a new match that was never opened.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getMatches, subscribeToMatches } from './api';
import { toMs } from './time';
import type { Match } from './types';

const KEY = 'inbox.seen.v1';
type Seen = Record<string, string>; // match_id -> ISO time the chat was last open

type Inbox = {
  matches: Match[];
  loading: boolean;
  refresh: () => void;
  isUnread: (m: Match) => boolean;
  unreadCount: number;
  markSeen: (matchId: string) => void;
};

const InboxContext = createContext<Inbox | null>(null);

export function InboxProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [seen, setSeen] = useState<Seen | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    getMatches().then(setMatches).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const stop = subscribeToMatches(refresh);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refresh(); });
    return () => { stop(); sub.remove(); };
  }, [refresh]);

  // Load seen times once. First run after this feature ships: everything that
  // already exists counts as seen, so old chats don't all light up.
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(KEY).catch(() => null), getMatches().catch(() => [])]).then(([raw, existing]) => {
      if (raw) return setSeen(JSON.parse(raw));
      const all = Object.fromEntries(existing.map((m) => [m.match_id, new Date().toISOString()]));
      setSeen(all);
      AsyncStorage.setItem(KEY, JSON.stringify(all)).catch(() => undefined);
    });
  }, []);

  const markSeen = useCallback((matchId: string) => {
    setSeen((cur) => {
      const next = { ...cur, [matchId]: new Date().toISOString() };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

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
