/** Book Dates: everyone you've matched with, most recent conversation first. */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { Avatar, EmptyState } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { getMatches, subscribeToMatches } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Match } from '@/lib/types';

export default function Matches() {
  const { session } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getMatches().then(setMatches).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);
  useEffect(() => subscribeToMatches(load), [load]); // live updates

  if (!loading && matches.length === 0) {
    return (
      <EmptyState emoji="📖" title="No book dates yet"
        body="Swipe right on covers you love. When a reader nearby loves the same book, you'll match here." />
    );
  }

  return (
    <FlatList
      data={matches}
      keyExtractor={(m) => m.match_id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
      contentContainerStyle={{ paddingVertical: space(2) }}
      ItemSeparatorComponent={() => <View style={s.sep} />}
      renderItem={({ item: m }) => {
        const unread = m.last_sender && m.last_sender !== session?.user.id;
        return (
          <Pressable style={s.row} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: m.match_id } })}>
            <Avatar name={m.other_name} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.h2}>{m.other_name}, {m.other_age}</Text>
              <Text style={[type.small, unread && s.unread]} numberOfLines={1}>
                {m.last_message ?? `Matched over "${m.book_title}" — say hi!`}
              </Text>
            </View>
            <BookCover uri={m.book_cover} title={m.book_title} style={s.cover} radius={4} />
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3) },
  cover: { width: 36, height: 54 },
  unread: { color: colors.ink, fontWeight: '700' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: space(4) + 52 + space(3) },
});
