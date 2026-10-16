/**
 * Report a reader: pick a reason, optionally add details, submit. Reporting
 * also unmatches (a silent block) but keeps your like on the book.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, ChipGroup, Glass, Label } from '@/components/ui';
import { fonts, keyboardBehavior, radius, space, type, type Theme } from '@/constants/theme';
import { useStyles, useTheme } from '@/lib/theme';
import type { ReportReason } from '@/lib/types';

const REASONS: { label: string; value: ReportReason }[] = [
  { label: 'Harassment or hate', value: 'harassment' },
  { label: 'Inappropriate content', value: 'inappropriate' },
  { label: 'Spam, scam or asking for money', value: 'spam' },
  { label: 'Fake profile', value: 'fake' },
  { label: 'Under 18', value: 'underage' },
  { label: 'Something else', value: 'other' },
];

type Props = {
  name: string | null; // reader being reported; null hides the sheet
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
  onClose: () => void;
};

export function ReportSheet({ name, onSubmit, onClose }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const t = useTheme();
  const s = useStyles(make);
  const close = () => { setReason(null); setDetails(''); onClose(); };

  const submit = async () => {
    if (!reason) return;
    setSending(true);
    try { await onSubmit(reason, details); setReason(null); setDetails(''); } finally { setSending(false); }
  };

  return (
    <Modal visible={!!name} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={keyboardBehavior}>
        <Glass strong intensity={80} style={s.sheet}>
        <SafeAreaView edges={['bottom']}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Text style={[type.title, { color: t.ink }]} accessibilityRole="header">Report {name}</Text>
            <Text style={[type.bodySm, { color: t.ink2 }]}>Reports are private. Our team reviews every one within 24 hours. {name} will be removed from your Book Dates and can&apos;t match you again.</Text>
            <Label>What happened?</Label>
            <ChipGroup>
              {REASONS.map((r) => <Chip radio key={r.value} label={r.label} selected={reason === r.value} color={t.danger} onPress={() => setReason(r.value)} />)}
            </ChipGroup>
            <Label>Details (optional)</Label>
            <TextInput style={s.input} value={details} onChangeText={setDetails} multiline maxLength={1000}
              placeholder="Anything that helps us understand" placeholderTextColor={t.ink3} accessibilityLabel="Details" />
            <Button title="Send report" variant="danger" disabled={!reason} loading={sending} onPress={submit} />
            <Button title="Cancel" variant="ghost" color={t.ink} onPress={close} />
          </ScrollView>
        </SafeAreaView>
        </Glass>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const make = (t: Theme) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: t.scrim },
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, maxHeight: '90%', borderBottomWidth: 0 },
  content: { padding: space(6), gap: space(3) },
  input: { minHeight: 88, textAlignVertical: 'top', backgroundColor: t.surface, borderWidth: 1, borderColor: t.lineStrong, borderRadius: radius.md, padding: space(3), fontFamily: fonts.ui, fontSize: 16, color: t.ink },
});
