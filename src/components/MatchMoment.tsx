/**
 * The match moment. One like can match several nearby readers at once, so
 * every match is shown (swipe the cards). Each card gives enough of the
 * person to feel safe and curious, plus one-tap opening moves that prefill
 * the chat (nothing is sent until the reader taps Send).
 *
 * Look (refresh v2): always dark. The cover, blown up and blurred, fills the
 * background; the cover itself pops in inside a slowly turning gradient ring.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/BookCover';
import { Avatar, Button, Eyebrow, Glass, Gradient, Tag } from '@/components/ui';
import { genreLabel } from '@/constants/genres';
import { MODES } from '@/constants/modes';
import { brand, fonts, getTheme, motion, radius, space, type } from '@/constants/theme';
import type { NewMatch } from '@/lib/types';

type Book = { title: string; cover_url: string; author: string | null };
type Props = { moment: { book: Book; matches: NewMatch[] } | null; onClose: () => void };

const openers = (title: string) => [
  `What made you pick up ${title}?`,
  `A line from ${title} that stayed with you?`,
  'No spoilers — how far in are you?',
];

const COVER_W = 140;
const COVER_H = 210;

export function MatchMoment({ moment, onClose }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const cardWidth = width - space(12);
  const current = moment?.matches[Math.min(page, moment.matches.length - 1)];
  const mode = MODES[current?.mode ?? 'dating'];
  // The overlay is dark whatever the system scheme; the accent follows the match's mode.
  const t = getTheme('dark', current?.mode ?? 'dating');

  const open = (matchId: string, draft?: string) => {
    onClose();
    setPage(0);
    router.push({ pathname: '/chat/[id]', params: draft ? { id: matchId, draft } : { id: matchId } });
  };
  const close = () => { onClose(); setPage(0); };

  return (
    <Modal visible={!!moment} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      {moment && current && (
        <View style={s.overlay}>
          <StatusBar style="light" />
          {/* Backdrop: the cover, oversized and blurred, under a dark vignette. */}
          <Image source={{ uri: moment.book.cover_url }} blurRadius={50} contentFit="cover" style={s.backdrop} />
          <LinearGradient colors={['rgba(10,7,16,0.55)', 'rgba(10,7,16,0.7)', 'rgba(10,7,16,0.92)']} style={StyleSheet.absoluteFill} />

          <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 26, paddingBottom: insets.bottom + space(6) }]}>
            <Eyebrow color={brand.gold}>You both loved</Eyebrow>
            <PoppingCover key={moment.book.cover_url} book={moment.book} colors={[t.acc, t.acc2, brand.gold, t.acc]} />
            <Text style={s.headline} accessibilityRole="header">{mode.headline(moment.matches.length)}</Text>

            {/* One card per match; horizontal paging when a like matched several readers. */}
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width: cardWidth, flexGrow: 0 }}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / cardWidth))}>
              {moment.matches.map((m) => (
                <Glass key={m.match_id} fill="rgba(255,255,255,0.1)" border="rgba(255,255,255,0.22)" tint="dark" intensity={40}
                  style={[s.person, { width: cardWidth }]}>
                  <View style={s.personTop}>
                    <Avatar name={m.other_name} size={44} />
                    <Text style={s.name} numberOfLines={1}>{m.other_name}, {m.other_age}</Text>
                    <Tag label={MODES[m.mode].tag} background={brand.tag[m.mode]} size={12} />
                  </View>
                  <Text style={s.meta}>Reads {m.other_genres.slice(0, 3).map(genreLabel).join(', ')}</Text>
                  {m.other_bio ? <Text style={s.bio} numberOfLines={3}>“{m.other_bio}”</Text> : null}
                </Glass>
              ))}
            </ScrollView>
            {moment.matches.length > 1 && (
              <View style={s.dots} accessibilityLabel={`Match ${page + 1} of ${moment.matches.length}`}>
                {moment.matches.map((m, i) => <View key={m.match_id} style={[s.dot, i === page && s.dotOn]} />)}
              </View>
            )}

            <Eyebrow color="rgba(255,255,255,0.75)" style={{ alignSelf: 'flex-start', marginTop: space(2) }}>Send an opening move</Eyebrow>
            {openers(moment.book.title).map((o) => (
              <Pressable key={o} accessibilityRole="button" onPress={() => open(current.match_id, o)} style={({ pressed }) => [{ alignSelf: 'stretch' }, pressed && { opacity: 0.7 }]}>
                <Glass fill="rgba(255,255,255,0.08)" border="rgba(255,255,255,0.25)" tint="dark" intensity={30} style={s.opener}>
                  <Text style={s.openerText}>{o}</Text>
                </Glass>
              </Pressable>
            ))}

            <Pressable accessibilityRole="button" onPress={() => open(current.match_id)}
              style={({ pressed }) => [s.primary, { shadowColor: t.acc }, pressed && { opacity: 0.8 }]}>
              <Gradient colors={t.grad} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />
              <Text style={s.primaryText}>Start the book club</Text>
            </Pressable>
            <Button title="Keep swiping" variant="ghost" color="#FFFFFF" onPress={close} />
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

/** The matched cover: pops in, framed by a slowly rotating gradient ring with a soft glow. */
function PoppingCover({ book, colors }: { book: Book; colors: readonly [string, string, ...string[]] }) {
  const reduce = useReducedMotion();
  const pop = useSharedValue(reduce ? 1 : 0);
  const spin = useSharedValue(0);
  useEffect(() => {
    pop.set(withTiming(1, { duration: motion.matchPop, easing: Easing.bezier(0.2, 0.9, 0.3, 1.2) }));
    if (!reduce) spin.set(withRepeat(withTiming(360, { duration: 5000, easing: Easing.linear }), -1, false));
  }, [pop, spin, reduce]);
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + 0.4 * pop.get() }, { rotate: `${-6 * (1 - pop.get())}deg` }],
    opacity: Math.min(1, pop.get() * 2),
  }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));
  const ring = 6;
  const diag = Math.hypot(COVER_W, COVER_H) + 40;
  return (
    <Animated.View style={[s.ringWrap, { shadowColor: colors[0] }, popStyle]}>
      <View style={[s.ring, { width: COVER_W + ring * 2, height: COVER_H + ring * 2 }]}>
        <Animated.View style={[{ width: diag, height: diag }, spinStyle]}>
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <BookCover uri={book.cover_url} title={book.title} author={book.author} radius={14} titleSize={20}
        style={[s.cover, { top: ring, left: ring }]} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: brand.matchBg },
  backdrop: { position: 'absolute', top: '-15%', left: '-15%', width: '130%', height: '130%', opacity: 0.65 },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: space(6), gap: 14 },
  ringWrap: { marginVertical: space(2), shadowOpacity: 0.7, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  ring: { borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cover: { position: 'absolute', width: COVER_W, height: COVER_H, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)' },
  headline: { ...type.bookXL, color: '#FFFFFF', textAlign: 'center' },
  person: { borderRadius: radius.xl, padding: space(4), gap: space(1.5) },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  name: { color: '#FFFFFF', fontFamily: fonts.uiHeavy, fontSize: 19, flexShrink: 1 },
  meta: { color: 'rgba(255,255,255,0.75)', fontFamily: fonts.ui, fontSize: 14 },
  bio: { color: '#FFFFFF', fontFamily: fonts.serifItalic, fontSize: 18, lineHeight: 23 },
  dots: { flexDirection: 'row', gap: space(1.5) },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotOn: { backgroundColor: brand.gold },
  opener: { minHeight: 46, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2.5) },
  openerText: { color: '#FFFFFF', fontFamily: fonts.uiMedium, fontSize: 15 },
  primary: {
    alignSelf: 'stretch', height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: space(2),
    shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 12 },
  },
  primaryText: { color: '#FFFFFF', fontFamily: fonts.uiBold, fontSize: 17 },
});
