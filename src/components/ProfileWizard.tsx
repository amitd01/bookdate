/**
 * Profile editor used in two modes:
 *   - "onboarding": one question per screen in four chapters
 *     (You · Looking for · Your shelf · Ground rules). Nothing is preselected,
 *     so tapping through can't publish a wrong gender or birthday. Ends with
 *     the community rules (App Store guideline 1.2) and short explainers
 *     before the location and notification permission prompts.
 *   - "edit": the same questions grouped on one page; birthday is read-only
 *     (locked after onboarding, enforced by the database).
 */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Slider } from '@/components/Slider';
import { Button, Chip, ChipGroup, Field, Label } from '@/components/ui';
import { DISTANCE_MAX, defaultUnit, formatDistance, toKm, toUnit, type DistanceUnit } from '@/constants/distance';
import { GENDERS, GENRES, type Gender } from '@/constants/genres';
import { MODES, type LookingFor } from '@/constants/modes';
import { colors, keyboardBehavior, radius, space, TOUCH, type } from '@/constants/theme';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { requestLocationPermission } from '@/lib/location';
import { requestPushPermission } from '@/lib/push';
import { ageOf, fromISODate, toISODate } from '@/lib/time';
import type { ProfileInput } from '@/lib/types';

const MIN_GENRES = 3;
const CHAPTERS = ['You', 'Looking for', 'Your shelf', 'Ground rules'] as const;
const UNITS: { value: DistanceUnit; label: string }[] = [{ value: 'km', label: 'Kilometres' }, { value: 'mi', label: 'Miles' }];
const RULES = [
  'Be kind. Talk books, not bodies.',
  'Meet in public, and tell a friend where you’ll be.',
  'BookDate will never ask you for money. Nor should a match.',
  'Report anything that feels off. Reported readers are removed.',
];


const yearsAgo = (n: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setFullYear(d.getFullYear() - n); return d; };
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const prettyDate = (iso: string) => fromISODate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/** Form state: gender, birthday and mode start empty until the reader picks them. */
type Draft = Omit<ProfileInput, 'gender' | 'birthdate' | 'looking_for'> & { gender: Gender | null; birthdate: string | null; looking_for: LookingFor | null };

type Step = {
  key: string;
  chapter: number;
  title: string;
  subtitle?: string;
  valid: boolean;
  body: ReactNode;
  /** Explainer steps: the primary button runs this (e.g. a permission prompt), "Not now" skips it. */
  action?: { title: string; run: () => Promise<unknown> };
};

type Props = {
  mode: 'onboarding' | 'edit';
  initial?: Partial<ProfileInput>;
  onSubmit: (p: ProfileInput) => Promise<void>;
};

export function ProfileWizard({ mode, initial, onSubmit }: Props) {
  const editing = mode === 'edit';
  const [p, setP] = useState<Draft>({
    display_name: '', birthdate: null, gender: null, interested_in: [], looking_for: null,
    age_min: 21, age_max: 45, max_km: 15, distance_unit: defaultUnit(), genres: [], bio: '', ...initial,
  });
  const [agreed, setAgreed] = useState(editing);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<Draft>) => setP((cur) => ({ ...cur, ...patch }));
  const tone = p.looking_for ? MODES[p.looking_for] : MODES.dating;
  const unit = p.distance_unit;
  const dating = p.looking_for !== 'friends';

  const pickBirthday = (d: Date) => set({ birthdate: toISODate(d) });
  const birthdayPicker = Platform.OS === 'ios' ? (
    <DateTimePicker value={p.birthdate ? fromISODate(p.birthdate) : yearsAgo(25)} mode="date" display="spinner"
      maximumDate={yearsAgo(18)} minimumDate={yearsAgo(100)} onChange={(_, d) => d && pickBirthday(d)} />
  ) : (
    // Android's picker is a dialog, so show the date (or a prompt) and open it on tap.
    <Pressable style={s.dateButton} accessibilityRole="button" onPress={() => DateTimePickerAndroid.open({
      value: p.birthdate ? fromISODate(p.birthdate) : yearsAgo(25), mode: 'date', maximumDate: yearsAgo(18), minimumDate: yearsAgo(100),
      onChange: (e, d) => { if (e.type === 'set' && d) pickBirthday(d); },
    })}>
      <Text style={[type.body, !p.birthdate && { color: colors.ink3 }]}>{p.birthdate ? prettyDate(p.birthdate) : 'Choose your birthday'}</Text>
      <Text style={{ color: tone.color, fontWeight: '600' }}>{p.birthdate ? 'Change' : 'Choose'}</Text>
    </Pressable>
  );

  const steps: Step[] = [
    {
      key: 'name', chapter: 0, title: "What's your first name?",
      subtitle: 'Only your first name and age are shown to matches.',
      valid: p.display_name.trim().length > 0,
      body: <Field label="First name" value={p.display_name} onChangeText={(t) => set({ display_name: t })}
        maxLength={40} autoCapitalize="words" textContentType="givenName" placeholder="e.g. Maya" />,
    },
    {
      key: 'birthday', chapter: 0, title: "When's your birthday?",
      subtitle: "You must be 18 or older. Your birthday can't be changed later, so check it carefully.",
      valid: !!p.birthdate && ageOf(p.birthdate) >= 18,
      body: (
        <>
          {birthdayPicker}
          {!p.birthdate && Platform.OS === 'ios' ? <Text style={type.small}>Scroll to your date of birth.</Text> : null}
          {p.birthdate ? <Text style={[type.h2, { color: tone.color }]} accessibilityLiveRegion="polite">You&apos;re {ageOf(p.birthdate)}.</Text> : null}
        </>
      ),
    },
    {
      key: 'gender', chapter: 0, title: 'How do you identify?',
      valid: !!p.gender,
      body: (
        <>
          <Label>I am a</Label>
          <ChipGroup>
            {GENDERS.map((g) => <Chip radio key={g.value} label={g.label} color={tone.color} selected={p.gender === g.value} onPress={() => set({ gender: g.value })} />)}
          </ChipGroup>
        </>
      ),
    },
    {
      key: 'mode', chapter: 1, title: 'What are you here for?',
      subtitle: editing ? 'Switching keeps your existing matches.' : 'You can switch anytime in Profile. Your matches stay.',
      valid: !!p.looking_for,
      body: (
        <View style={{ gap: space(3) }} accessibilityRole="radiogroup">
          {(['dating', 'friends'] as const).map((m) => (
            <ModeCard key={m} mode={m} selected={p.looking_for === m} onPress={() => set({ looking_for: m })} />
          ))}
        </View>
      ),
    },
    {
      key: 'who', chapter: 1, title: 'Who would you like to meet?',
      subtitle: dating ? 'Matches go both ways: they fit your choices and you fit theirs.' : 'Friends mode matches readers of any gender who are also here for friends.',
      valid: (!dating || p.interested_in.length > 0) && p.age_min <= p.age_max,
      body: (
        <>
          {dating && (
            <>
              <Label>Interested in</Label>
              <ChipGroup>
                {GENDERS.map((g) => (
                  <Chip key={g.value} label={g.label} color={tone.color} selected={p.interested_in.includes(g.value)}
                    onPress={() => set({ interested_in: toggle<Gender>(p.interested_in, g.value) })} />
                ))}
              </ChipGroup>
            </>
          )}
          <View style={s.row}>
            <Label>Age range</Label>
            <Text style={s.value}>{p.age_min} – {p.age_max}</Text>
          </View>
          <Slider values={[p.age_min, p.age_max]} min={18} max={99} color={tone.color} labels={['Youngest age', 'Oldest age']}
            describe={(v) => `${v} years`} onChange={([age_min, age_max]) => set({ age_min, age_max })} />
          <View style={s.row}>
            <Label>Distance</Label>
            <Text style={s.value}>Up to {formatDistance(p.max_km, unit)}</Text>
          </View>
          <Slider values={[toUnit(p.max_km, unit)]} min={1} max={DISTANCE_MAX[unit]} color={tone.color} labels={['Maximum distance']}
            describe={(v) => `${v} ${unit === 'mi' ? 'miles' : 'kilometres'}`} onChange={([n]) => set({ max_km: toKm(n, unit) })} />
          <View style={s.row}>
            <Text style={[type.small, { flex: 1 }]}>Always local, so a coffee‑shop book club is easy.</Text>
            {/* Switching units keeps roughly the same distance, rounded to a whole km / mile. */}
            <View style={s.units} accessibilityRole="radiogroup">
              {UNITS.map((u) => (
                <Pressable key={u.value} hitSlop={8} accessibilityRole="radio" accessibilityLabel={u.label}
                  accessibilityState={{ checked: unit === u.value }} style={[s.unit, unit === u.value && { backgroundColor: tone.color }]}
                  onPress={() => set({ distance_unit: u.value, max_km: toKm(toUnit(p.max_km, u.value), u.value) })}>
                  <Text style={[s.unitText, unit === u.value && { color: '#fff' }]}>{u.value}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      ),
    },
    {
      key: 'genres', chapter: 2, title: 'What do you love to read?',
      subtitle: `Pick at least ${MIN_GENRES}. We use these (and your swipes) to choose covers for you.`,
      valid: p.genres.length >= MIN_GENRES,
      body: (
        <ChipGroup>
          {GENRES.map((g) => (
            <Chip key={g.slug} label={g.label} color={tone.color} selected={p.genres.includes(g.slug)}
              onPress={() => set({ genres: toggle(p.genres, g.slug) })} />
          ))}
        </ChipGroup>
      ),
    },
    {
      key: 'bio', chapter: 2, title: 'Your reading life',
      subtitle: 'Optional: a line about what you read, where, and when.',
      valid: true,
      body: <Field label="Bio" value={p.bio ?? ''} onChangeText={(t) => set({ bio: t })} maxLength={300} multiline
        style={s.bio} placeholder="Currently re-reading Dune on the metro. Team annotations." />,
    },
    {
      key: 'rules', chapter: 3, title: 'A few ground rules',
      valid: agreed,
      body: (
        <>
          {RULES.map((r) => (
            <View key={r} style={s.rule}>
              <Icon name="check" size={16} color={tone.color} />
              <Text style={[type.body, { flex: 1 }]}>{r}</Text>
            </View>
          ))}
          <Pressable style={s.agree} onPress={() => setAgreed(!agreed)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
            <View style={[s.checkbox, agreed && { backgroundColor: tone.color, borderColor: tone.color }]}>
              {agreed && <Icon name="check" size={14} color="#fff" />}
            </View>
            <Text style={[type.small, { flex: 1, color: colors.ink }]}>
              I&apos;m 18 or older and agree to the{' '}
              <Text style={[s.link, { color: tone.color }]} onPress={() => Linking.openURL(config.termsUrl)}>Terms & Community Rules</Text> and{' '}
              <Text style={[s.link, { color: tone.color }]} onPress={() => Linking.openURL(config.privacyUrl)}>Privacy Policy</Text>.
              There is zero tolerance for abusive or objectionable content.
            </Text>
          </Pressable>
        </>
      ),
    },
    {
      key: 'location', chapter: 3, title: 'Find readers near you',
      valid: true,
      action: { title: 'Allow location', run: requestLocationPermission },
      body: <Explainer icon="location" color={tone.color}
        text={`BookDate matches you with readers within ${formatDistance(p.max_km, unit)}. Your location is rounded to about 100 m and never shown to anyone.`} />,
    },
    {
      key: 'notifications', chapter: 3, title: "Don't miss a match",
      valid: true,
      action: { title: 'Turn on notifications', run: requestPushPermission },
      body: <Explainer icon="bell" color={tone.color}
        text="We'll tell you when someone nearby loves the same book, and when they reply. You can turn this off anytime in Settings." />,
    },
  ];

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        ...p,
        gender: p.gender!,
        birthdate: p.birthdate!,
        looking_for: p.looking_for!,
        // Friends mode ignores gender; keep the dating choice if there is one, else any.
        interested_in: p.interested_in.length ? p.interested_in : GENDERS.map((g) => g.value),
        display_name: p.display_name.trim(),
        bio: p.bio?.trim() || null,
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (editing) return <EditForm steps={steps} birthdate={p.birthdate} color={tone.color} saving={saving} error={error} onSave={save} />;

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const next = () => (isLast ? save() : setStep(step + 1));

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
        <View style={s.progress} accessible accessibilityLabel={`Step ${step + 1} of ${steps.length}: ${CHAPTERS[current.chapter]}`}>
          {CHAPTERS.map((c, i) => (
            <View key={c} style={{ flex: 1, gap: space(1) }}>
              <View style={[s.bar, i <= current.chapter && { backgroundColor: tone.color }]} />
              <Text style={[s.chapter, i === current.chapter && { color: tone.color }]} numberOfLines={1}>{c}</Text>
            </View>
          ))}
        </View>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={type.title} accessibilityRole="header">{current.title}</Text>
          {current.subtitle ? <Text style={[type.body, { color: colors.inkMuted }]}>{current.subtitle}</Text> : null}
          {current.body}
          {error ? <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">{error}</Text> : null}
        </ScrollView>
        <View style={s.footer}>
          {current.action ? (
            <>
              <Button title="Not now" variant="ghost" color={tone.color} onPress={next} disabled={saving} style={{ flex: 1 }} />
              <Button title={current.action.title} color={tone.color} loading={saving} style={{ flex: 2 }}
                onPress={() => current.action!.run().catch(() => undefined).finally(next)} />
            </>
          ) : (
            <>
              {step > 0 && <Button title="Back" variant="ghost" color={tone.color} onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
              <Button title={isLast ? tone.finish : 'Continue'} color={tone.color} onPress={next}
                disabled={!current.valid} loading={saving} style={{ flex: 2 }} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Edit profile: the same questions grouped on one scrolling page, birthday read-only. */
function EditForm({ steps, birthdate, color, saving, error, onSave }: {
  steps: Step[]; birthdate: string | null; color: string; saving: boolean; error: string; onSave: () => void;
}) {
  const by = (key: string) => steps.find((x) => x.key === key)!;
  const groups: { title: string; keys: string[] }[] = [
    { title: 'About you', keys: ['name', 'gender'] },
    { title: 'Looking for', keys: ['mode', 'who'] },
    { title: 'Your shelf', keys: ['genres', 'bio'] },
  ];
  const valid = groups.every((g) => g.keys.every((k) => by(k).valid));
  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {groups.map((g) => (
            <View key={g.title} style={s.section}>
              <Text style={type.h2} accessibilityRole="header">{g.title}</Text>
              {g.keys.map((k) => (
                <View key={k} style={s.section}>
                  {k === 'mode' && <Text style={type.small}>{by(k).subtitle}</Text>}
                  {by(k).body}
                  {k === 'name' && birthdate && (
                    <View style={{ gap: space(1.5) }}>
                      <Label>Birthday</Label>
                      <Text style={type.body}>{prettyDate(birthdate)}</Text>
                      <Text style={type.small}>Birthdays can&apos;t be changed in the app. Wrong? Contact support from your Profile.</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
          {error ? <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">{error}</Text> : null}
        </ScrollView>
        <View style={s.footer}>
          <Button title="Save" color={color} onPress={onSave} disabled={!valid} loading={saving} style={{ flex: 1 }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ModeCard({ mode, selected, onPress }: { mode: LookingFor; selected: boolean; onPress: () => void }) {
  const m = MODES[mode];
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress}
      style={[s.mode, selected && { borderColor: m.color, borderWidth: 2 }]}>
      <View style={[s.modeIcon, { backgroundColor: m.soft }]}><Icon name={mode === 'friends' ? 'people' : 'heart'} size={20} color={m.color} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.body, { fontWeight: '700' }]}>{m.label}</Text>
        <Text style={type.small}>{m.blurb}</Text>
      </View>
      <View style={[s.radio, selected && { borderColor: m.color, borderWidth: 7 }]} />
    </Pressable>
  );
}

function Explainer({ icon, text, color }: { icon: IconName; text: string; color: string }) {
  return (
    <View style={s.explainer}>
      <View style={s.explainerIcon}><Icon name={icon} size={40} color={color} /></View>
      <Text style={[type.body, { textAlign: 'center', color: colors.inkMuted }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: space(6), gap: space(5) },
  section: { gap: space(4) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(3) },
  value: { ...type.body, fontWeight: '600' },
  bio: { minHeight: 96, textAlignVertical: 'top' },
  dateButton: { minHeight: TOUCH + 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, padding: space(3.5) },
  units: { flexDirection: 'row', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.pill, padding: 2 },
  unit: { paddingHorizontal: space(3.5), paddingVertical: space(1.5), borderRadius: radius.pill },
  unitText: { ...type.small, fontWeight: '600' },
  rule: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start' },
  agree: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start', paddingVertical: space(2) },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  link: { fontWeight: '600' },
  progress: { flexDirection: 'row', gap: space(2), paddingHorizontal: space(6), paddingTop: space(3) },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.line },
  chapter: { fontSize: 11, fontWeight: '600', color: colors.ink3 },
  footer: { flexDirection: 'row', gap: space(3), padding: space(4), paddingHorizontal: space(6) },
  mode: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.card },
  modeIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.lineStrong },
  explainer: { alignItems: 'center', gap: space(5), paddingVertical: space(6) },
  explainerIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
