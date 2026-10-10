/**
 * A draggable book card. Drag right = like, left = pass; past the threshold
 * (or on fling) the card flies off and `onSwiped` fires. Parents can also
 * swipe programmatically through the `ref` handle (used by the ✕ / ♥ buttons),
 * and screen-reader users get "Like" / "Pass" actions on the card itself.
 * Shared values use .get()/.set() so the card is React Compiler compatible.
 */
import { useImperativeHandle, type Ref } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BookCover } from '@/components/BookCover';
import { Icon } from '@/components/Icon';
import { genreLabel } from '@/constants/genres';
import { colors, radius, serif, space } from '@/constants/theme';
import type { FeedBook } from '@/lib/types';

export type SwipeCardHandle = { swipe: (liked: boolean) => void };

/** "n readers near you loved this": the like that can match instantly. */
export const nearbyText = (n: number) => `${n} ${n === 1 ? 'reader' : 'readers'} near you loved this`;

type Props = { book: FeedBook; onSwiped: (liked: boolean) => void; likeColor?: string; ref?: Ref<SwipeCardHandle> };

export function SwipeCard({ book, onSwiped, likeColor = colors.accent, ref }: Props) {
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
      <Animated.View style={[s.card, cardStyle]} accessible
        accessibilityLabel={[`${book.title} by ${book.author ?? 'unknown author'}`, book.nearby_likes > 0 && nearbyText(book.nearby_likes)].filter(Boolean).join('. ')}
        accessibilityHint="Swipe right to like, left to pass, or use the actions menu"
        accessibilityActions={[{ name: 'like', label: 'Like' }, { name: 'pass', label: 'Pass' }]}
        onAccessibilityAction={(e) => flyOff(e.nativeEvent.actionName === 'like')}>
        <BookCover uri={book.cover_url} title={book.title} author={book.author} style={s.cover} radius={0} />
        <Animated.View style={[s.stamp, s.like, { borderColor: likeColor }, likeStyle]}>
          <Icon name="heart" size={22} color={likeColor} />
          <Text style={[s.stampText, { color: likeColor }]}>LOVE IT</Text>
        </Animated.View>
        <Animated.View style={[s.stamp, s.pass, passStyle]}><Text style={[s.stampText, { color: colors.pass }]}>PASS</Text></Animated.View>
        <View style={s.info}>
          {book.nearby_likes > 0 && (
            <View style={s.nearby}>
              <Icon name="pin" size={14} color={colors.gilt} />
              <Text style={s.nearbyText}>{nearbyText(book.nearby_likes)}</Text>
            </View>
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
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  cover: { flex: 1 },
  info: { padding: space(4), gap: space(1), backgroundColor: colors.card },
  nearby: { flexDirection: 'row', alignItems: 'center', gap: space(1), alignSelf: 'flex-start', backgroundColor: colors.giltSoft, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1), marginBottom: space(1) },
  nearbyText: { color: colors.gilt, fontWeight: '700', fontSize: 14 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink, fontFamily: serif },
  meta: { fontSize: 14, color: colors.inkMuted },
  stamp: { position: 'absolute', top: space(8), flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(3), paddingVertical: space(1.5), borderWidth: 4, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.9)' },
  like: { left: space(6), transform: [{ rotate: '-14deg' }] },
  pass: { right: space(6), borderColor: colors.pass, transform: [{ rotate: '14deg' }] },
  stampText: { fontSize: 30, fontWeight: '900', letterSpacing: 2 },
});
