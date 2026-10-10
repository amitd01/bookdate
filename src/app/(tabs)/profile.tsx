/** Profile & settings: your reader card, grouped preferences, help & legal, account. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Group, Row, Tag } from '@/components/ui';
import { formatDistance } from '@/constants/distance';
import { GENDERS, genreLabel } from '@/constants/genres';
import { MODES } from '@/constants/modes';
import { colors, radius, serif, space, type } from '@/constants/theme';
import { deleteAccount } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { inviteFriend } from '@/lib/invite';

const ageFrom = (birthdate: string) => Math.floor((Date.now() - new Date(birthdate).getTime()) / 31_557_600_000);
const genderLabel = (g: string) => GENDERS.find((x) => x.value === g)?.label ?? g;
const edit = () => router.push('/edit-profile');

export default function Profile() {
  const { profile, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  if (!profile) return null;
  const mode = MODES[profile.looking_for];

  const confirmDelete = () =>
    Alert.alert('Delete account?', 'This permanently deletes your profile, likes, matches and messages. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setDeleting(true);
        try { await deleteAccount(); } catch (e) { Alert.alert('Could not delete account', errorMessage(e)); setDeleting(false); }
      } },
    ]);

  return (
    <ScrollView style={{ backgroundColor: colors.sunken }} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Avatar name={profile.display_name} size={72} />
        <Text style={type.title}>{profile.display_name}, {ageFrom(profile.birthdate)}</Text>
        <Tag label={mode.label} color={mode.color} background={mode.soft} />
        {profile.bio ? <Text style={s.bio}>“{profile.bio}”</Text> : null}
        <Text style={[type.small, { textAlign: 'center' }]}>{profile.genres.map(genreLabel).join(' · ')}</Text>
        <Button title="Edit profile" variant="secondary" onPress={edit} style={{ alignSelf: 'stretch', marginTop: space(2) }} />
      </View>

      <Group title="Preferences">
        <Row label="Looking for" value={mode.label} onPress={edit} />
        {profile.looking_for === 'dating' && <Row label="Interested in" value={profile.interested_in.map(genderLabel).join(', ')} onPress={edit} />}
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

      <Group title="Account">
        <Row label="Sign out" onPress={signOut} />
        <Row label={deleting ? 'Deleting…' : 'Delete account'} danger onPress={deleting ? undefined : confirmDelete} />
      </Group>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: space(4), gap: space(5), paddingBottom: space(10) },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space(5), gap: space(2), alignItems: 'center' },
  bio: { ...type.body, fontFamily: serif, fontStyle: 'italic', textAlign: 'center', color: colors.inkMuted },
});
