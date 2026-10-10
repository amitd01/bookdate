/** Profile & settings: your reader card, preferences, legal, sign out, delete account. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button } from '@/components/ui';
import { formatDistance } from '@/constants/distance';
import { GENDERS, genreLabel } from '@/constants/genres';
import { colors, radius, space, type } from '@/constants/theme';
import { deleteAccount } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/errors';

const ageFrom = (birthdate: string) => Math.floor((Date.now() - new Date(birthdate).getTime()) / 31_557_600_000);
const genderLabel = (g: string) => GENDERS.find((x) => x.value === g)?.label ?? g;

export default function Profile() {
  const { profile, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  if (!profile) return null;

  const confirmDelete = () =>
    Alert.alert('Delete account?', 'This permanently deletes your profile, swipes, matches and messages. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setDeleting(true);
        try { await deleteAccount(); } catch (e) { Alert.alert('Could not delete account', errorMessage(e)); setDeleting(false); }
      } },
    ]);

  const rows: [string, string][] = [
    ['Looking for', profile.interested_in.map(genderLabel).join(', ')],
    ['Ages', `${profile.age_min} – ${profile.age_max}`],
    ['Distance', `Up to ${formatDistance(profile.max_km, profile.distance_unit)}`],
  ];

  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.card}>
        <Avatar name={profile.display_name} size={72} />
        <Text style={type.title}>{profile.display_name}, {ageFrom(profile.birthdate)}</Text>
        {profile.bio ? <Text style={[type.body, { textAlign: 'center', color: colors.inkMuted }]}>{profile.bio}</Text> : null}
        <Text style={type.small}>{profile.genres.map(genreLabel).join(' · ')}</Text>
      </View>

      <View style={s.card}>
        {rows.map(([k, v]) => (
          <View key={k} style={s.row}><Text style={type.small}>{k}</Text><Text style={type.body}>{v}</Text></View>
        ))}
      </View>

      <Button title="Edit profile & preferences" variant="secondary" onPress={() => router.push('/edit-profile')} />
      <View style={s.links}>
        <Button title="Terms & Community Rules" variant="ghost" onPress={() => Linking.openURL(config.termsUrl)} />
        <Button title="Privacy Policy" variant="ghost" onPress={() => Linking.openURL(config.privacyUrl)} />
        <Button title="Contact support" variant="ghost" onPress={() => Linking.openURL(`mailto:${config.supportEmail}`)} />
      </View>
      <Button title="Sign out" variant="secondary" onPress={signOut} />
      <Button title="Delete account" variant="danger" onPress={confirmDelete} loading={deleting} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: space(4), gap: space(4), paddingBottom: space(10) },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space(5), gap: space(2), alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', paddingVertical: space(1) },
  links: { gap: 0 },
});
