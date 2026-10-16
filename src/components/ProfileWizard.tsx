/**
 * Profile editor used in two modes:
 *   - "onboarding": one question per screen in four chapters
 *     (You · Looking for · Your shelf · Ground rules). Nothing is preselected,
 *     so tapping through can't publish a wrong gender or birthday. Ends with
 *     the community rules (App Store guideline 1.2) and short explainers
 *     before the location and notification permission prompts.
 *   - "edit": the same questions grouped on one page; birthday is read-only
 *     (locked after onboarding, enforced by the database).
 * Picking a mode previews its accent across the app right away.
 */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Slider } from '@/components/Slider';
import { Ambient, Button, Chip, ChipGroup, Field, Label } from '@/components/ui';
import { DISTANCE_MAX, defaultUnit, formatDistance, toKm, toUnit, type DistanceUnit } from '@/constants/distance';
import { GENDERS, GENRES, type Gender } from '@/constants/genres';
import { MODES, type LookingFor } from '@/constants/modes';
import { fonts, getTheme, keyboardBehavior, radius, space, TOUCH, type, type Theme } from '@/constants/theme';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { requestLocationPermission } from '@/lib/location';
import { requestPushPermission } from '@/lib/push';
import { usePreviewMode, useStyles, useTheme } from '@/lib/theme';
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
  const t = useTheme();
  const s = useStyles(make);
  const previewMode = usePreviewMode();
  const tone = MODES[p.looking_for ?? 'dating'];
  // Re-theme as soon as a mode is picked; drop the preview on leaving (e.g. Cancel).
  useEffect(() => { if (p.looking_for) previewMode(p.looking_for); }, [p.looking_for, previewMode]);
  useEffect(() => () => previewMode(null), [previewMode]);
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
      <Text style={[s.body, !p.birthdate && { color: t.ink3 }]}>{p.birthdate ? prettyDate(p.birthdate) : 'Choose your birthday'}</Text>
      <Text style={{ color: t.accInk, fontFamily: fonts.uiSemi }}>{p.birthdate ? 'Change' : 'Choose'}</Text>
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
          {!p.birthdate && Platform.OS === 'ios' ? <Text style={s.small}>Scroll to your date of birth.</Text> : null}
          {p.birthdate ? <Text style={[s.h2, { color: t.accInk }]} accessibilityLiveRegion="polite">You&apos;re {ageOf(p.birthdate)}.</Text> : null}
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
            {GENDERS.map((g) => <Chip radio key={g.value} label={g.label} selected={p.gender === g.value} onPress={() => set({ gender: g.value })} />)}
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
                  <Chip key={g.value} label={g.label} selected={p.interested_in.includes(g.value)}
                    onPress={() => set({ interested_in: toggle<Gender>(p.interested_in, g.value) })} />
                ))}
              </ChipGroup>
            </>
          )}
          <View style={s.row}>
            <Label>Age range</Label>
            <Text style={s.value}>{p.age_min} – {p.age_max}</Text>
          </View>
          <Slider values={[p.age_min, p.age_max]} min={18} max={99} labels={['Youngest age', 'Oldest age']}
            describe={(v) => `${v} years`} onChange={([age_min, age_max]) => set({ age_min, age_max })} />
          <View style={s.row}>
            <Label>Distance</Label>
            <Text style={s.value}>Up to {formatDistance(p.max_km, unit)}</Text>
          </View>
          <Slider values={[toUnit(p.max_km, unit)]} min={1} max={DISTANCE_MAX[unit]} labels={['Maximum distance']}
            describe={(v) => `${v} ${unit === 'mi' ? 'miles' : 'kilometres'}`} onChange={([n]) => set({ max_km: toKm(n, unit) })} />
          <View style={s.row}>
            <Text style={[s.small, { flex: 1 }]}>Always local, so a coffee‑shop book club is easy.</Text>
            {/* Switching units keeps roughly the same distance, rounded to a whole km / mile. */}
            <View style={s.units} accessibilityRole="radiogroup">
              {UNITS.map((u) => (
                <Pressable key={u.value} hitSlop={8} accessibilityRole="radio" accessibilityLabel={u.label}
                  accessibilityState={{ checked: unit === u.value }} style={[s.unit, unit === u.value && { backgroundColor: t.acc }]}
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
            <Chip key={g.slug} label={g.label} selected={p.genres.includes(g.slug)}
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
              <Icon name="check" size={16} color={t.accInk} />
              <Text style={[s.body, { flex: 1 }]}>{r}</Text>
            </View>
          ))}
          <Pressable style={s.agree} onPress={() => setAgreed(!agreed)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
            <View style={[s.checkbox, agreed && { backgroundColor: t.acc, borderColor: t.acc }]}>
              {agreed && <Icon name="check" size={14} color="#fff" />}
            </View>
            <Text style={[s.small, { flex: 1, color: t.ink }]}>
              I&apos;m 18 or older and agree to the{' '}
              <Text style={s.link} onPress={() => Linking.openURL(config.termsUrl)}>Terms & Community Rules</Text> and{' '}
              <Text style={s.link} onPress={() => Linking.openURL(config.privacyUrl)}>Privacy Policy</Text>.
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
      body: <Explainer icon="location"
        text={`BookDate matches you with readers within ${formatDistance(p.max_km, unit)}. Your location is rounded to about 100 m and never shown to anyone.`} />,
    },
    {
      key: 'notifications', chapter: 3, title: "Don't miss a match",
      valid: true,
      action: { title: 'Turn on notifications', run: requestPushPermission },
      body: <Explainer icon="bell"
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

  if (editing) return <EditForm steps={steps} birthdate={p.birthdate} saving={saving} error={error} onSave={save} />;

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const next = () => (isLast ? save() : setStep(step + 1));

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Ambient />
      <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
        <View style={s.progress} accessible accessibilityLabel={`Step ${step + 1} of ${steps.length}: ${CHAPTERS[current.chapter]}`}>
          {CHAPTERS.map((c, i) => (
            <View key={c} style={{ flex: 1, gap: space(1) }}>
              <View style={[s.bar, i <= current.chapter && { backgroundColor: t.acc }]} />
              <Text style={[s.chapter, i === current.chapter && { color: t.accInk }]} numberOfLines={1}>{c}</Text>
            </View>
          ))}
        </View>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.title} accessibilityRole="header">{current.title}</Text>
          {current.subtitle ? <Text style={[s.body, { color: t.ink2 }]}>{current.subtitle}</Text> : null}
          {current.body}
          {error ? <Text style={[s.body, { color: t.danger }]} accessibilityLiveRegion="polite">{error}</Text> : null}
        </ScrollView>
        <View style={s.footer}>
          {current.action ? (
            <>
              <Button title="Not now" variant="ghost" onPress={next} disabled={saving} style={{ flex: 1 }} />
              <Button title={current.action.title} loading={saving} style={{ flex: 2 }}
                onPress={() => current.action!.run().catch(() => undefined).finally(next)} />
            </>
          ) : (
            <>
              {step > 0 && <Button title="Back" variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
              <Button title={isLast ? tone.finish : 'Continue'} onPress={next}
                disabled={!current.valid} loading={saving} style={{ flex: 2 }} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Edit profile: the same questions grouped on one scrolling page, birthday read-only. */
function EditForm({ steps, birthdate, saving, error, onSave }: {
  steps: Step[]; birthdate: string | null; saving: boolean; error: string; onSave: () => void;
}) {
  const t = useTheme();
  const s = useStyles(make);
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
              <Text style={s.h2} accessibilityRole="header">{g.title}</Text>
              {g.keys.map((k) => (
                <View key={k} style={s.section}>
                  {k === 'mode' && <Text style={s.small}>{by(k).subtitle}</Text>}
                  {by(k).body}
                  {k === 'name' && birthdate && (
                    <View style={{ gap: space(1.5) }}>
                      <Label>Birthday</Label>
                      <Text style={s.body}>{prettyDate(birthdate)}</Text>
                      <Text style={s.small}>Birthdays can&apos;t be changed in the app. Wrong? Contact support from your Profile.</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
          {error ? <Text style={[s.body, { color: t.danger }]} accessibilityLiveRegion="polite">{error}</Text> : null}
        </ScrollView>
        <View style={s.footer}>
          <Button title="Save" onPress={onSave} disabled={!valid} loading={saving} style={{ flex: 1 }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A mode option, drawn in that mode's own accent. */
function ModeCard({ mode, selected, onPress }: { mode: LookingFor; selected: boolean; onPress: () => void }) {
  const app = useTheme();
  const s = useStyles(make);
  const m = MODES[mode];
  const t = getTheme(app.scheme, mode);
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress}
      style={[s.mode, selected && { borderColor: t.acc, borderWidth: 2 }]}>
      <View style={[s.modeIcon, { backgroundColor: t.accSoft }]}><Icon name={mode === 'friends' ? 'people' : 'heart'} size={20} color={t.accInk} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.body, { fontFamily: fonts.uiBold }]}>{m.label}</Text>
        <Text style={s.small}>{m.blurb}</Text>
      </View>
      <View style={[s.radio, selected && { borderColor: t.acc, borderWidth: 7 }]} />
    </Pressable>
  );
}

function Explainer({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  const s = useStyles(make);
  return (
    <View style={s.explainer}>
      <View style={s.explainerIcon}><Icon name={icon} size={40} color={t.accInk} /></View>
      <Text style={[s.body, { textAlign: 'center', color: t.ink2 }]}>{text}</Text>
    </View>
  );
}

const make = (t: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.bg },
  title: { ...type.hero, color: t.ink },
  h2: { ...type.title, color: t.ink },
  body: { ...type.body, color: t.ink },
  small: { ...type.bodySm, color: t.ink2 },
  content: { padding: space(6), gap: space(5) },
  section: { gap: space(4) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(3) },
  value: { ...type.body, fontFamily: fonts.uiSemi, color: t.ink },
  bio: { minHeight: 96, textAlignVertical: 'top' },
  dateButton: { minHeight: TOUCH + 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.surface, borderWidth: 1, borderColor: t.lineStrong, borderRadius: radius.md, padding: space(3.5) },
  units: { flexDirection: 'row', borderWidth: 1, borderColor: t.lineStrong, borderRadius: radius.pill, padding: 2 },
  unit: { paddingHorizontal: space(3.5), paddingVertical: space(1.5), borderRadius: radius.pill },
  unitText: { ...type.bodySm, fontFamily: fonts.uiSemi, color: t.ink2 },
  rule: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start' },
  agree: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start', paddingVertical: space(2) },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: t.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  link: { fontFamily: fonts.uiSemi, color: t.accInk, textDecorationLine: 'underline' },
  progress: { flexDirection: 'row', gap: space(2), paddingHorizontal: space(6), paddingTop: space(3) },
  bar: { height: 4, borderRadius: 2, backgroundColor: t.line },
  chapter: { fontFamily: fonts.uiSemi, fontSize: 11, color: t.ink3 },
  footer: { flexDirection: 'row', gap: space(3), padding: space(4), paddingHorizontal: space(6) },
  mode: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.lg, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface },
  modeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: t.lineStrong },
  explainer: { alignItems: 'center', gap: space(5), paddingVertical: space(6) },
  explainerIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: t.accSoft, alignItems: 'center', justifyContent: 'center' },
});
