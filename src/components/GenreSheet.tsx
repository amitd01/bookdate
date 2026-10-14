/**
 * "Browsing" picker for Discover: flip through one genre for a while without
 * changing profile genres. The choice lasts until the app is closed.
 * Floating glass sheet (8pt from the edges) over a soft scrim.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, ChipGroup, Glass } from '@/components/ui';
import { GENRES } from '@/constants/genres';
import { radius, space, type, type Theme } from '@/constants/theme';
import { useStyles, useTheme } from '@/lib/theme';

type Props = { visible: boolean; genre: string | null; onPick: (genre: string | null) => void; onClose: () => void };

export function GenreSheet({ visible, genre, onPick, onClose }: Props) {
  const t = useTheme();
  const s = useStyles(make);
  const { bottom } = useSafeAreaInsets();
  const pick = (g: string | null) => { onPick(g); onClose(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[s.backdrop]} onPress={onClose} accessibilityLabel="Close" />
      <Glass strong intensity={80} style={[s.sheet, { marginBottom: Math.max(bottom, 8) }]}>
        <View style={s.grabber} />
        <ScrollView contentContainerStyle={s.content}>
          <Text style={[type.title, { color: t.ink }]} accessibilityRole="header">Browse a genre</Text>
          <Text style={[type.bodySm, { color: t.ink2, marginBottom: space(2) }]}>Narrow the deck until you close the app.</Text>
          <ChipGroup>
            <Chip radio label="For you" selected={genre === null} onPress={() => pick(null)} />
            {GENRES.map((g) => (
              <Chip radio key={g.slug} label={g.label} selected={genre === g.slug} onPress={() => pick(g.slug)} />
            ))}
          </ChipGroup>
        </ScrollView>
      </Glass>
    </Modal>
  );
}

const make = (t: Theme) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: t.scrim },
  sheet: { marginHorizontal: 8, borderRadius: radius.sheet, maxHeight: '75%' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.lineStrong, marginTop: 8 },
  content: { padding: space(6), paddingTop: space(4), gap: space(1) },
});
