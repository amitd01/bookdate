/**
 * The two-person book club. Shows the book that sparked the match, the
 * partner's reading profile, a one-time safety notice, book-specific prompts
 * (until both people have written) and a realtime chat with timestamps.
 * Safety lives behind the shield in the header: tips, report, unmatch.
 * Unmatching (or reporting) removes the person for good but keeps your like
 * on the book, so it can still match you with other readers.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/BookCover';
import { Icon } from '@/components/Icon';
import { OptionSheet, type Sheet } from '@/components/OptionSheet';
import { ReportSheet } from '@/components/ReportSheet';
import { genreLabel } from '@/constants/genres';
import { MODES } from '@/constants/modes';
import { colors, keyboardBehavior, radius, space, TOUCH, type } from '@/constants/theme';
import { analytics } from '@/lib/analytics';
import { getMessages, reportAndUnmatch, sendMessage, subscribeToMessages, unmatch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { useInbox } from '@/lib/inbox';
import { formatDay, formatTime, sameDay } from '@/lib/time';
import type { Message, ReportReason } from '@/lib/types';

const prompts = (title: string) => [
  `What made you pick up ${title}?`,
  'No spoilers — how far in are you?',
  'Favourite character, and why?',
  `A line from ${title} that stuck with you?`,
  'What should we read next together?',
];

/** Chat rows, oldest first: a day separator before the first message of each day. */
type Item = { kind: 'day'; key: string; label: string } | { kind: 'msg'; key: string; m: Message };
const withDays = (messages: Message[]) => messages.flatMap<Item>((m, i) =>
  i === 0 || !sameDay(messages[i - 1].created_at, m.created_at)
    ? [{ kind: 'day', key: `day-${m.id}`, label: formatDay(m.created_at) }, { kind: 'msg', key: String(m.id), m }]
    : [{ kind: 'msg', key: String(m.id), m }]);

export default function Chat() {
  const { id, draft: opener } = useLocalSearchParams<{ id: string; draft?: string }>();
  const { session } = useAuth();
  const { matches, refresh, markSeen } = useInbox();
  const me = session?.user.id;
  const match = matches.find((m) => m.match_id === id) ?? null;
  const mode = MODES[match?.mode ?? 'dating'];
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState(opener ?? '');
  const [sending, setSending] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    analytics.track('match_opened');
    getMessages(id).then(setMessages).catch(() => undefined);
    // Realtime: append messages from either side (dedupe our own optimistic echo).
    return subscribeToMessages(id, (m) => setMessages((cur) => (cur.some((c) => c.id === m.id) ? cur : [...cur, m])));
  }, [id]);
  useEffect(() => { if (!match) refresh(); }, [match, refresh]); // e.g. opened from a push before the inbox loaded
  useEffect(() => { markSeen(id); }, [id, messages.length, markSeen]);

  const send = async (text = draft) => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(id, text);
      setMessages((cur) => (cur.some((c) => c.id === msg.id) ? cur : [...cur, msg]));
      setDraft('');
    } catch (e) {
      Alert.alert('Message not sent', `${errorMessage(e)}\n\nYour message is still in the box, so you can try again.`);
    } finally {
      setSending(false);
    }
  };

  const leave = () => { refresh(); router.back(); };

  const confirmUnmatch = () => match && Alert.alert(`Unmatch ${match.other_name}?`,
    `The chat is deleted for both of you and you won't match or hear from each other again. Your like on "${match.book_title}" stays, so it can still match you with other readers.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unmatch', style: 'destructive', onPress: () => unmatch(match.match_id).then(leave).catch((e) => Alert.alert("Couldn't unmatch", errorMessage(e))) },
    ]);

  const submitReport = async (reason: ReportReason, details: string) => {
    if (!match) return;
    try {
      await reportAndUnmatch(match, reason, details);
      setReporting(false);
      Alert.alert('Thanks for telling us', `We review every report within 24 hours. ${match.other_name} has been removed from your Book Dates. Your like on "${match.book_title}" stays.`, [{ text: 'OK', onPress: leave }]);
    } catch (e) {
      Alert.alert("Couldn't send the report", errorMessage(e));
    }
  };

  const safety = () => match && setSheet({
    title: 'Safety',
    options: [
      { label: 'Safety tips', onPress: () => Linking.openURL(config.safetyUrl) },
      // Wait for the menu to slide away: iOS can't present a modal while another is closing.
      { label: `Report ${match.other_name}`, destructive: true, onPress: () => setTimeout(() => setReporting(true), 400) },
      { label: `Unmatch & block ${match.other_name}`, destructive: true, onPress: confirmUnmatch },
    ],
  });

  const header = match && (
    <View style={{ gap: space(3), marginBottom: space(2) }}>
      <View style={s.book}>
        <BookCover uri={match.book_cover} title={match.book_title} style={s.cover} radius={6} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={type.overline}>You both loved</Text>
          <Text style={type.h2} numberOfLines={2}>{match.book_title}</Text>
          <Text style={type.small}>{match.other_name}, {match.other_age} · reads {match.other_genres.slice(0, 3).map(genreLabel).join(', ')}</Text>
          {match.other_bio ? <Text style={[type.small, { fontStyle: 'italic' }]} numberOfLines={3}>“{match.other_bio}”</Text> : null}
        </View>
      </View>
      <Text style={s.notice}>
        You matched on {new Date(match.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}. Meet in public, tell a friend, and remember BookDate will never ask for money.{' '}
        <Text style={{ color: mode.color, fontWeight: '600' }} onPress={() => Linking.openURL(config.safetyUrl)} accessibilityRole="link">Safety tips</Text>
      </Text>
    </View>
  );

  const bothWrote = new Set(messages.map((m) => m.sender_id)).size >= 2;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Stack.Screen options={{
        headerTitle: () => (
          <View style={{ alignItems: 'center' }}>
            <Text style={[type.body, { fontWeight: '700' }]} numberOfLines={1}>{match?.other_name ?? ''}</Text>
            {match && <Text style={type.small} numberOfLines={1}>{mode.noun} · {match.book_title}</Text>}
          </View>
        ),
        headerRight: () => (
          <Pressable onPress={safety} accessibilityRole="button" accessibilityLabel="Safety: tips, report or unmatch" hitSlop={8} style={s.shield}>
            <Icon name="shield" size={22} color={mode.color} />
          </Pressable>
        ),
      }} />
      <KeyboardAvoidingView behavior={keyboardBehavior} keyboardVerticalOffset={100} style={{ flex: 1 }}>
        <FlatList
          style={{ flex: 1 }}
          data={withDays(messages).reverse()}
          inverted
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ padding: space(4), gap: space(2) }}
          ListFooterComponent={header /* inverted: footer renders at the top */}
          renderItem={({ item }) => {
            if (item.kind === 'day') return <Text style={s.day}>{item.label}</Text>;
            const mine = item.m.sender_id === me;
            return (
              <View style={[s.bubble, mine ? [s.mine, { backgroundColor: mode.color }] : s.theirs]}>
                <Text style={{ color: mine ? '#fff' : colors.ink, fontSize: 16 }}>{item.m.body}</Text>
                <Text style={[s.time, mine && { color: 'rgba(255,255,255,0.8)' }]}>{formatTime(item.m.created_at)}</Text>
              </View>
            );
          }}
        />
        {!bothWrote && match && (
          // flexGrow 0: a horizontal list would otherwise stretch to share the
          // screen with the messages list, ballooning the chips vertically.
          <View>
            <Text style={s.ice}>Break the ice</Text>
            <FlatList horizontal data={prompts(match.book_title)} keyExtractor={(p) => p} showsHorizontalScrollIndicator={false}
              style={s.prompts} keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: space(2), paddingHorizontal: space(4), paddingBottom: space(2), alignItems: 'center' }}
              renderItem={({ item }) => (
                <Pressable style={[s.prompt, { backgroundColor: mode.soft }]} onPress={() => setDraft(item)} accessibilityRole="button" accessibilityHint="Puts this question in the message box">
                  <Text style={{ color: mode.color, fontWeight: '600' }}>{item}</Text>
                </Pressable>
              )} />
          </View>
        )}
        <View style={s.composer}>
          <TextInput style={s.input} value={draft} onChangeText={setDraft} placeholder="Talk books…" accessibilityLabel="Message"
            placeholderTextColor={colors.ink3} multiline maxLength={2000} />
          <Pressable onPress={() => send()} disabled={!draft.trim() || sending} accessibilityRole="button" accessibilityLabel="Send"
            style={[s.send, { backgroundColor: mode.color }, !draft.trim() && { opacity: 0.4 }]}>
            <Icon name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <OptionSheet sheet={sheet} onClose={() => setSheet(null)} />
      <ReportSheet name={reporting ? match?.other_name ?? null : null} onSubmit={submitReport} onClose={() => setReporting(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  book: { flexDirection: 'row', gap: space(3), padding: space(3), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  cover: { width: 72, height: 108 },
  notice: { ...type.small, textAlign: 'center', paddingHorizontal: space(4) },
  shield: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  day: { ...type.small, fontWeight: '600', textAlign: 'center', paddingVertical: space(2) },
  bubble: { maxWidth: '80%', paddingVertical: space(2.5), paddingHorizontal: space(3.5), borderRadius: 18, gap: 2 },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.lineStrong, borderBottomLeftRadius: 4 },
  time: { fontSize: 11, color: colors.ink3, alignSelf: 'flex-end' },
  ice: { ...type.overline, color: colors.ink3, paddingHorizontal: space(4), paddingBottom: space(1.5) },
  prompts: { flexGrow: 0, flexShrink: 0 },
  prompt: { minHeight: TOUCH, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: space(4) },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2), padding: space(3), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.sunken },
  input: { flex: 1, minHeight: TOUCH, maxHeight: 120, backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: space(4), paddingVertical: space(2.5), fontSize: 16, color: colors.ink },
  send: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
});
