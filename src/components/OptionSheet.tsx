/**
 * Cross-platform bottom action sheet (iOS and Android). Used for the chat
 * safety menu and report reasons, replacing the iOS-only ActionSheetIOS.
 * Floats as a glass sheet, like the genre picker.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/ui';
import { fonts, radius, space, type, type Theme } from '@/constants/theme';
import { useStyles, useTheme } from '@/lib/theme';

export type SheetOption = { label: string; destructive?: boolean; onPress: () => void };
export type Sheet = { title?: string; options: SheetOption[] };

export function OptionSheet({ sheet, onClose }: { sheet: Sheet | null; onClose: () => void }) {
  const t = useTheme();
  const s = useStyles(make);
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[s.wrap, { marginBottom: Math.max(bottom, 8) }]}>
      <Glass strong intensity={80} style={s.sheet}>
        {sheet?.title ? <Text style={s.title}>{sheet.title}</Text> : null}
        {sheet?.options.map((o) => (
          <Pressable key={o.label} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && s.pressed]}
            onPress={() => { onClose(); o.onPress(); }}>
            <Text style={[s.label, o.destructive && { color: t.danger }]}>{o.label}</Text>
          </Pressable>
        ))}
      </Glass>
      <Pressable accessibilityRole="button" onPress={onClose}>
        <Glass strong intensity={80} style={[s.sheet, s.cancel]}>
          <Text style={[s.label, { fontFamily: fonts.uiBold }]}>Cancel</Text>
        </Glass>
      </Pressable>
      </View>
    </Modal>
  );
}

const make = (t: Theme) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: t.scrim },
  wrap: { marginHorizontal: 8, gap: 8 },
  sheet: { borderRadius: radius.xl },
  title: { ...type.caption, color: t.ink2, textAlign: 'center', paddingVertical: space(3) },
  row: { minHeight: 56, justifyContent: 'center', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line },
  cancel: { minHeight: 56, justifyContent: 'center', alignItems: 'center' },
  pressed: { backgroundColor: t.accSoft },
  label: { fontFamily: fonts.uiMedium, fontSize: 17, color: t.ink },
});
