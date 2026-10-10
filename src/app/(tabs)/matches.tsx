/**
 * Book Dates: new matches as a carousel of covers, then conversations with
 * the book leading each row. Rows show the match's mode (Date / Friend), a
 * timestamp, an unread dot and a gentle "Your turn" when the other reader
 * wrote last. Data and unread state come from the shared inbox.
 */
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { Icon } from '@/components/Icon';
import { Avatar, Button, EmptyState, Tag } from '@/components/ui';
import { MODES } from '@/constants/modes';
import { colors, radius, space, type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useInbox } from '@/lib/inbox';
import { registerForPush, requestPushPermission } from '@/lib/push';
import { formatWhen } from '@/lib/time';
import type { Match } from '@/lib/types';

const openChat = (m: Match) => router.push({ pathname: '/chat/[id]', params: { id: m.match_id } });

export default function Matches() {
  const { session, profile } = useAuth();
  const { matches, loading, refresh, isUnread } = useInbox();
  const [askPush, setAskPush] = useState(false);
  const tone = MODES[profile?.looking_for ?? 'dating'];

  // Readers who skipped notifications in onboarding get one contextual nudge here.
  useFocusEffect(useCallback(() => {
    refresh();
    Notifications.getPermissionsAsync().then((p) => setAskPush(p.status === 'undetermined')).catch(() => undefined);
  }, [refresh]));

  const fresh = matches.filter((m) => !m.last_message);
  const talking = matches.filter((m) => m.last_message);

  if (!loading && matches.length === 0) {
    return (
      <EmptyState icon="chats" title={`No ${tone.noun.toLowerCase()}s yet`}
        body="Every book you like is a standing invitation. When a reader nearby loves the same one, you'll match here." />
    );
  }

  const header = (
    <View style={{ gap: space(2) }}>
      {askPush && (
        <View style={s.nudge}>
          <Icon name="bell" size={18} color={tone.color} />
          <Text style={[type.small, { flex: 1, color: colors.ink }]}>Get a notification when a match replies.</Text>
          <Button title="Turn on" variant="ghost" color={tone.color} style={{ minHeight: 44, paddingHorizontal: space(2) }}
            onPress={() => requestPushPermission().then(registerForPush).finally(() => setAskPush(false))} />
        </View>
      )}
      {fresh.length > 0 && (
        <>
          <Text style={s.section} accessibilityRole="header">New · {fresh.length}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
            {fresh.map((m) => {
              const mode = MODES[m.mode];
              return (
                <Pressable key={m.match_id} style={s.newItem} onPress={() => openChat(m)} accessibilityRole="button"
                  accessibilityLabel={`New ${mode.noun.toLowerCase()}: ${m.other_name}, over ${m.book_title}`}>
                  <View style={[s.ring, { borderColor: mode.color }]}>
                    <BookCover uri={m.book_cover} title={m.book_title} style={s.newCover} radius={4} />
                    <View style={s.mini}><Avatar name={m.other_name} size={24} /></View>
                  </View>
                  <Text style={[type.small, { color: colors.ink, fontWeight: isUnread(m) ? '700' : '400' }]} numberOfLines={1}>{m.other_name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
      {talking.length > 0 && <Text style={s.section} accessibilityRole="header">Conversations</Text>}
    </View>
  );

  return (
    <FlatList
      data={talking}
      keyExtractor={(m) => m.match_id}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={tone.color} />}
      contentContainerStyle={{ paddingVertical: space(2) }}
      ItemSeparatorComponent={() => <View style={s.sep} />}
      renderItem={({ item: m }) => {
        const mode = MODES[m.mode];
        const unread = isUnread(m);
        const theirTurn = m.last_sender && m.last_sender !== session?.user.id;
        return (
          <Pressable style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.sunken }]} onPress={() => openChat(m)}
            accessibilityRole="button" accessibilityLabel={`${m.other_name}, ${mode.tag}. ${unread ? 'Unread. ' : ''}${m.last_message}`}>
            <View>
              <BookCover uri={m.book_cover} title={m.book_title} style={s.cover} radius={4} />
              <View style={s.mini}><Avatar name={m.other_name} size={22} /></View>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={s.nameRow}>
                <Text style={[type.body, { fontWeight: unread ? '800' : '600' }]} numberOfLines={1}>{m.other_name}, {m.other_age}</Text>
                <Tag label={mode.tag} color={mode.color} background={mode.soft} />
              </View>
              <Text style={[type.small, unread && { color: colors.ink, fontWeight: '600' }]} numberOfLines={1}>
                {theirTurn ? <Text style={{ color: mode.color, fontWeight: '700' }}>Your turn · </Text> : null}
                {m.last_message}
              </Text>
            </View>
            <View style={s.right}>
              {m.last_message_at && <Text style={type.small}>{formatWhen(m.last_message_at)}</Text>}
              {unread && <View style={[s.dot, { backgroundColor: mode.color }]} />}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  section: { ...type.overline, color: colors.ink3, paddingHorizontal: space(4), paddingTop: space(2) },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginHorizontal: space(4), paddingLeft: space(3), borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  carousel: { gap: space(4), paddingHorizontal: space(4), paddingVertical: space(2) },
  newItem: { width: 72, alignItems: 'center', gap: space(2) },
  ring: { borderWidth: 2.5, borderRadius: 8, padding: 3 },
  newCover: { width: 60, height: 90 },
  mini: { position: 'absolute', right: -8, bottom: -8, borderRadius: 14, borderWidth: 2, borderColor: colors.paper },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingHorizontal: space(4), paddingVertical: space(3) },
  cover: { width: 44, height: 66 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  right: { alignItems: 'flex-end', gap: space(2), minWidth: 44 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: space(4) + 44 + space(4) },
});
