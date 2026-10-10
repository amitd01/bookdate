/**
 * The match moment. One like can match several nearby readers at once, so
 * every match is shown (swipe the cards). Each card gives enough of the
 * person to feel safe and curious, plus one-tap opening moves that prefill
 * the chat (nothing is sent until the reader taps Send).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BookCover } from '@/components/BookCover';
import { Avatar, Button, Tag } from '@/components/ui';
import { genreLabel } from '@/constants/genres';
import { MODES } from '@/constants/modes';
import { colors, radius, serif, space, type } from '@/constants/theme';
import type { NewMatch } from '@/lib/types';

type Book = { title: string; cover_url: string; author: string | null };
type Props = { moment: { book: Book; matches: NewMatch[] } | null; onClose: () => void };

const openers = (title: string) => [
  `What made you pick up ${title}?`,
  `A line from ${title} that stayed with you?`,
  'No spoilers — how far in are you?',
];

export function MatchMoment({ moment, onClose }: Props) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const cardWidth = width - space(16);
  const current = moment?.matches[Math.min(page, moment.matches.length - 1)];
  const mode = MODES[current?.mode ?? 'dating'];

  const open = (matchId: string, draft?: string) => {
    onClose();
    setPage(0);
    router.push({ pathname: '/chat/[id]', params: draft ? { id: matchId, draft } : { id: matchId } });
  };
  const close = () => { onClose(); setPage(0); };

  return (
    <Modal visible={!!moment} transparent animationType="fade" onRequestClose={close}>
      {moment && current && (
        <ScrollView style={s.overlay} contentContainerStyle={s.content}>
          <Text style={[type.overline, { color: '#E5B864' }]}>You both loved</Text>
          <BookCover uri={moment.book.cover_url} title={moment.book.title} author={moment.book.author} style={s.cover} radius={8} />
          <Text style={s.headline} accessibilityRole="header">{mode.headline(moment.matches.length)}</Text>

          {/* One card per match; horizontal paging when a like matched several readers. */}
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width: cardWidth, flexGrow: 0 }}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / cardWidth))}>
            {moment.matches.map((m) => (
              <View key={m.match_id} style={[s.person, { width: cardWidth }]}>
                <View style={s.personTop}>
                  <Avatar name={m.other_name} size={40} />
                  <Text style={s.name}>{m.other_name}, {m.other_age}</Text>
                  <Tag label={MODES[m.mode].tag} color="#fff" background={MODES[m.mode].fill} />
                </View>
                <Text style={s.meta}>Reads {m.other_genres.slice(0, 3).map(genreLabel).join(', ')}</Text>
                {m.other_bio ? <Text style={s.bio} numberOfLines={3}>“{m.other_bio}”</Text> : null}
              </View>
            ))}
          </ScrollView>
          {moment.matches.length > 1 && (
            <View style={s.dots} accessibilityLabel={`Match ${page + 1} of ${moment.matches.length}`}>
              {moment.matches.map((m, i) => <View key={m.match_id} style={[s.dot, i === page && s.dotOn]} />)}
            </View>
          )}

          <Text style={[type.overline, { color: '#BCB0A2', marginTop: space(2) }]}>Send an opening move</Text>
          {openers(moment.book.title).map((o) => (
            <Pressable key={o} accessibilityRole="button" style={s.opener} onPress={() => open(current.match_id, o)}>
              <Text style={s.openerText}>{o}</Text>
            </Pressable>
          ))}

          <Button title="Start the book club" color={mode.fill} style={{ alignSelf: 'stretch' }} onPress={() => open(current.match_id)} />
          <Pressable accessibilityRole="button" onPress={close} style={s.keep}>
            <Text style={s.keepText}>Keep swiping</Text>
          </Pressable>
        </ScrollView>
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space(8), paddingTop: space(16), gap: space(3) },
  cover: { width: 120, height: 180, borderWidth: 2, borderColor: '#E5B864' },
  headline: { fontFamily: serif, fontWeight: '800', fontSize: 30, lineHeight: 36, color: '#F2EADF', textAlign: 'center' },
  person: { backgroundColor: '#2A241F', borderRadius: radius.md, padding: space(4), gap: space(1.5) },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  name: { color: '#F2EADF', fontSize: 18, fontWeight: '700', flex: 1 },
  meta: { color: '#BCB0A2', fontSize: 14 },
  bio: { color: '#BCB0A2', fontSize: 14, fontStyle: 'italic', fontFamily: serif },
  dots: { flexDirection: 'row', gap: space(1.5) },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#5C5248' },
  dotOn: { backgroundColor: '#E5B864' },
  opener: { alignSelf: 'stretch', minHeight: 44, justifyContent: 'center', backgroundColor: '#3A2E17', borderRadius: radius.pill, paddingHorizontal: space(4) },
  openerText: { color: '#F2EADF', fontSize: 15 },
  keep: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space(6) },
  keepText: { color: '#F2EADF', fontSize: 17, fontWeight: '700' },
});
