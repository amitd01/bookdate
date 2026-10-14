/**
 * Book Dates: new matches as a rail of ringed covers, then conversations with
 * the book leading each row. Rows show the match's mode (Date / Friend), a
 * timestamp, an unread dot and a gentle "Your turn" when the other reader
 * wrote last. Data and unread state come from the shared inbox.
 */
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/BookCover';
import { Icon } from '@/components/Icon';
import { useTabInset } from '@/components/TabBar';
import { Ambient, Avatar, EmptyState, Eyebrow, Glass, LargeTitle, Ring, Tag } from '@/components/ui';
import { MODES } from '@/constants/modes';
import { brand, fonts, radius, space, type, type Theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useInbox } from '@/lib/inbox';
import { registerForPush, requestPushPermission } from '@/lib/push';
import { useStyles, useTheme } from '@/lib/theme';
import { formatWhen } from '@/lib/time';
import type { Match } from '@/lib/types';

const openChat = (m: Match) => router.push({ pathname: '/chat/[id]', params: { id: m.match_id } });

export default function Matches() {
  const { session, profile } = useAuth();
  const { matches, loading, refresh, isUnread } = useInbox();
  const t = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const tabInset = useTabInset();
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
      <View style={{ flex: 1, paddingTop: insets.top + 10, paddingBottom: tabInset }}>
        <Ambient />
        <LargeTitle>Book Dates</LargeTitle>
        <EmptyState icon="chats" title={`No ${tone.plural} yet`}
          body="Every book you like is a standing invitation. When a reader nearby loves the same one, you'll match here." />
      </View>
    );
  }

  const header = (
    <View style={{ gap: space(3), paddingBottom: space(1) }}>
      <LargeTitle>Book Dates</LargeTitle>
      {askPush && (
        <Glass strong style={s.nudge}>
          <View style={s.nudgeIcon}><Icon name="bell" size={18} color={t.accInk} /></View>
          <Text style={[type.bodySm, { flex: 1, color: t.ink }]}>Get a notification when a match replies.</Text>
          <Pressable accessibilityRole="button" hitSlop={6} style={s.turnOn}
            onPress={() => requestPushPermission().then(registerForPush).finally(() => setAskPush(false))}>
            <Text style={s.turnOnText}>Turn on</Text>
          </Pressable>
        </Glass>
      )}
      {fresh.length > 0 && (
        <>
          <Eyebrow style={s.section}>New · {fresh.length}</Eyebrow>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
            {fresh.map((m) => (
              <Pressable key={m.match_id} style={s.newItem} onPress={() => openChat(m)} accessibilityRole="button"
                accessibilityLabel={`New ${MODES[m.mode].noun.toLowerCase()}: ${m.other_name}, over ${m.book_title}`}>
                <View>
                  <Ring width={66} height={99} r={9}>
                    <BookCover uri={m.book_cover} title={m.book_title} style={s.newCover} radius={9} titleSize={12} />
                  </Ring>
                  <View style={s.mini}><Avatar name={m.other_name} size={30} /></View>
                </View>
                <Text style={[s.newName, isUnread(m) && { fontFamily: fonts.uiHeavy }]} numberOfLines={1}>{m.other_name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
      {talking.length > 0 && <Eyebrow style={s.section}>Conversations</Eyebrow>}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Ambient />
      <FlatList
        data={talking}
        keyExtractor={(m) => m.match_id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.acc} />}
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: tabInset + space(2) }}
        renderItem={({ item: m }) => {
          const mode = MODES[m.mode];
          const unread = isUnread(m);
          const theirTurn = m.last_sender && m.last_sender !== session?.user.id;
          return (
            <Pressable style={({ pressed }) => [s.row, pressed && { backgroundColor: t.accSoft }]} onPress={() => openChat(m)}
              accessibilityRole="button" accessibilityLabel={`${m.other_name}, ${mode.tag}. ${unread ? 'Unread. ' : ''}${m.last_message}`}>
              <View>
                <BookCover uri={m.book_cover} title={m.book_title} style={s.cover} radius={8} titleSize={10} />
                <View style={s.miniSm}><Avatar name={m.other_name} size={28} /></View>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={s.nameRow}>
                  <Text style={[s.name, unread && { fontFamily: fonts.uiHeavy }]} numberOfLines={1}>{m.other_name}, {m.other_age}</Text>
                  <Tag label={mode.tag} background={brand.tag[m.mode]} />
                </View>
                <Text style={[type.bodySm, { color: unread ? t.ink : t.ink2 }]} numberOfLines={1}>
                  {theirTurn ? <Text style={{ color: t.accInk, fontFamily: fonts.uiBold }}>Your turn · </Text> : null}
                  {m.last_message}
                </Text>
                <Text style={s.over} numberOfLines={1}>over {m.book_title}</Text>
              </View>
              <View style={s.right}>
                {m.last_message_at && <Text style={[type.caption, { fontSize: 12, color: t.ink3 }]}>{formatWhen(m.last_message_at)}</Text>}
                {unread && <View style={s.dot} />}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const make = (t: Theme) => StyleSheet.create({
  section: { paddingHorizontal: space(5), paddingTop: space(2) },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginHorizontal: space(5), padding: space(3), borderRadius: radius.lg },
  nudgeIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: t.accSoft, alignItems: 'center', justifyContent: 'center' },
  turnOn: { height: 36, paddingHorizontal: space(3.5), borderRadius: radius.pill, backgroundColor: t.acc, justifyContent: 'center' },
  turnOnText: { color: '#FFFFFF', fontFamily: fonts.uiBold, fontSize: 14 },
  carousel: { gap: space(4), paddingHorizontal: space(5), paddingVertical: space(1) },
  newItem: { alignItems: 'center', gap: space(2) },
  newCover: { width: 66, height: 99 },
  mini: { position: 'absolute', right: -6, bottom: -6, borderRadius: 18, borderWidth: 2.5, borderColor: t.bg },
  newName: { fontFamily: fonts.uiBold, fontSize: 13, color: t.ink, maxWidth: 80 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: space(2), padding: space(3), borderRadius: radius.lg },
  cover: { width: 50, height: 75 },
  miniSm: { position: 'absolute', right: -8, bottom: -6, borderRadius: 16, borderWidth: 2, borderColor: t.bg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  name: { fontFamily: fonts.uiSemi, fontSize: 16, color: t.ink, flexShrink: 1 },
  over: { fontFamily: fonts.serifItalic, fontSize: 14, color: t.ink3 },
  right: { alignItems: 'flex-end', gap: space(2), minWidth: 44 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.acc, shadowColor: t.acc, shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
});
