/**
 * The two-person book club. Shows the book that sparked the match, the
 * partner's reading profile, discussion prompts, and a realtime chat.
 * Safety actions (report / block / unmatch) live in the header menu.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/BookCover';
import { genreLabel } from '@/constants/genres';
import { colors, radius, space, type } from '@/constants/theme';
import { analytics } from '@/lib/analytics';
import { blockUser, getMatches, getMessages, reportUser, sendMessage, subscribeToMessages, unmatch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Match, Message, ReportReason } from '@/lib/types';

const PROMPTS = [
  'What made you pick it up?',
  'Favourite character — and why?',
  'That ending… thoughts?',
  'A line that stuck with you?',
  'What should we read next together?',
];

const REPORT_REASONS: { label: string; value: ReportReason }[] = [
  { label: 'Harassment or hate', value: 'harassment' },
  { label: 'Inappropriate content', value: 'inappropriate' },
  { label: 'Spam or scam', value: 'spam' },
  { label: 'Fake profile', value: 'fake' },
  { label: 'Under 18', value: 'underage' },
  { label: 'Something else', value: 'other' },
];

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const [match, setMatch] = useState<Match | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    analytics.track('match_opened');
    getMatches().then((all) => setMatch(all.find((m) => m.match_id === id) ?? null)).catch(() => undefined);
    getMessages(id).then(setMessages).catch(() => undefined);
    // Realtime: append messages from either side (dedupe our own optimistic echo).
    return subscribeToMessages(id, (m) => setMessages((cur) => (cur.some((c) => c.id === m.id) ? cur : [...cur, m])));
  }, [id]);

  const send = async (text = draft) => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(id, text);
      setMessages((cur) => (cur.some((c) => c.id === msg.id) ? cur : [...cur, msg]));
      setDraft('');
    } catch (e) {
      Alert.alert('Message not sent', (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const leave = () => router.back();

  const report = () => {
    if (!match) return;
    ActionSheetIOS.showActionSheetWithOptions(
      { title: `Report ${match.other_name}`, options: [...REPORT_REASONS.map((r) => r.label), 'Cancel'], cancelButtonIndex: REPORT_REASONS.length },
      async (i) => {
        if (i >= REPORT_REASONS.length) return;
        await reportUser(match.other_id, REPORT_REASONS[i].value);
        await blockUser(match.other_id); // reporting also blocks, so the content disappears immediately
        Alert.alert('Thanks for reporting', 'Our team reviews every report within 24 hours. You won\'t see this reader again.', [{ text: 'OK', onPress: leave }]);
      },
    );
  };

  const menu = () => {
    if (!match) return;
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Report', 'Block', 'Unmatch', 'Cancel'], destructiveButtonIndex: [0, 1], cancelButtonIndex: 3 },
      (i) => {
        if (i === 0) report();
        if (i === 1) Alert.alert(`Block ${match.other_name}?`, 'They won\'t be able to match or message you again.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block', style: 'destructive', onPress: () => blockUser(match.other_id).then(leave) },
        ]);
        if (i === 2) Alert.alert('Unmatch?', 'This conversation will be deleted for both of you.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unmatch', style: 'destructive', onPress: () => unmatch(match.match_id).then(leave) },
        ]);
      },
    );
  };

  const header = match && (
    <View style={s.header}>
      <BookCover uri={match.book_cover} title={match.book_title} style={s.cover} radius={6} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={type.small}>You both loved</Text>
        <Text style={type.h2} numberOfLines={2}>{match.book_title}</Text>
        <Text style={type.small}>{match.other_name}, {match.other_age} · reads {match.other_genres.slice(0, 3).map(genreLabel).join(', ')}</Text>
        {match.other_bio ? <Text style={[type.small, { fontStyle: 'italic' }]} numberOfLines={3}>“{match.other_bio}”</Text> : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Stack.Screen options={{
        title: match?.other_name ?? '',
        headerRight: () => (
          <Pressable onPress={menu} accessibilityLabel="Safety options" hitSlop={12}>
            <Text style={{ fontSize: 22, color: colors.accent }}>•••</Text>
          </Pressable>
        ),
      }} />
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={100} style={{ flex: 1 }}>
        <FlatList
          style={{ flex: 1 }}
          data={[...messages].reverse()}
          inverted
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: space(4), gap: space(2) }}
          ListFooterComponent={header /* inverted: footer renders at the top */}
          renderItem={({ item }) => {
            const mine = item.sender_id === me;
            return (
              <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                <Text style={{ color: mine ? '#fff' : colors.ink, fontSize: 16 }}>{item.body}</Text>
              </View>
            );
          }}
        />
        {messages.length < 4 && (
          // flexGrow 0: a horizontal list would otherwise stretch to share the
          // screen with the messages list, ballooning the chips vertically.
          <FlatList horizontal data={PROMPTS} keyExtractor={(p) => p} showsHorizontalScrollIndicator={false}
            style={s.prompts}
            contentContainerStyle={{ gap: space(2), paddingHorizontal: space(4), paddingBottom: space(2), alignItems: 'center' }}
            renderItem={({ item }) => (
              <Pressable style={s.prompt} onPress={() => setDraft(item)}><Text style={{ color: colors.accent }}>{item}</Text></Pressable>
            )} />
        )}
        <View style={s.composer}>
          <TextInput style={s.input} value={draft} onChangeText={setDraft} placeholder="Talk books…"
            placeholderTextColor={colors.inkMuted} multiline maxLength={2000} />
          <Pressable onPress={() => send()} disabled={!draft.trim() || sending} style={[s.send, !draft.trim() && { opacity: 0.4 }]} accessibilityLabel="Send">
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', gap: space(3), padding: space(3), marginBottom: space(4), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  cover: { width: 72, height: 108 },
  bubble: { maxWidth: '80%', paddingVertical: space(2.5), paddingHorizontal: space(3.5), borderRadius: 18 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
  prompts: { flexGrow: 0, flexShrink: 0 },
  prompt: { borderWidth: 1, borderColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: space(1.5), backgroundColor: colors.accentSoft },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2), padding: space(3), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.paper },
  input: { flex: 1, maxHeight: 120, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(4), paddingVertical: space(2.5), fontSize: 16, color: colors.ink },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
