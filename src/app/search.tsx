/**
 * Search for a specific book (#9). Results come from the BookDate catalogue
 * first, then Open Library for anything not in it yet. The heart likes a
 * book directly, exactly like a right swipe, so it can match instantly.
 */
import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { Icon } from '@/components/Icon';
import { MatchMoment } from '@/components/MatchMoment';
import { nearbyText } from '@/components/SwipeCard';
import { MODES } from '@/constants/modes';
import { colors, radius, space, TOUCH, type } from '@/constants/theme';
import { analytics } from '@/lib/analytics';
import { addBook, searchBooks, swipe } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { searchOpenLibrary } from '@/lib/openlibrary';
import type { NewMatch, SearchBook } from '@/lib/types';

const DEBOUNCE_MS = 350;

export default function Search() {
  const { profile } = useAuth();
  const mode = MODES[profile?.looking_for ?? 'dating'];
  const [query, setQuery] = useState('');
  const [catalogue, setCatalogue] = useState<SearchBook[]>([]);
  const [openLibrary, setOpenLibrary] = useState<SearchBook[]>([]);
  const [busy, setBusy] = useState(false);
  const [liking, setLiking] = useState<string | null>(null);
  const [moment, setMoment] = useState<{ book: SearchBook; matches: NewMatch[] } | null>(null);

  // Debounced search; an aborted (superseded) query never overwrites newer results.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return; // results are hidden below 2 characters
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      const [mine, ol] = await Promise.allSettled([searchBooks(q), q.length >= 3 ? searchOpenLibrary(q, ctrl.signal) : Promise.resolve([])]);
      if (ctrl.signal.aborted) return;
      const found = mine.status === 'fulfilled' ? mine.value : [];
      const known = new Set(found.map((b) => b.ol_key));
      setCatalogue(found);
      setOpenLibrary(ol.status === 'fulfilled' ? ol.value.filter((b) => !known.has(b.ol_key)) : []);
      setBusy(false);
      analytics.track('book_searched', { results: found.length });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query]);

  const like = async (book: SearchBook) => {
    if (book.liked || liking) return;
    setLiking(book.ol_key);
    try {
      const id = book.id ?? await addBook(book as SearchBook & { cover_id: number });
      const matches = await swipe({ id, genres: book.genres, nearby_likes: book.nearby_likes }, true, 'search');
      const mark = (list: SearchBook[]) => list.map((b) => (b.ol_key === book.ol_key ? { ...b, id, liked: true } : b));
      setCatalogue(mark);
      setOpenLibrary(mark);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (matches.length) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMoment({ book, matches });
      }
    } catch (e) {
      Alert.alert("Couldn't like that book", errorMessage(e));
    } finally {
      setLiking(null);
    }
  };

  const q = query.trim();
  const sections = q.length < 2 ? [] : [
    { title: 'On BookDate', data: catalogue },
    { title: 'From Open Library', data: openLibrary },
  ].filter((sec) => sec.data.length > 0);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Search' }} />
      <View style={s.searchBox}>
        <Icon name="search" size={16} color={colors.ink3} />
        <TextInput style={s.input} value={query} onChangeText={setQuery} autoFocus placeholder="Title or author"
          placeholderTextColor={colors.ink3} returnKeyType="search" autoCorrect={false} accessibilityLabel="Search by title or author" />
        {busy && <ActivityIndicator color={mode.color} />}
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(b) => b.ol_key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space(10) }}
        renderSectionHeader={({ section }) => <Text style={s.section} accessibilityRole="header">{section.title}</Text>}
        ListEmptyComponent={
          <Text style={[type.body, s.hint]}>
            {q.length < 2 ? 'Search for a book you love. If a reader nearby loved it too, liking it matches you instantly.'
              : busy ? '' : `No books with a cover found for "${q}".`}
          </Text>
        }
        renderItem={({ item: b }) => (
          <View style={s.row}>
            <BookCover uri={b.cover_url} title={b.title} author={b.author} style={s.cover} radius={4} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={2}>{b.title}</Text>
              <Text style={type.small} numberOfLines={1}>{[b.author, b.first_published].filter(Boolean).join(' · ')}</Text>
              {b.nearby_likes > 0 && <Text style={s.nearby}>{nearbyText(b.nearby_likes)}</Text>}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={b.liked ? `You like ${b.title}` : `Like ${b.title}`}
              accessibilityState={{ selected: b.liked, busy: liking === b.ol_key }} onPress={() => like(b)}
              style={[s.heart, { borderColor: mode.color }, b.liked && { backgroundColor: mode.color }]}>
              {liking === b.ol_key ? <ActivityIndicator color={mode.color} />
                : <Icon name={b.liked ? 'heart' : 'heartOutline'} size={20} color={b.liked ? '#fff' : mode.color} />}
            </Pressable>
          </View>
        )}
      />
      <MatchMoment moment={moment} onClose={() => setMoment(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: space(2), margin: space(4), paddingHorizontal: space(3), minHeight: TOUCH, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.card },
  input: { flex: 1, fontSize: 17, color: colors.ink, paddingVertical: space(2.5) },
  section: { ...type.overline, color: colors.ink3, paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: space(2), backgroundColor: colors.paper },
  hint: { color: colors.inkMuted, textAlign: 'center', padding: space(8) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(2) },
  cover: { width: 44, height: 66 },
  nearby: { fontSize: 13, fontWeight: '700', color: colors.gilt },
  heart: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
