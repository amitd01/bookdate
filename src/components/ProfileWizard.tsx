/**
 * Profile editor used in two modes:
 *   - "onboarding": one section per step with progress, plus the community
 *     rules agreement (required by App Store guideline 1.2 for UGC apps)
 *   - "edit": all sections on one scrolling page
 * Sections: about you → who to meet → genres → bio.
 */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, ChipGroup, Field, Label, Stepper } from '@/components/ui';
import { GENDERS, GENRES, RADIUS_KM, type Gender } from '@/constants/genres';
import { colors, keyboardBehavior, space, type } from '@/constants/theme';
import { config } from '@/lib/config';
import type { ProfileInput } from '@/lib/types';

const MIN_GENRES = 3;
const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const yearsAgo = (n: number) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d; };
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

type Props = {
  mode: 'onboarding' | 'edit';
  initial?: Partial<ProfileInput>;
  onSubmit: (p: ProfileInput) => Promise<void>;
};

export function ProfileWizard({ mode, initial, onSubmit }: Props) {
  const [p, setP] = useState<ProfileInput>({
    display_name: '', birthdate: toISODate(yearsAgo(25)), gender: 'woman', interested_in: [],
    age_min: 21, age_max: 45, genres: [], bio: '', ...initial,
  });
  const [agreed, setAgreed] = useState(mode === 'edit');
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<ProfileInput>) => setP((cur) => ({ ...cur, ...patch }));

  const sections: { title: string; subtitle: string; valid: boolean; body: ReactNode }[] = [
    {
      title: 'About you',
      subtitle: 'Only your first name and age are shown to matches.',
      valid: p.display_name.trim().length > 0,
      body: (
        <>
          <Field label="First name" value={p.display_name} onChangeText={(t) => set({ display_name: t })}
            maxLength={40} autoCapitalize="words" textContentType="givenName" placeholder="e.g. Maya" />
          <Label>Birthday (18+ only)</Label>
          {Platform.OS === 'ios' ? (
            <DateTimePicker value={new Date(p.birthdate)} mode="date" display="spinner" maximumDate={yearsAgo(18)}
              minimumDate={yearsAgo(100)} onChange={(_, d) => d && set({ birthdate: toISODate(d) })} />
          ) : (
            // Android's picker is a dialog, so show the date and open it on tap.
            <Pressable style={s.dateButton} accessibilityRole="button" onPress={() => DateTimePickerAndroid.open({
              value: new Date(p.birthdate), mode: 'date', maximumDate: yearsAgo(18), minimumDate: yearsAgo(100),
              onChange: (e, d) => { if (e.type === 'set' && d) set({ birthdate: toISODate(d) }); },
            })}>
              <Text style={type.body}>{new Date(p.birthdate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Change</Text>
            </Pressable>
          )}
          <Label>I am a</Label>
          <ChipGroup>
            {GENDERS.map((g) => <Chip key={g.value} label={g.label} selected={p.gender === g.value} onPress={() => set({ gender: g.value })} />)}
          </ChipGroup>
        </>
      ),
    },
    {
      title: 'Who would you like to meet?',
      subtitle: `Book dates are always with readers less than ${RADIUS_KM} km from you.`,
      valid: p.interested_in.length > 0 && p.age_min <= p.age_max,
      body: (
        <>
          <Label>Show me</Label>
          <ChipGroup>
            {GENDERS.map((g) => (
              <Chip key={g.value} label={g.label} selected={p.interested_in.includes(g.value)}
                onPress={() => set({ interested_in: toggle<Gender>(p.interested_in, g.value) })} />
            ))}
          </ChipGroup>
          <Label>Age range</Label>
          <View style={s.row}>
            <Stepper value={p.age_min} min={18} max={p.age_max} onChange={(n) => set({ age_min: n })} />
            <Text style={type.small}>to</Text>
            <Stepper value={p.age_max} min={p.age_min} max={99} onChange={(n) => set({ age_max: n })} />
          </View>
          <Label>Distance</Label>
          <Text style={type.body}>Within {RADIUS_KM} km — always local, so a coffee‑shop book club is easy.</Text>
        </>
      ),
    },
    {
      title: 'What do you love to read?',
      subtitle: `Pick at least ${MIN_GENRES}. We use these (and your swipes) to pick covers for you.`,
      valid: p.genres.length >= MIN_GENRES,
      body: (
        <ChipGroup>
          {GENRES.map((g) => (
            <Chip key={g.slug} label={`${g.emoji} ${g.label}`} selected={p.genres.includes(g.slug)}
              onPress={() => set({ genres: toggle(p.genres, g.slug) })} />
          ))}
        </ChipGroup>
      ),
    },
    {
      title: 'Your reading life',
      subtitle: 'Optional: a line about what you read, where, and when.',
      valid: agreed,
      body: (
        <>
          <Field label="Bio" value={p.bio ?? ''} onChangeText={(t) => set({ bio: t })} maxLength={300} multiline
            style={[s.bio]} placeholder="Currently re-reading Dune on the metro. Team annotations." />
          {mode === 'onboarding' && (
            <Pressable style={s.agree} onPress={() => setAgreed(!agreed)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
              <Text style={s.checkbox}>{agreed ? '☑︎' : '☐'}</Text>
              <Text style={[type.small, { flex: 1 }]}>
                I&apos;m 18 or older and agree to the{' '}
                <Text style={s.link} onPress={() => Linking.openURL(config.termsUrl)}>Terms & Community Rules</Text> and{' '}
                <Text style={s.link} onPress={() => Linking.openURL(config.privacyUrl)}>Privacy Policy</Text>.
                There is zero tolerance for abusive or objectionable content — reported users are removed.
              </Text>
            </Pressable>
          )}
        </>
      ),
    },
  ];

  const isLast = mode === 'edit' || step === sections.length - 1;
  const visible = mode === 'edit' ? sections : [sections[step]];
  const canContinue = visible.every((x) => x.valid);

  const next = async () => {
    if (!isLast) return setStep(step + 1);
    setSaving(true);
    setError('');
    try {
      await onSubmit({ ...p, display_name: p.display_name.trim(), bio: p.bio?.trim() || null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={mode === 'edit' ? ['bottom'] : ['top', 'bottom']}>
      <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
        {mode === 'onboarding' && (
          <View style={s.progress}>
            {sections.map((_, i) => <View key={i} style={[s.dot, i <= step && { backgroundColor: colors.accent }]} />)}
          </View>
        )}
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {visible.map((sec) => (
            <View key={sec.title} style={s.section}>
              <Text style={mode === 'edit' ? type.h2 : type.title}>{sec.title}</Text>
              <Text style={type.small}>{sec.subtitle}</Text>
              {sec.body}
            </View>
          ))}
          {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        </ScrollView>
        <View style={s.footer}>
          {mode === 'onboarding' && step > 0 && <Button title="Back" variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
          <Button title={isLast ? (mode === 'edit' ? 'Save' : 'Find my book date') : 'Continue'}
            onPress={next} disabled={!canContinue} loading={saving} style={{ flex: 2 }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: space(6), gap: space(8) },
  section: { gap: space(4) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  bio: { minHeight: 96, textAlignVertical: 'top' },
  dateButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: space(3.5) },
  agree: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start' },
  checkbox: { fontSize: 22, color: colors.accent },
  link: { color: colors.accent, fontWeight: '600' },
  progress: { flexDirection: 'row', gap: space(2), paddingHorizontal: space(6), paddingTop: space(3) },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line },
  footer: { flexDirection: 'row', gap: space(3), padding: space(4), paddingHorizontal: space(6) },
});
