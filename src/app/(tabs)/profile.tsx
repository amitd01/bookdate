/**
 * Profile & settings: your reader card, the books you loved lately, the
 * "Looking for" switch (which re-themes the app on the spot), grouped
 * preferences, help & legal, and account.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { BookCover } from '@/components/BookCover';
import { useTabInset } from '@/components/TabBar';
import { Ambient, Avatar, Button, Eyebrow, Glass, Group, LargeTitle, Ring, Row, Segmented } from '@/components/ui';
import { formatDistance } from '@/constants/distance';
import { GENDERS, genreLabel } from '@/constants/genres';
import { MODES, type LookingFor } from '@/constants/modes';
import { fonts, radius, space, type, type Theme } from '@/constants/theme';
import { deleteAccount, getLovedBooks, saveProfile, type LovedBook } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { inviteFriend } from '@/lib/invite';
import { usePreviewMode, useStyles, useTheme } from '@/lib/theme';
import { ageOf } from '@/lib/time';

const genderLabel = (g: string) => GENDERS.find((x) => x.value === g)?.label ?? g;
const edit = () => router.push('/edit-profile');
const MODE_OPTIONS = (['dating', 'friends'] as const).map((m) => ({ value: m, label: MODES[m].label }));

export default function Profile() {
  const { profile, signOut, refreshProfile } = useAuth();
  const t = useTheme();
  const s = useStyles(make);
  const previewMode = usePreviewMode();
  const insets = useSafeAreaInsets();
  const tabInset = useTabInset();
  const [deleting, setDeleting] = useState(false);
  const [loved, setLoved] = useState<LovedBook[]>([]);

  // Refresh on focus, so a like on Discover shows up first here.
  useFocusEffect(useCallback(() => { getLovedBooks().then(setLoved).catch(() => undefined); }, []));

  if (!profile) return null;
  const { id: _id, ...fields } = profile;

  /** Switch mode: re-theme instantly, then save; roll back if the save fails. */
  const switchMode = async (m: LookingFor) => {
    if (m === profile.looking_for) return;
    previewMode(m);
    try {
      await saveProfile({ ...fields, looking_for: m });
      await refreshProfile();
    } catch (e) {
      previewMode(null);
      Alert.alert("Couldn't switch", errorMessage(e));
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete account?', 'This permanently deletes your profile, likes, matches and messages. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setDeleting(true);
        try { await deleteAccount(); } catch (e) { Alert.alert('Could not delete account', errorMessage(e)); setDeleting(false); }
      } },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <Ambient />
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 10, paddingBottom: tabInset + space(4) }]}>
        <View style={{ marginHorizontal: -space(5) }}><LargeTitle>Profile</LargeTitle></View>

        <Glass strong style={s.hero}>
          {/* amb1 glow at the top of the card */}
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <RadialGradient id="heroGlow" cx="0.5" cy="0" r="0.7">
                <Stop offset="0" stopColor={t.amb1} stopOpacity={1} />
                <Stop offset="1" stopColor={t.amb1} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#heroGlow)" />
          </Svg>
          <Ring width={84} height={84} r={42} stroke={4} gap={3} colors={[t.acc, t.acc2, t.brand.gold]} gapColor={t.surface}>
            <Avatar name={profile.display_name} size={84} />
          </Ring>
          <Text style={s.name} accessibilityRole="header">{profile.display_name}, {ageOf(profile.birthdate)}</Text>
          <View style={s.modePill}><Text style={s.modeText}>{MODES[profile.looking_for].label}</Text></View>
          {profile.bio ? <Text style={s.bio}>“{profile.bio}”</Text> : null}
          <View style={s.genres}>
            {profile.genres.map((g) => <Text key={g} style={s.genre}>{genreLabel(g)}</Text>)}
          </View>
          <Button title="Edit profile" variant="secondary" onPress={edit} style={{ alignSelf: 'stretch', marginTop: space(2) }} />
        </Glass>

        {loved.length > 0 && (
          <View style={{ gap: space(2.5) }}>
            <Eyebrow style={{ paddingHorizontal: space(1) }}>Loved lately</Eyebrow>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space(5) }}
              contentContainerStyle={{ gap: space(2.5), paddingHorizontal: space(5) }}>
              {loved.map((b) => <BookCover key={b.id} uri={b.cover_url} title={b.title} author={b.author} style={s.loved} radius={radius.sm} titleSize={11} />)}
            </ScrollView>
          </View>
        )}

        <View style={{ gap: space(2.5) }}>
          <Eyebrow style={{ paddingHorizontal: space(1) }}>Looking for</Eyebrow>
          <Segmented options={MODE_OPTIONS} value={t.mode} onChange={switchMode} />
        </View>

        <Group title="Preferences">
          {t.mode === 'dating' && <Row label="Interested in" value={profile.interested_in.map(genderLabel).join(', ')} onPress={edit} />}
          <Row label="Ages" value={`${profile.age_min} – ${profile.age_max}`} onPress={edit} />
          <Row label="Distance" value={`Up to ${formatDistance(profile.max_km, profile.distance_unit)}`} onPress={edit} />
        </Group>

        <Group title="BookDate">
          <Row label="Invite a friend who reads" onPress={inviteFriend} />
          <Row label="Safety tips" onPress={() => Linking.openURL(config.safetyUrl)} />
          <Row label="Contact support" onPress={() => Linking.openURL(`mailto:${config.supportEmail}`)} />
          <Row label="Terms & Community Rules" onPress={() => Linking.openURL(config.termsUrl)} />
          <Row label="Privacy Policy" onPress={() => Linking.openURL(config.privacyUrl)} />
        </Group>

        <Group>
          <Row label="Sign out" onPress={signOut} />
          <Row label={deleting ? 'Deleting…' : 'Delete account'} danger onPress={deleting ? undefined : confirmDelete} />
        </Group>
      </ScrollView>
    </View>
  );
}

const make = (t: Theme) => StyleSheet.create({
  content: { paddingHorizontal: space(5), gap: 22 },
  hero: { borderRadius: 30, paddingTop: space(6), paddingHorizontal: space(5), paddingBottom: space(5), gap: space(2), alignItems: 'center' },
  name: { fontFamily: fonts.uiHeavy, fontSize: 28, letterSpacing: -0.6, color: t.ink, marginTop: space(1) },
  modePill: { backgroundColor: t.accSoft, borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: 4 },
  modeText: { fontFamily: fonts.uiBold, fontSize: 13, color: t.accInk },
  bio: { ...type.quote, color: t.ink2, textAlign: 'center' },
  genres: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: space(1) },
  genre: { fontFamily: fonts.uiSemi, fontSize: 12.5, color: t.ink, borderWidth: 1, borderColor: t.line, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  loved: { width: 64, height: 96 },
});
