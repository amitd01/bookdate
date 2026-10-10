/**
 * Report a reader: pick a reason, optionally add details, submit. Reporting
 * also unmatches (a silent block) but keeps your like on the book.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, ChipGroup, Label } from '@/components/ui';
import { colors, keyboardBehavior, radius, space, type } from '@/constants/theme';
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
        <SafeAreaView edges={['bottom']} style={s.sheet}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Text style={type.h2} accessibilityRole="header">Report {name}</Text>
            <Text style={type.small}>Reports are private. Our team reviews every one within 24 hours. {name} will be removed from your Book Dates and can&apos;t match you again.</Text>
            <Label>What happened?</Label>
            <ChipGroup>
              {REASONS.map((r) => <Chip radio key={r.value} label={r.label} selected={reason === r.value} color={colors.danger} onPress={() => setReason(r.value)} />)}
            </ChipGroup>
            <Label>Details (optional)</Label>
            <TextInput style={s.input} value={details} onChangeText={setDetails} multiline maxLength={1000}
              placeholder="Anything that helps us understand" placeholderTextColor={colors.ink3} accessibilityLabel="Details" />
            <Button title="Send report" variant="danger" disabled={!reason} loading={sending} onPress={submit} />
            <Button title="Cancel" variant="ghost" color={colors.ink} onPress={close} />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,25,20,0.4)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' },
  content: { padding: space(6), gap: space(3) },
  input: { minHeight: 88, textAlignVertical: 'top', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, padding: space(3), fontSize: 16, color: colors.ink },
});
