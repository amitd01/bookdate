/**
 * Whole-number slider with one thumb (distance) or two (age range).
 * Drag or tap the track to move the nearest thumb. Each thumb is an
 * "adjustable" element, so VoiceOver/TalkBack users swipe up/down to change it.
 * Gestures run on the JS thread (runOnJS): values are integers, so a re-render
 * per step is cheap and keeps the component simple.
 */
import { useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { colors } from '@/constants/theme';

const THUMB = 28;
const HIT = 44; // minimum touch target height

type Props = {
  values: number[]; // one or two values, ascending
  min: number;
  max: number;
  onChange: (values: number[]) => void;
  /** Spoken value for each thumb, e.g. (v) => `${v} km`. */
  describe: (v: number, thumb: number) => string;
  labels: string[]; // accessibility label per thumb
};

export function Slider({ values, min, max, onChange, describe, labels }: Props) {
  const [width, setWidth] = useState(0);
  const active = useSharedValue(0); // thumb being dragged (a shared value, so the React Compiler allows writes in handlers)
  const span = max - min;
  const track = Math.max(width - THUMB, 1); // thumbs stay fully inside the view
  const pct = (v: number) => ((v - min) / span) * 100;

  /** Moves thumb `i` to `v`, keeping two thumbs in order. */
  const set = (i: number, v: number) => {
    const lo = i === 1 ? values[0] : min;
    const hi = i === 0 && values.length > 1 ? values[1] : max;
    const next = Math.min(hi, Math.max(lo, v));
    if (next !== values[i]) onChange(values.map((x, j) => (j === i ? next : x)));
  };
  const valueAt = (x: number) => Math.round(min + ((x - THUMB / 2) / track) * span);
  /** Nearest thumb; when two overlap, pick by the side of the touch. */
  const nearest = (v: number) => {
    if (values.length === 1) return 0;
    if (values[0] === values[1]) return v < values[0] ? 0 : 1;
    return Math.abs(v - values[0]) <= Math.abs(v - values[1]) ? 0 : 1;
  };

  // Horizontal drags only, so the surrounding ScrollView still scrolls vertically.
  const pan = Gesture.Pan().runOnJS(true).activeOffsetX([-4, 4]).failOffsetY([-10, 10])
    .onStart((e) => { active.set(nearest(valueAt(e.x))); set(active.get(), valueAt(e.x)); })
    .onUpdate((e) => set(active.get(), valueAt(e.x)));
  const tap = Gesture.Tap().runOnJS(true).onEnd((e) => { const v = valueAt(e.x); set(nearest(v), v); });

  const onAction = (i: number) => (e: AccessibilityActionEvent) =>
    set(i, values[i] + (e.nativeEvent.actionName === 'increment' ? 1 : -1));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View style={s.root} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={s.rail}>
          <View style={[s.fill, values.length > 1
            ? { left: `${pct(values[0])}%`, right: `${100 - pct(values[1])}%` }
            : { left: 0, right: `${100 - pct(values[0])}%` }]} />
        </View>
        {values.map((v, i) => (
          <View key={i} style={[s.thumbSlot, { left: (pct(v) / 100) * track }]}
            accessible accessibilityRole="adjustable" accessibilityLabel={labels[i]}
            accessibilityValue={{ min, max, now: v, text: describe(v, i) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={onAction(i)}>
            <View style={s.thumb} />
          </View>
        ))}
      </View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  root: { height: HIT, justifyContent: 'center' },
  // The rail is inset by half a thumb so its ends sit under the thumb centres; the fill is positioned within it.
  rail: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 4, borderRadius: 2, backgroundColor: colors.line },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 2, backgroundColor: colors.accent },
  thumbSlot: { position: 'absolute', width: THUMB, height: HIT, justifyContent: 'center' },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.accent, elevation: 2, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
});
