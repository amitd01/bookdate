/**
 * A draggable book card. Drag right = like, left = pass; past the threshold
 * (or on fling) the card flies off and `onSwiped` fires. Parents can also
 * swipe programmatically through the `ref` handle (used by the ✕ / ♥ buttons).
 * Shared values use .get()/.set() so the card is React Compiler compatible.
 */
import { useImperativeHandle, type Ref } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BookCover } from '@/components/BookCover';
import { genreLabel } from '@/constants/genres';
import { colors, radius, space } from '@/constants/theme';
import type { FeedBook } from '@/lib/types';

export type SwipeCardHandle = { swipe: (liked: boolean) => void };

type Props = { book: FeedBook; onSwiped: (liked: boolean) => void; ref?: Ref<SwipeCardHandle> };

export function SwipeCard({ book, onSwiped, ref }: Props) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const threshold = width * 0.28;

  const flyOff = (liked: boolean) => {
    'worklet';
    x.set(withTiming((liked ? 1 : -1) * width * 1.5, { duration: 220 }, (done) => {
      if (done) scheduleOnRN(onSwiped, liked);
    }));
  };

  useImperativeHandle(ref, () => ({ swipe: (liked: boolean) => flyOff(liked) }));

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      x.set(e.translationX);
      y.set(e.translationY * 0.3);
    })
    .onEnd((e) => {
      const flung = Math.abs(e.velocityX) > 900;
      if (Math.abs(x.get()) > threshold || flung) {
        flyOff((flung ? e.velocityX : x.get()) > 0);
      } else {
        x.set(withSpring(0));
        y.set(withSpring(0));
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { rotate: `${interpolate(x.get(), [-width, width], [-14, 14])}deg` },
    ],
  }));
  const likeStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [0, threshold], [0, 1], 'clamp') }));
  const passStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-threshold, 0], [1, 0], 'clamp') }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[s.card, cardStyle]} accessibilityLabel={`${book.title} by ${book.author ?? 'unknown author'}`}>
        <BookCover uri={book.cover_url} title={book.title} author={book.author} style={s.cover} radius={0} />
        <Animated.View style={[s.stamp, s.like, likeStyle]}><Text style={[s.stampText, { color: colors.success }]}>READ IT</Text></Animated.View>
        <Animated.View style={[s.stamp, s.pass, passStyle]}><Text style={[s.stampText, { color: colors.pass }]}>PASS</Text></Animated.View>
        <View style={s.info}>
          {book.nearby_likes > 0 && (
            <Text style={s.nearby}>
              ❤️ {book.nearby_likes} {book.nearby_likes === 1 ? 'reader' : 'readers'} near you loved this
            </Text>
          )}
          <Text style={s.title} numberOfLines={2}>{book.title}</Text>
          <Text style={s.meta} numberOfLines={1}>
            {[book.author, book.first_published].filter(Boolean).join(' · ')}
          </Text>
          <Text style={s.meta} numberOfLines={1}>{book.genres.slice(0, 3).map(genreLabel).join(' • ')}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFill, borderRadius: radius.lg, backgroundColor: colors.card, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  cover: { flex: 1 },
  info: { padding: space(4), gap: space(1), backgroundColor: colors.card },
  nearby: { color: colors.accent, fontWeight: '700', fontSize: 14, marginBottom: space(1) },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink, fontFamily: 'ui-serif' },
  meta: { fontSize: 14, color: colors.inkMuted },
  stamp: { position: 'absolute', top: space(8), paddingHorizontal: space(3), paddingVertical: space(1.5), borderWidth: 4, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.85)' },
  like: { left: space(6), borderColor: colors.success, transform: [{ rotate: '-14deg' }] },
  pass: { right: space(6), borderColor: colors.pass, transform: [{ rotate: '14deg' }] },
  stampText: { fontSize: 30, fontWeight: '900', letterSpacing: 2 },
});
