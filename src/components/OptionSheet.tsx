/**
 * Cross-platform bottom action sheet (iOS and Android). Used for the chat
 * safety menu and report reasons, replacing the iOS-only ActionSheetIOS.
 */
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, space, type } from '@/constants/theme';

export type SheetOption = { label: string; destructive?: boolean; onPress: () => void };
export type Sheet = { title?: string; options: SheetOption[] };

export function OptionSheet({ sheet, onClose }: { sheet: Sheet | null; onClose: () => void }) {
  return (
    <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <SafeAreaView edges={['bottom']} style={s.sheet}>
        {sheet?.title ? <Text style={[type.small, s.title]}>{sheet.title}</Text> : null}
        {sheet?.options.map((o) => (
          <Pressable key={o.label} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && s.pressed]}
            onPress={() => { onClose(); o.onPress(); }}>
            <Text style={[s.label, o.destructive && { color: colors.danger }]}>{o.label}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" style={({ pressed }) => [s.row, s.cancel, pressed && s.pressed]} onPress={onClose}>
          <Text style={[s.label, { fontWeight: '700' }]}>Cancel</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(31,27,22,0.4)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: space(2) },
  title: { textAlign: 'center', paddingVertical: space(3) },
  row: { paddingVertical: space(4), alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  cancel: { borderTopWidth: 6, borderTopColor: colors.paper },
  pressed: { backgroundColor: colors.paper },
  label: { fontSize: 17, color: colors.ink },
});
