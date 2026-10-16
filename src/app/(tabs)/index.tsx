/**
 * Discover: the swipe deck. Loads a personalised feed (get_feed), keeps a
 * small buffer topped up, records swipes and celebrates new matches.
 *   - "Browsing" narrows the deck to one genre until the app is closed (#8).
 *   - Search lives in the header (see (tabs)/_layout.tsx and app/search.tsx).
 *   - The nearby chip and cold-start banner say honestly how busy it is.
 * The deck is re-ranked whenever the screen gains focus or the app returns
 * to the foreground, so "readers near you" counts stay current.
 * Visuals (refresh v2): glass top bar, the top cover's halo glowing behind the
 * deck, the next card growing into place as you drag, gradient like button.
 */
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover, CoverHalo } from '@/components/BookCover';
import { GenreSheet } from '@/components/GenreSheet';
import { Icon } from '@/components/Icon';
import { MatchMoment } from '@/components/MatchMoment';
import { SwipeCard, type SwipeCardHandle } from '@/components/SwipeCard';
import { useTabInset } from '@/components/TabBar';
import { Ambient, Button, EmptyState, Glass, Gradient, IconButton } from '@/components/ui';
import { genreLabel } from '@/constants/genres';
import { fonts, radius, space, type, type Theme } from '@/constants/theme';
import { getFeed, getNearbyReaders, swipe } from '@/lib/api';
import { inviteFriend } from '@/lib/invite';
import { requestLocationPermission, syncLocation, type LocationState } from '@/lib/location';
import { useOnce } from '@/lib/once';
import { useStyles, useTheme } from '@/lib/theme';
import type { FeedBook, NearbyBucket, NewMatch } from '@/lib/types';

const REFILL_AT = 5;
const NEARBY_LABEL: Record<NearbyBucket, string> = { none: 'Just you so far', few: 'A few readers nearby', '10+': '10+ readers nearby', '50+': '50+ readers nearby' };
const NEARBY_SHORT: Record<NearbyBucket, string> = { none: 'Just you', few: 'A few nearby', '10+': '10+ nearby', '50+': '50+ nearby' };

export default function Discover() {
  const t = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const tabInset = useTabInset();
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
  const drag = useSharedValue(0); // top card's x offset, drives the next card's reveal
  const nextStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.abs(drag.get()) / 140);
    return { transform: [{ translateY: 16 - 16 * p }, { scale: 0.92 + 0.08 * p }] };
  });
  const dimStyle = useAnimatedStyle(() => ({ opacity: 0.35 - 0.35 * Math.min(1, Math.abs(drag.get()) / 140) }));
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
    latest.current++; // drop any in-flight load for the old genre
    fetching.current = false;
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

  /** Every state shares the ambient backdrop and safe-area padding. */
  const screen = (children: ReactNode) => (
    <View style={[s.screen, { paddingTop: insets.top + space(2), paddingBottom: tabInset }]}>
      <Ambient />
      {children}
    </View>
  );

  if (loc === 'undetermined') {
    return screen(
      <EmptyState icon="location" title="Find readers near you"
        body="BookDate matches you with readers close by (up to 15 km or 10 miles, you choose). Your exact location is never shown to anyone.">
        <Button title="Allow location" onPress={() => requestLocationPermission()
          // Show the deck as soon as permission is granted; the position uploads in the background.
          .then((st) => { setLoc(st); if (st === 'granted') syncLocation(false).catch(() => undefined); })
          .catch(() => undefined)} />
      </EmptyState>
    );
  }
  if (loc === 'denied') {
    return screen(
      <EmptyState icon="location" title="Location is off"
        body="BookDate only matches readers close to you (up to 15 km or 10 miles). Turn on location for BookDate in Settings to see who's nearby.">
        <Button title="Open Settings" onPress={() => Linking.openSettings()} />
      </EmptyState>
    );
  }
  if (loading) return screen(<View style={s.center}><ActivityIndicator color={t.acc} /></View>);
  if (failed && deck.length === 0) {
    return screen(
      <EmptyState icon="books" title="Couldn't reach BookDate" body="Check your internet connection and try again.">
        <Button title="Try again" variant="secondary" onPress={() => { setLoading(true); load('refresh', genre); }} />
      </EmptyState>
    );
  }

  const header = (
    <View style={s.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel={genre ? `Browsing ${genreLabel(genre)}. Change genre` : 'Browsing: for you. Change genre'}
        hitSlop={4} onPress={() => setPicking(true)} style={{ flexShrink: 1 }}>
        <Glass strong fill={genre ? t.accSoft : undefined} border={genre ? 'transparent' : undefined} style={s.pill}>
          <Icon name="browse" size={14} color={genre ? t.accInk : t.ink} />
          <Text style={[s.pillText, genre && { color: t.accInk }]} numberOfLines={1}>{genre ? genreLabel(genre) : 'For you'}</Text>
          <Icon name="chevronDown" size={12} color={genre ? t.accInk : t.ink} />
        </Glass>
      </Pressable>
      {genre && (
        <Pressable accessibilityRole="button" accessibilityLabel="Back to For you" hitSlop={8} onPress={() => browse(null)} style={s.clear}>
          <Icon name="close" size={20} color={t.accInk} />
        </Pressable>
      )}
      <View style={{ flex: 1 }} />
      {nearby && (
        <View style={s.nearby} accessible accessibilityLabel={NEARBY_LABEL[nearby]}>
          <Icon name="people" size={13} color={t.gold} />
          <Text style={s.nearbyText}>{NEARBY_SHORT[nearby]}</Text>
        </View>
      )}
      <IconButton icon="search" label="Search for a book" size={40} onPress={() => router.push('/search')} />
    </View>
  );

  const sheets = (
    <>
      <GenreSheet visible={picking} genre={genre} onPick={browse} onClose={() => setPicking(false)} />
      <MatchMoment moment={moment} onClose={() => setMoment(null)} />
    </>
  );

  if (deck.length === 0) {
    return screen(
      <>
        {header}
        <EmptyState icon="book"
          title={genre ? `That's every ${genreLabel(genre)} cover, for now.` : "You've read the whole shelf, for now."}
          body="Every book you liked is a standing invitation. When a reader nearby loves it too, you'll match — even weeks from now.">
          {genre
            ? <Button title="Back to For you" onPress={() => browse(null)} />
            : <Button title="Browse another genre" onPress={() => setPicking(true)} />}
          <Button title="Search for a book you love" variant="secondary" onPress={() => router.push('/search')} />
          <Button title="Invite a friend who reads" variant="ghost" onPress={inviteFriend} />
        </EmptyState>
        {sheets}
      </>
    );
  }

  const card = deck[0];
  return screen(
    <>
      {header}
      {nearby === 'none' && !bannerClosed && (
        <Glass strong style={s.banner}>
          <Icon name="people" size={18} color={t.gold} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.label, { color: t.ink }]}>You&apos;re one of the first readers here.</Text>
            <Text style={[type.caption, { color: t.ink2 }]}>Your likes are saved. When someone nearby loves the same book, you&apos;ll match, even weeks from now.</Text>
            <Pressable accessibilityRole="button" onPress={inviteFriend} hitSlop={8}><Text style={s.bannerLink}>Invite a reader</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={12} onPress={() => setBannerClosed(true)}>
            <Icon name="pass" size={16} color={t.ink3} />
          </Pressable>
        </Glass>
      )}
      <View style={s.deck}>
        <CoverHalo key={`halo-${card.id}`} uri={card.cover_url} style={{ margin: -20 }} />
        {/* The next card waits underneath and grows into place as the top card is dragged away. */}
        {deck[1] && (
          <Animated.View style={[StyleSheet.absoluteFill, nextStyle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <BookCover uri={deck[1].cover_url} title={deck[1].title} author={deck[1].author} style={{ flex: 1 }} radius={radius.card} titleSize={40} />
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg, borderRadius: radius.card }, dimStyle]} />
          </Animated.View>
        )}
        <SwipeCard key={card.id} ref={top} book={card} onSwiped={onSwiped} drag={drag} />
      </View>

      {!coachDone && card.nearby_likes > 0 && (
        <Pressable onPress={finishCoach} accessibilityRole="button" accessibilityHint="Dismisses this tip">
          <Glass strong style={s.coach}>
            <Icon name="sparkles" size={16} color={t.gold} />
            <Text style={[type.caption, { color: t.ink, flex: 1 }]}>
              Readers near you loved this. <Text style={{ fontFamily: fonts.uiBold }}>Like it to match with them instantly.</Text>
            </Text>
          </Glass>
        </Pressable>
      )}

      <View style={s.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Pass" onPress={() => top.current?.swipe(false)} style={({ pressed }) => pressed && { transform: [{ scale: 0.94 }] }}>
          <Glass strong style={s.pass}><Icon name="pass" size={26} color={t.pass} /></Glass>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Like" onPress={() => top.current?.swipe(true)} style={({ pressed }) => [s.likeHalo, pressed && { transform: [{ scale: 0.94 }] }]}>
          <Gradient style={s.like}><Icon name="heart" size={32} color="#FFFFFF" /></Gradient>
        </Pressable>
      </View>
      {sheets}
    </>
  );
}

const make = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(5), gap: space(3) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 44, flexDirection: 'row', alignItems: 'center', gap: space(2), zIndex: 1 },
  pill: { height: 40, flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(3.5), borderRadius: radius.pill },
  pillText: { fontFamily: fonts.uiBold, fontSize: 14, color: t.ink, flexShrink: 1 },
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  nearby: {
    height: 34, flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(3), borderRadius: radius.pill,
    backgroundColor: t.goldSoft, borderWidth: 1, borderColor: 'rgba(255,176,32,0.45)',
    shadowColor: 'rgb(255,176,32)', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
  },
  nearbyText: { fontFamily: fonts.uiBold, fontSize: 13, color: t.gold },
  banner: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start', borderRadius: radius.lg, padding: space(3) },
  bannerLink: { color: t.accInk, fontFamily: fonts.uiBold, fontSize: 14, marginTop: space(1) },
  deck: { flex: 1, marginTop: space(2) },
  coach: { flexDirection: 'row', alignItems: 'center', gap: space(2), borderRadius: radius.lg, padding: space(3) },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 36, paddingVertical: space(1), marginBottom: 14 - space(3) },
  pass: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  likeHalo: {
    padding: 6, borderRadius: 45, backgroundColor: t.accSoft,
    shadowColor: t.acc, shadowOpacity: 0.55, shadowRadius: 22, shadowOffset: { width: 0, height: 10 },
  },
  like: { width: 78, height: 78, borderRadius: 39, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
});
