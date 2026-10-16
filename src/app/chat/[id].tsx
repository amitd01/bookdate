/**
 * The two-person book club. Shows the book that sparked the match, the
 * partner's reading profile, a one-time safety notice, book-specific prompts
 * (until both people have written) and a realtime chat with timestamps.
 * Safety lives behind the shield in the header: tips, report, unmatch.
 * Unmatching (or reporting) removes the person for good but keeps your like
 * on the book, so it can still match you with other readers.
 * Look (refresh v2): glass header and composer, gradient bubbles for your
 * messages, the book as a glowing context card at the top of the thread.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/BookCover';
import { Icon } from '@/components/Icon';
import { OptionSheet, type Sheet } from '@/components/OptionSheet';
import { ReportSheet } from '@/components/ReportSheet';
import { Ambient, Avatar, Eyebrow, Glass, Gradient, IconButton } from '@/components/ui';
import { genreLabel } from '@/constants/genres';
import { MODES } from '@/constants/modes';
import { fonts, getTheme, keyboardBehavior, radius, space, TOUCH, type, type Theme } from '@/constants/theme';
import { analytics } from '@/lib/analytics';
import { getMessages, reportAndUnmatch, sendMessage, subscribeToMessages, unmatch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { useInbox } from '@/lib/inbox';
import { formatDay, formatTime, sameDay } from '@/lib/time';
import { useStyles, useTheme } from '@/lib/theme';
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
  // Colour follows the match's mode, not the reader's current one.
  const app = useTheme();
  const t = match && match.mode !== app.mode ? getTheme(app.scheme, match.mode) : app;
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
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
  // Read up to the newest message (server time), or the match itself if nobody has written yet.
  const seenAt = messages.at(-1)?.created_at ?? match?.created_at;
  useEffect(() => { if (seenAt) markSeen(id, seenAt); }, [id, seenAt, markSeen]);

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
      await reportAndUnmatch(match.match_id, reason, details);
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
      <Glass strong style={s.book}>
        <BookCover uri={match.book_cover} title={match.book_title} style={s.cover} radius={10} titleSize={14} />
        <View style={{ flex: 1, gap: 4 }}>
          <Eyebrow color={t.gold}>You both loved</Eyebrow>
          <Text style={[type.bookM, { color: t.ink }]} numberOfLines={2}>{match.book_title}</Text>
          <Text style={[type.caption, { fontSize: 13, color: t.ink2 }]}>{match.other_name}, {match.other_age} · reads {match.other_genres.slice(0, 3).map(genreLabel).join(', ')}</Text>
          {match.other_bio ? <Text style={s.bio} numberOfLines={3}>“{match.other_bio}”</Text> : null}
        </View>
      </Glass>
      <Text style={s.notice}>
        You matched on {new Date(match.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}. Meet in public, tell a friend, and remember BookDate will never ask for money.{' '}
        <Text style={{ color: t.accInk, fontFamily: fonts.uiSemi, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(config.safetyUrl)} accessibilityRole="link">Safety tips</Text>
      </Text>
    </View>
  );

  const bothWrote = new Set(messages.map((m) => m.sender_id)).size >= 2;

  return (
    <View style={{ flex: 1 }}>
      <Ambient />
      <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
        <Glass strong style={[s.header, { paddingTop: insets.top + 4 }]}>
          <IconButton icon="back" label="Back" size={40} onPress={() => router.back()} />
          {match && (
            <View style={[s.avatarRing, { borderColor: t.acc }]}><Avatar name={match.other_name} size={34} /></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[s.headerName, { color: t.ink }]} numberOfLines={1}>{match?.other_name ?? ''}</Text>
            {match && <Text style={[type.caption, { color: t.ink2 }]} numberOfLines={1}>{mode.noun} · {match.book_title}</Text>}
          </View>
          <IconButton icon="shield" label="Safety: tips, report or unmatch" size={40} color={t.accInk} onPress={safety} />
        </Glass>
        <FlatList
          style={{ flex: 1 }}
          data={withDays(messages).reverse()}
          inverted
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space(4), gap: space(2) }}
          ListFooterComponent={header /* inverted: footer renders at the top */}
          renderItem={({ item }) => {
            if (item.kind === 'day') return <Text style={s.day}>{item.label}</Text>;
            const mine = item.m.sender_id === me;
            const body = (
              <>
                <Text style={[s.bubbleText, { color: mine ? '#FFFFFF' : t.ink }]}>{item.m.body}</Text>
                <Text style={[s.time, mine && { color: 'rgba(255,255,255,0.8)' }]}>{formatTime(item.m.created_at)}</Text>
              </>
            );
            return mine
              ? <View style={[s.mineWrap, { shadowColor: t.acc }]}><Gradient colors={t.grad} style={[s.bubble, s.mine]}>{body}</Gradient></View>
              : <View style={[s.bubble, s.theirs]}>{body}</View>;
          }}
        />
        {!bothWrote && match && (
          // flexGrow 0: a horizontal list would otherwise stretch to share the
          // screen with the messages list, ballooning the chips vertically.
          <View>
            <Eyebrow style={s.ice}>Break the ice</Eyebrow>
            <FlatList horizontal data={prompts(match.book_title)} keyExtractor={(p) => p} showsHorizontalScrollIndicator={false}
              style={s.prompts} keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: space(2), paddingHorizontal: space(4), paddingBottom: space(2), alignItems: 'center' }}
              renderItem={({ item }) => (
                <Pressable style={[s.prompt, { backgroundColor: t.accSoft, borderColor: t.accSoft }]} onPress={() => setDraft(item)} accessibilityRole="button" accessibilityHint="Puts this question in the message box">
                  <Text style={{ color: t.accInk, fontFamily: fonts.uiSemi, fontSize: 14 }}>{item}</Text>
                </Pressable>
              )} />
          </View>
        )}
        <Glass strong style={[s.composer, { paddingBottom: Math.max(insets.bottom, space(2.5)) }]}>
          <TextInput style={s.input} value={draft} onChangeText={setDraft} placeholder="Talk books…" accessibilityLabel="Message"
            placeholderTextColor={t.ink3} multiline maxLength={2000} />
          <Pressable onPress={() => send()} disabled={!draft.trim() || sending} accessibilityRole="button" accessibilityLabel="Send"
            style={!draft.trim() && { opacity: 0.4 }}>
            <Gradient colors={t.grad} style={s.send}><Icon name="send" size={20} color="#FFFFFF" /></Gradient>
          </Pressable>
        </Glass>
      </KeyboardAvoidingView>
      <OptionSheet sheet={sheet} onClose={() => setSheet(null)} />
      <ReportSheet name={reporting ? match?.other_name ?? null : null} onSubmit={submitReport} onClose={() => setReporting(false)} />
    </View>
  );
}

const make = (t: Theme) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), paddingHorizontal: space(3), paddingBottom: space(2.5), borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line },
  avatarRing: { padding: 2, borderRadius: 21, borderWidth: 2, backgroundColor: t.bg },
  headerName: { fontFamily: fonts.uiHeavy, fontSize: 16 },
  book: { flexDirection: 'row', gap: space(3.5), padding: space(3.5), borderRadius: radius.xl },
  cover: { width: 72, height: 108 },
  bio: { fontFamily: fonts.serifItalic, fontSize: 15, lineHeight: 19, color: t.ink2 },
  notice: { ...type.caption, color: t.ink3, textAlign: 'center', paddingHorizontal: space(4) },
  day: { fontFamily: fonts.uiBold, fontSize: 12, color: t.ink3, textAlign: 'center', paddingVertical: space(2) },
  bubble: { maxWidth: '78%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 22, gap: 2 },
  bubbleText: { fontFamily: fonts.ui, fontSize: 15.5, lineHeight: 21 },
  mineWrap: { alignSelf: 'flex-end', maxWidth: '78%', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  mine: { maxWidth: '100%', borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderBottomLeftRadius: 6 },
  time: { fontFamily: fonts.ui, fontSize: 11, color: t.ink3, alignSelf: 'flex-end' },
  ice: { paddingHorizontal: space(4), paddingBottom: space(1.5) },
  prompts: { flexGrow: 0, flexShrink: 0 },
  prompt: { height: 40, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space(4) },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2), paddingTop: space(2.5), paddingHorizontal: space(3), borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line },
  input: { flex: 1, minHeight: TOUCH, maxHeight: 120, backgroundColor: t.surface, borderRadius: 22, borderWidth: 1, borderColor: t.line, paddingHorizontal: space(4), paddingTop: 11, paddingBottom: 11, fontFamily: fonts.ui, fontSize: 16, color: t.ink },
  send: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
});
