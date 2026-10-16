/**
 * A draggable book card. Drag right = like, left = pass; past the threshold
 * (or on fling) the card flies off and `onSwiped` fires. Parents can also
 * swipe programmatically through the `ref` handle (used by the ✕ / ♥ buttons),
 * and screen-reader users get "Like" / "Pass" actions on the card itself.
 * Shared values use .get()/.set() so the card is React Compiler compatible.
 *
 * Look (refresh v2): full-bleed cover, dark scrim, a pulsing gold "readers
 * near you" badge, LOVE IT / PASS stamps, and a frosted info panel.
 * `drag` mirrors the x offset so the parent can animate the next card.
 */
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useImperativeHandle, type Ref } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, interpolate, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue,
  withRepeat, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BookCover } from '@/components/BookCover';
import { Gradient } from '@/components/ui';
import { genreLabel } from '@/constants/genres';
import { fonts, motion, radius, type Theme } from '@/constants/theme';
import { useStyles, useTheme } from '@/lib/theme';
import type { FeedBook } from '@/lib/types';

export type SwipeCardHandle = { swipe: (liked: boolean) => void };

/** "n readers near you loved this": the like that can match instantly. */
export const nearbyText = (n: number) => `${n} ${n === 1 ? 'reader' : 'readers'} near you loved this`;

const FLY = 560; // fly-out distance (px)
const THRESHOLD = motion.swipeThreshold;

type Props = { book: FeedBook; onSwiped: (liked: boolean) => void; drag?: SharedValue<number>; ref?: Ref<SwipeCardHandle> };

export function SwipeCard({ book, onSwiped, drag, ref }: Props) {
  const t = useTheme();
  const s = useStyles(make);
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  // A fresh card starts centred; mirror its offset to the parent.
  useEffect(() => { drag?.set(0); }, [drag]);
  useAnimatedReaction(() => x.get(), (v) => { drag?.set(v); });

  const flyOff = (liked: boolean) => {
    'worklet';
    x.set(withTiming((liked ? 1 : -1) * FLY, { duration: motion.swipeOut }, (done) => {
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
      if (Math.abs(x.get()) > THRESHOLD || flung) {
        flyOff((flung ? e.velocityX : x.get()) > 0);
      } else {
        const back = { duration: motion.springBack, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };
        x.set(withTiming(0, back));
        y.set(withSpring(0));
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { rotate: `${x.get() / 20}deg` }],
  }));
  const likeStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [0, THRESHOLD], [0, 1], 'clamp') }));
  const passStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-THRESHOLD, 0], [1, 0], 'clamp') }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[s.card, cardStyle]} accessible
        accessibilityLabel={[`${book.title} by ${book.author ?? 'unknown author'}`, book.nearby_likes > 0 && nearbyText(book.nearby_likes)].filter(Boolean).join('. ')}
        accessibilityHint="Swipe right to like, left to pass, or use the actions menu"
        accessibilityActions={[{ name: 'like', label: 'Like' }, { name: 'pass', label: 'Pass' }]}
        onAccessibilityAction={(e) => flyOff(e.nativeEvent.actionName === 'like')}>
        <View style={s.clip}>
          <BookCover uri={book.cover_url} title={book.title} author={book.author} style={StyleSheet.absoluteFill} radius={0} titleSize={40} />
          <LinearGradient colors={['rgba(10,6,16,0)', 'rgba(10,6,16,0.82)']} style={s.scrim} pointerEvents="none" />

          {book.nearby_likes > 0 && <NearbyBadge n={book.nearby_likes} />}

          <Animated.View style={[s.stamp, s.likeStamp, { shadowColor: t.acc }, likeStyle]}>
            <Gradient style={[StyleSheet.absoluteFill, { borderRadius: 11 }]} />
            <Text style={s.stampText}>LOVE IT</Text>
          </Animated.View>
          <Animated.View style={[s.stamp, s.passStamp, passStyle]}>
            <Text style={s.stampText}>PASS</Text>
          </Animated.View>

          <View style={s.panel}>
            {Platform.OS === 'ios' && <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />}
            <Text style={s.title} numberOfLines={2}>{book.title}</Text>
            <Text style={s.meta} numberOfLines={1}>{[book.author, book.first_published].filter(Boolean).join(' · ')}</Text>
            {book.genres.length > 0 && (
              <View style={s.chips}>
                {book.genres.slice(0, 3).map((g) => <Text key={g} style={s.chip}>{genreLabel(g)}</Text>)}
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Dark amber glass badge with a pulsing dot: readers nearby already loved this book. */
function NearbyBadge({ n }: { n: number }) {
  const s = useStyles(make);
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!reduce) pulse.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false));
  }, [reduce, pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.8 * (1 - pulse.get()), transform: [{ scale: 1 + 1.8 * pulse.get() }] }));
  return (
    <View style={s.nearby}>
      {Platform.OS === 'ios' && <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />}
      <View style={s.dotWrap}>
        <Animated.View style={[s.dot, s.dotRing, ring]} />
        <View style={s.dot} />
      </View>
      <Text style={s.nearbyText}>{nearbyText(n)}</Text>
    </View>
  );
}

const make = (t: Theme) => StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFill, borderRadius: radius.card, backgroundColor: t.surface2,
    shadowColor: t.shadow, shadowOpacity: 1, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  clip: { flex: 1, borderRadius: radius.card, overflow: 'hidden', borderWidth: 1, borderColor: t.glassLine },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%' },
  nearby: {
    position: 'absolute', top: 14, left: 14, maxWidth: '90%', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, height: 32, borderRadius: radius.pill, overflow: 'hidden',
    backgroundColor: 'rgba(24,16,6,0.42)', borderWidth: 1, borderColor: 'rgba(255,205,100,0.6)',
  },
  nearbyText: { color: '#FFD27A', fontFamily: fonts.uiBold, fontSize: 13 },
  dotWrap: { width: 8, height: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.brand.gold },
  dotRing: { position: 'absolute' },
  stamp: {
    position: 'absolute', top: 56, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 3, borderColor: '#FFFFFF',
    overflow: 'hidden', shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  likeStamp: { left: 20, transform: [{ rotate: '-12deg' }] },
  passStamp: { right: 20, backgroundColor: 'rgba(40,46,58,0.7)', transform: [{ rotate: '12deg' }] },
  stampText: { color: '#FFFFFF', fontFamily: fonts.uiHeavy, fontSize: 28, letterSpacing: 1.7 },
  panel: {
    position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: radius.card - 10, overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(18,10,26,0.3)' : 'rgba(18,10,26,0.62)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', paddingTop: 16, paddingHorizontal: 18, paddingBottom: 18, gap: 4,
  },
  title: { color: '#FFFFFF', fontFamily: fonts.serif, fontSize: 32, lineHeight: 33 },
  meta: { color: 'rgba(255,255,255,0.86)', fontFamily: fonts.ui, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    color: '#FFFFFF', fontFamily: fonts.uiSemi, fontSize: 12, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', borderRadius: radius.pill, overflow: 'hidden',
  },
});
