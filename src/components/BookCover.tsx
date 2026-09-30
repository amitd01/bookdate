/** Book cover image with a typographic fallback when the cover fails to load. */
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';

type Props = { uri: string; title: string; author?: string | null; style?: ViewStyle; radius?: number };

export function BookCover({ uri, title, author, style, radius = 12 }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor: colors.accent }, style]}>
      {failed ? (
        <View style={s.fallback}>
          <Text style={s.title} numberOfLines={4}>{title}</Text>
          {author ? <Text style={s.author} numberOfLines={2}>{author}</Text> : null}
        </View>
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

const s = StyleSheet.create({
  fallback: { flex: 1, padding: 16, justifyContent: 'center', gap: 8 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', fontFamily: 'ui-serif' },
  author: { color: '#F4E3E7', fontSize: 14 },
});
