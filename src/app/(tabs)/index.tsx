/**
 * Discover: the swipe deck. Loads a personalised feed (get_feed), keeps a
 * small buffer topped up, records swipes and celebrates new matches.
 */
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { SwipeCard, type SwipeCardHandle } from '@/components/SwipeCard';
import { Button, EmptyState } from '@/components/ui';
import { RADIUS_KM } from '@/constants/genres';
import { colors, radius, space, type } from '@/constants/theme';
import { getFeed, swipe } from '@/lib/api';
import { syncLocation, type LocationState } from '@/lib/location';
import type { FeedBook } from '@/lib/types';

const REFILL_AT = 5;

type NewMatch = { matchId: string; name: string; book: FeedBook };

export default function Discover() {
  const [deck, setDeck] = useState<FeedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [loc, setLoc] = useState<LocationState>('granted');
  const [match, setMatch] = useState<NewMatch | null>(null);
  const top = useRef<SwipeCardHandle>(null);
  const fetching = useRef(false);

  /** Appends fresh books, skipping any already in the deck. */
  const refill = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const books = await getFeed(20);
      setDeck((cur) => [...cur, ...books.filter((b) => !cur.some((c) => c.id === b.id))]);
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, []);

  // On focus: refresh location first (the feed's "nearby" signals depend on
  // it), then top up the deck. refill() de-duplicates, so this is idempotent.
  useFocusEffect(useCallback(() => {
    syncLocation().then(setLoc).catch(() => undefined).finally(refill);
  }, [refill]));

  const onSwiped = async (liked: boolean) => {
    const book = deck[0];
    if (!book) return;
    setDeck((cur) => cur.slice(1));
    if (deck.length - 1 < REFILL_AT) refill();
    Haptics.impactAsync(liked ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    try {
      const m = await swipe(book, liked);
      if (m) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMatch({ matchId: m.match_id, name: m.other_name, book });
      }
    } catch {
      // Network hiccup: the book will simply reappear in a later feed.
    }
  };

  if (loc === 'denied') {
    return (
      <EmptyState emoji="📍" title="Location needed"
        body={`BookDate only matches readers within ${RADIUS_KM} km. Allow location access so we can find book lovers near you.`}>
        <Button title="Open Settings" onPress={() => Linking.openSettings()} />
      </EmptyState>
    );
  }
  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} /></View>;
  if (deck.length === 0) {
    return (
      <EmptyState emoji="🌙" title="You've reached the last page"
        body="No new covers right now. Check back soon — new readers and books arrive every day.">
        <Button title="Refresh" variant="secondary" onPress={() => { setLoading(true); refill(); }} />
      </EmptyState>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.deck}>
        {/* Render the next card underneath for a seamless reveal. */}
        {deck[1] && (
          <View style={[StyleSheet.absoluteFill, s.under]}>
            <BookCover uri={deck[1].cover_url} title={deck[1].title} author={deck[1].author} style={{ flex: 1 }} radius={radius.lg} />
          </View>
        )}
        <SwipeCard key={deck[0].id} ref={top} book={deck[0]} onSwiped={onSwiped} />
      </View>

      <View style={s.actions}>
        <Pressable accessibilityLabel="Pass" style={[s.round, { borderColor: colors.pass }]} onPress={() => top.current?.swipe(false)}>
          <Text style={[s.glyph, { color: colors.pass }]}>✕</Text>
        </Pressable>
        <Pressable accessibilityLabel="Like" style={[s.round, s.like]} onPress={() => top.current?.swipe(true)}>
          <Text style={[s.glyph, { color: '#fff' }]}>♥</Text>
        </Pressable>
      </View>

      <Modal visible={!!match} transparent animationType="fade" onRequestClose={() => setMatch(null)}>
        {match && (
          <View style={s.overlay}>
            <Text style={s.matchTitle}>It&apos;s a book date!</Text>
            <Text style={[type.body, s.matchBody]}>You and {match.name} both loved</Text>
            <BookCover uri={match.book.cover_url} title={match.book.title} style={s.matchCover} />
            <Text style={[type.h2, { color: '#fff', textAlign: 'center' }]}>{match.book.title}</Text>
            <Button title="Start the book club" style={{ alignSelf: 'stretch' }} onPress={() => {
              setMatch(null);
              router.push({ pathname: '/chat/[id]', params: { id: match.matchId } });
            }} />
            <Button title="Keep swiping" variant="ghost" style={{ alignSelf: 'stretch' }} onPress={() => setMatch(null)} />
          </View>
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, padding: space(4), gap: space(4) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  deck: { flex: 1 },
  under: { transform: [{ scale: 0.95 }, { translateY: 10 }], opacity: 0.6 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: space(10), paddingBottom: space(2) },
  round: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  like: { backgroundColor: colors.accent, borderColor: colors.accent },
  glyph: { fontSize: 30, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(31,27,22,0.94)', alignItems: 'center', justifyContent: 'center', padding: space(8), gap: space(4) },
  matchTitle: { ...type.title, color: '#fff', fontSize: 36 },
  matchBody: { color: '#E8DFD2' },
  matchCover: { width: 160, height: 240 },
});
