/**
 * Book cover image with a typographic fallback (gradient + serif title) when
 * the cover fails to load, plus `CoverHalo`: the same cover blurred behind a
 * hero cover so its colours glow onto the screen.
 */
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Gradient } from '@/components/ui';
import { fonts } from '@/constants/theme';

type Props = { uri: string; title: string; author?: string | null; style?: StyleProp<ViewStyle>; radius?: number; titleSize?: number };

export function BookCover({ uri, title, author, style, radius = 12, titleSize = 22 }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      {failed ? (
        <Gradient colors={['#6B2B5E', '#E8175D']} style={s.fallback}>
          <Text style={[s.title, { fontSize: titleSize, lineHeight: titleSize * 1.05 }]} numberOfLines={4}>{title}</Text>
          {author && titleSize > 16 ? <Text style={s.author} numberOfLines={2}>{author}</Text> : null}
        </Gradient>
      ) : (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
          accessibilityLabel={`Cover of ${title}`}
        />
      )}
    </View>
  );
}

/** Blurred copy of a cover (~92% size, centred) to place behind it. */
export function CoverHalo({ uri, style, opacity = 0.6 }: { uri: string; style?: StyleProp<ViewStyle>; opacity?: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, style]} pointerEvents="none">
      <Image source={{ uri }} blurRadius={48} cachePolicy="memory-disk" contentFit="cover"
        style={{ width: '92%', height: '92%', opacity, borderRadius: 40 }} />
    </View>
  );
}

const s = StyleSheet.create({
  fallback: { flex: 1, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { color: '#FFFFFF', fontFamily: fonts.serif, textAlign: 'center' },
  author: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: fonts.ui, textAlign: 'center' },
});
