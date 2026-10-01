/** Welcome + sign in: Apple (iOS), Google (when configured), or email/password. */
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/ui';
import { colors, keyboardBehavior, space, type } from '@/constants/theme';
import { googleEnabled, useAuth } from '@/lib/auth';
import { config } from '@/lib/config';

export default function SignIn() {
  const { signInWithApple, signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const apple = async () => {
    try {
      await signInWithApple();
    } catch (e: unknown) {
      // User closing the Apple sheet is not an error worth showing.
      if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') Alert.alert('Sign in failed', String((e as Error).message));
    }
  };

  const google = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert('Google sign in failed', (e as Error).message);
    }
  };

  const withEmail = async () => {
    setBusy(true);
    try {
      const needsConfirm = await signInWithEmail(email.trim(), password, create);
      if (needsConfirm) Alert.alert('Check your inbox', 'Confirm your email, then sign in.');
    } catch (e) {
      Alert.alert(create ? 'Sign up failed' : 'Sign in failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.hero}>
            <Text style={s.logo}>📚❤️</Text>
            <Text style={s.brand}>BookDate</Text>
            <Text style={[type.body, s.tagline]}>
              Swipe on covers, not faces. When a reader nearby loves the same book, it&apos;s a date.
            </Text>
          </View>

          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={26}
              style={{ height: 52 }}
              onPress={apple}
            />
          )}
          {googleEnabled && (
            <GoogleSigninButton size={GoogleSigninButton.Size.Wide} color={GoogleSigninButton.Color.Light}
              style={{ alignSelf: 'stretch', height: 52 }} onPress={google} />
          )}

          <Text style={[type.small, { textAlign: 'center' }]}>or use email</Text>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
            keyboardType="email-address" textContentType="emailAddress" placeholder="you@example.com" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry
            textContentType={create ? 'newPassword' : 'password'} placeholder="At least 8 characters" />
          <Button title={create ? 'Create account' : 'Sign in'} onPress={withEmail} loading={busy}
            disabled={!email.includes('@') || password.length < 8} />
          <Button title={create ? 'I already have an account' : 'New here? Create an account'} variant="ghost" onPress={() => setCreate(!create)} />

          <Text style={[type.small, { textAlign: 'center' }]}>
            18+ only. By continuing you agree to our{' '}
            <Text style={s.link} onPress={() => Linking.openURL(config.termsUrl)}>Terms</Text> and{' '}
            <Text style={s.link} onPress={() => Linking.openURL(config.privacyUrl)}>Privacy Policy</Text>.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: space(6), gap: space(4), flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: space(2), marginBottom: space(6) },
  logo: { fontSize: 56 },
  brand: { ...type.title, fontSize: 42, color: colors.accent },
  tagline: { textAlign: 'center', color: colors.inkMuted, paddingHorizontal: space(4) },
  link: { color: colors.accent, fontWeight: '600' },
});
