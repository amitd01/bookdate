/**
 * "Browsing" picker for Discover: flip through one genre for a while without
 * changing profile genres. The choice lasts until the app is closed.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, ChipGroup } from '@/components/ui';
import { GENRES } from '@/constants/genres';
import { colors, radius, space, type } from '@/constants/theme';

type Props = { visible: boolean; genre: string | null; onPick: (genre: string | null) => void; onClose: () => void };

export function GenreSheet({ visible, genre, onPick, onClose }: Props) {
  const pick = (g: string | null) => { onPick(g); onClose(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <SafeAreaView edges={['bottom']} style={s.sheet}>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={type.h2} accessibilityRole="header">Browse covers</Text>
          <Text style={type.small}>Your profile genres don&apos;t change. Matching works the same in every genre.</Text>
          <ChipGroup>
            <Chip radio label="For you" selected={genre === null} onPress={() => pick(null)} />
            {GENRES.map((g) => (
              <Chip radio key={g.slug} label={g.label} selected={genre === g.slug} onPress={() => pick(g.slug)} />
            ))}
          </ChipGroup>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,25,20,0.4)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '75%' },
  content: { padding: space(6), gap: space(3), borderRadius: radius.lg },
});
