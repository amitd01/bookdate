/**
 * Discover: the swipe deck. Loads a personalised feed (get_feed), keeps a
 * small buffer topped up, records swipes and celebrates new matches.
 *   - "Browsing" narrows the deck to one genre until the app is closed (#8).
 *   - Search lives in the header (see (tabs)/_layout.tsx and app/search.tsx).
 *   - The nearby chip and cold-start banner say honestly how busy it is.
 * The deck is re-ranked whenever the screen gains focus or the app returns
 * to the foreground, so "readers near you" counts stay current.
 */
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { GenreSheet } from '@/components/GenreSheet';
import { Icon } from '@/components/Icon';
import { MatchMoment } from '@/components/MatchMoment';
import { SwipeCard, type SwipeCardHandle } from '@/components/SwipeCard';
import { Button, EmptyState } from '@/components/ui';
import { genreLabel } from '@/constants/genres';
import { MODES } from '@/constants/modes';
import { colors, radius, space, TOUCH, type } from '@/constants/theme';
import { getFeed, getNearbyReaders, swipe } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { inviteFriend } from '@/lib/invite';
import { requestLocationPermission, syncLocation, type LocationState } from '@/lib/location';
import { useOnce } from '@/lib/once';
import type { FeedBook, NearbyBucket, NewMatch } from '@/lib/types';

const REFILL_AT = 5;
const NEARBY_LABEL: Record<NearbyBucket, string> = { none: 'Just you so far', few: 'A few readers nearby', '10+': '10+ readers nearby', '50+': '50+ readers nearby' };

export default function Discover() {
  const { profile } = useAuth();
  const mode = MODES[profile?.looking_for ?? 'dating'];
  const [deck, setDeck] = useState<FeedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loc, setLoc] = useState<LocationState>('granted');
  const [genre, setGenre] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [nearby, setNearby] = useState<NearbyBucket | null>(null);
  const [bannerClosed, setBannerClosed] = useState(false);
  const [moment, setMoment] = useState<{ book: FeedBook; matches: NewMatch[] } | null>(null);
  const [coachDone, finishCoach] = useOnce('coach.nearby.v1');
  const top = useRef<SwipeCardHandle>(null);
  const fetching = useRef(false);
  const latest = useRef(0);

  /**
   * Fetches the feed. 'append' tops up the deck (refreshing counts on cards
   * already in it); 'refresh' re-ranks everything behind the card on screen.
   * A newer load (e.g. after changing genre) always wins over an older one.
   */
  const load = useCallback(async (how: 'append' | 'refresh', g: string | null) => {
    if (how === 'append' && fetching.current) return;
    const id = ++latest.current;
    fetching.current = true;
    try {
      const books = await getFeed(20, g);
      if (id !== latest.current) return;
      const fresh = new Map(books.map((b) => [b.id, b]));
      setFailed(false);
      setDeck((cur) => {
        if (how === 'refresh') {
          const head = cur[0] ? [fresh.get(cur[0].id) ?? cur[0]] : []; // keep the visible card
          return [...head, ...books.filter((b) => b.id !== cur[0]?.id)];
        }
        const updated = cur.map((c) => fresh.get(c.id) ?? c);
        return [...updated, ...books.filter((b) => !cur.some((c) => c.id === b.id))];
      });
    } catch {
      if (id === latest.current) setFailed(true);
    } finally {
      if (id === latest.current) { fetching.current = false; setLoading(false); }
    }
  }, []);

  // On focus, foreground and genre change: refresh location first (the feed's
  // "nearby" signals depend on it), then re-rank the deck and the nearby chip.
  useFocusEffect(useCallback(() => {
    const refresh = () => {
      syncLocation(false).then(setLoc).catch(() => undefined).finally(() => {
        load('refresh', genre);
        getNearbyReaders().then(setNearby).catch(() => undefined);
      });
    };
    refresh();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refresh(); });
    return () => sub.remove();
  }, [load, genre]));

  const browse = (g: string | null) => {
    if (g === genre) return;
    setDeck([]);
    setLoading(true);
    setGenre(g); // the focus effect re-runs and loads the new genre
  };

  const onSwiped = async (liked: boolean) => {
    const book = deck[0];
    if (!book) return;
    if (liked && book.nearby_likes > 0) finishCoach();
    setDeck((cur) => cur.slice(1));
    if (deck.length - 1 < REFILL_AT) load('append', genre);
    Haptics.impactAsync(liked ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    try {
      const matches = await swipe(book, liked);
      if (matches.length) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMoment({ book, matches });
      }
    } catch {
      // Network hiccup: the book will simply reappear in a later feed.
    }
  };

  if (loc === 'undetermined') {
    return (
      <EmptyState icon="location" title="Find readers near you"
        body="BookDate matches you with readers close by (up to 15 km or 10 miles, you choose). Your exact location is never shown to anyone.">
        <Button title="Allow location" color={mode.color} onPress={() => requestLocationPermission().then(() => syncLocation(false)).then(setLoc).catch(() => undefined)} />
      </EmptyState>
    );
  }
  if (loc === 'denied') {
    return (
      <EmptyState icon="location" title="Location is off"
        body="BookDate only matches readers close to you (up to 15 km or 10 miles). Turn on location for BookDate in Settings to see who's nearby.">
        <Button title="Open Settings" color={mode.color} onPress={() => Linking.openSettings()} />
      </EmptyState>
    );
  }
  if (loading) return <View style={s.center}><ActivityIndicator color={mode.color} /></View>;
  if (failed && deck.length === 0) {
    return (
      <EmptyState icon="books" title="Couldn't reach BookDate" body="Check your internet connection and try again.">
        <Button title="Try again" variant="secondary" onPress={() => { setLoading(true); load('refresh', genre); }} />
      </EmptyState>
    );
  }

  const header = (
    <View style={s.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel={genre ? `Browsing ${genreLabel(genre)}. Change genre` : 'Browsing: for you. Change genre'}
        hitSlop={4} style={[s.pill, genre && { backgroundColor: mode.soft, borderColor: mode.soft }]} onPress={() => setPicking(true)}>
        <Icon name="browse" size={14} color={genre ? mode.color : colors.ink} />
        <Text style={[s.pillText, genre && { color: mode.color }]} numberOfLines={1}>{genre ? `Browsing: ${genreLabel(genre)}` : 'For you'}</Text>
        {!genre && <Icon name="chevronDown" size={12} color={colors.ink} />}
      </Pressable>
      {genre && (
        <Pressable accessibilityRole="button" accessibilityLabel="Back to For you" hitSlop={8} onPress={() => browse(null)} style={s.clear}>
          <Icon name="close" size={20} color={mode.color} />
        </Pressable>
      )}
      <View style={{ flex: 1 }} />
      {nearby && (
        <View style={s.nearby} accessible accessibilityLabel={NEARBY_LABEL[nearby]}>
          <Icon name="people" size={14} color={colors.gilt} />
          <Text style={s.nearbyText}>{NEARBY_LABEL[nearby]}</Text>
        </View>
      )}
    </View>
  );

  const sheets = (
    <>
      <GenreSheet visible={picking} genre={genre} onPick={browse} onClose={() => setPicking(false)} />
      <MatchMoment moment={moment} onClose={() => setMoment(null)} />
    </>
  );

  if (deck.length === 0) {
    return (
      <View style={s.screen}>
        {header}
        <EmptyState icon="lamp"
          title={genre ? `That's every ${genreLabel(genre)} cover, for now.` : "You've read the whole shelf, for now."}
          body="Every book you liked is a standing invitation: when a reader nearby loves it too, you'll match, even weeks from now.">
          {genre
            ? <Button title="Back to For you" color={mode.color} onPress={() => browse(null)} />
            : <Button title="Browse another genre" color={mode.color} onPress={() => setPicking(true)} />}
          <Button title="Search for a book you love" variant="secondary" onPress={() => router.push('/search')} />
          <Button title="Invite a friend who reads" variant="ghost" color={mode.color} onPress={inviteFriend} />
        </EmptyState>
        {sheets}
      </View>
    );
  }

  const card = deck[0];
  return (
    <View style={s.screen}>
      {header}
      {nearby === 'none' && !bannerClosed && (
        <View style={s.banner}>
          <Icon name="people" size={18} color={colors.gilt} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.body, { fontWeight: '700' }]}>You&apos;re one of the first readers here.</Text>
            <Text style={type.small}>Your likes are saved. When someone nearby loves the same book, you&apos;ll match, even weeks from now.</Text>
            <Pressable accessibilityRole="button" onPress={inviteFriend} hitSlop={8}><Text style={s.bannerLink}>Invite a reader</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={12} onPress={() => setBannerClosed(true)}>
            <Icon name="pass" size={16} color={colors.ink3} />
          </Pressable>
        </View>
      )}
      <View style={s.deck}>
        {/* Render the next card underneath for a seamless reveal. */}
        {deck[1] && (
          <View style={[StyleSheet.absoluteFill, s.under]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <BookCover uri={deck[1].cover_url} title={deck[1].title} author={deck[1].author} style={{ flex: 1 }} radius={radius.lg} />
          </View>
        )}
        <SwipeCard key={card.id} ref={top} book={card} onSwiped={onSwiped} likeColor={mode.color} />
      </View>

      {!coachDone && card.nearby_likes > 0 && (
        <Pressable style={s.coach} onPress={finishCoach} accessibilityRole="button" accessibilityHint="Dismisses this tip">
          <Icon name="sparkles" size={16} color={colors.gilt} />
          <Text style={[type.small, { color: colors.ink, flex: 1 }]}>
            Readers near you loved this. <Text style={{ fontWeight: '700' }}>Like it to match with them instantly.</Text>
          </Text>
        </Pressable>
      )}

      <View style={s.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Pass" style={[s.round, { borderColor: colors.pass }]} onPress={() => top.current?.swipe(false)}>
          <Icon name="pass" size={28} color={colors.pass} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Like" style={[s.round, { backgroundColor: mode.color, borderColor: mode.color }]} onPress={() => top.current?.swipe(true)}>
          <Icon name="heart" size={30} color="#fff" />
        </Pressable>
      </View>
      {sheets}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, padding: space(4), paddingTop: space(2), gap: space(3) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  pill: { minHeight: TOUCH - 8, flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(3), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.card, flexShrink: 1 },
  pillText: { fontSize: 14, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  clear: { width: TOUCH - 8, height: TOUCH - 8, alignItems: 'center', justifyContent: 'center' },
  nearby: { flexDirection: 'row', alignItems: 'center', gap: space(1), backgroundColor: colors.giltSoft, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1.5) },
  nearbyText: { fontSize: 13, fontWeight: '700', color: colors.gilt },
  banner: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start', backgroundColor: colors.giltSoft, borderRadius: radius.md, padding: space(3) },
  bannerLink: { color: colors.gilt, fontWeight: '700', fontSize: 14, marginTop: space(1) },
  deck: { flex: 1 },
  under: { transform: [{ scale: 0.95 }, { translateY: 10 }], opacity: 0.6 },
  coach: { flexDirection: 'row', alignItems: 'center', gap: space(2), backgroundColor: colors.giltSoft, borderRadius: radius.md, padding: space(3) },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: space(10), paddingBottom: space(2) },
  round: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
});
