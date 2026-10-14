/**
 * Welcome + sign in: Apple (iOS), Google (when configured), or email/password.
 * New email accounts confirm with the 6-digit code from the sign-up email,
 * entered right here, so nobody has to leave the app to click a link.
 * Behind the copy, a slowly drifting collage of covers sets the tone.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '@/components/Icon';
import { Button, Field, Glass, Gradient } from '@/components/ui';
import { fonts, keyboardBehavior, space, type, type Theme } from '@/constants/theme';
import { googleEnabled, useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { useStyles, useTheme } from '@/lib/theme';

export default function SignIn() {
  const { signInWithApple, signInWithGoogle, signInWithEmail, resendEmailCode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Set while waiting for the user to enter their confirmation code. */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const apple = async () => {
    try {
      await signInWithApple();
    } catch (e: unknown) {
      // User closing the Apple sheet is not an error worth showing.
      if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') Alert.alert('Sign in failed', errorMessage(e));
    }
  };

  const google = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert('Google sign in failed', errorMessage(e));
    }
  };

  const withEmail = async () => {
    setBusy(true);
    try {
      const needsConfirm = await signInWithEmail(email.trim(), password, create);
      if (needsConfirm) {
        // Signing in to an unconfirmed account: send a fresh code first.
        if (!create) await resendEmailCode(email.trim());
        setPendingEmail(email.trim());
      }
    } catch (e) {
      Alert.alert(create ? 'Sign up failed' : 'Sign in failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const t = useTheme();
  const st = useStyles(make);
  const [emailOpen, setEmailOpen] = useState(false);

  return (
    <View style={st.screen}>
      <Collage />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
            <View style={st.brandRow}>
              <Gradient style={st.logo}><Icon name="book" size={28} color="#FFFFFF" /></Gradient>
              <Text style={[type.wordmark, { color: t.ink }]} accessibilityRole="header" accessibilityLabel="BookDate">
                book<Text style={{ fontFamily: fonts.serifItalic, color: t.accInk, letterSpacing: 0 }}>date</Text>
              </Text>
            </View>
            <Text style={[type.hero, { color: t.ink }]}>Swipe on covers, not faces.</Text>
            <Text style={[type.body, { color: t.ink2 }]}>When a reader nearby loves the same book, it&apos;s a date.</Text>

            <View style={{ gap: space(2.5), marginTop: space(2) }}>
              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={t.scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={27}
                  style={{ height: 54 }}
                  onPress={apple}
                />
              )}
              {googleEnabled && (
                <Pressable accessibilityRole="button" onPress={google} style={({ pressed }) => pressed && { opacity: 0.7 }}>
                  <Glass strong style={st.google}>
                    <GoogleG />
                    <Text style={[st.googleText, { color: t.ink }]}>Continue with Google</Text>
                  </Glass>
                </Pressable>
              )}

              {pendingEmail ? (
                <ConfirmCode email={pendingEmail} onBack={() => setPendingEmail(null)} />
              ) : emailOpen ? (
                <>
                  <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
                    keyboardType="email-address" textContentType="emailAddress" placeholder="you@example.com" />
                  <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry
                    textContentType={create ? 'newPassword' : 'password'} placeholder="At least 8 characters" />
                  <Button title={create ? 'Create account' : 'Sign in'} onPress={withEmail} loading={busy}
                    disabled={!email.includes('@') || password.length < 8} />
                  <Button title={create ? 'I already have an account' : 'New here? Create an account'} variant="ghost" onPress={() => setCreate(!create)} />
                </>
              ) : (
                <Button title="Use email instead" variant="ghost" onPress={() => setEmailOpen(true)} />
              )}
            </View>

            <Text style={[type.caption, { textAlign: 'center', color: t.ink3 }]}>
              18+ only. By continuing you agree to our{' '}
              <Text style={st.link} onPress={() => Linking.openURL(config.termsUrl)}>Terms</Text> and{' '}
              <Text style={st.link} onPress={() => Linking.openURL(config.privacyUrl)}>Privacy Policy</Text>.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ------------------------------------------------------------- collage ---

/** Well-loved covers for the welcome collage (Open Library, no sign-in needed). */
const ISBNS = ['9780316556347', '9780593135204', '9780307744432', '9781635575637', '9780593321201',
  '9780571364879', '9781501161933', '9780525559474', '9780441172719', '9781984822178'];
const coverUrl = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
const COVER_H = 186;
const GAP = 14;
const PER_COLUMN = 12;
const OFFSETS = [-40, 30, -90, 10];

/** Four tilted columns of covers, each drifting slowly; faded into the background behind the copy. */
function Collage() {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const colWidth = (width + 140 - GAP * 3) / 4;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={{ position: 'absolute', top: -80, left: -70, right: -70, height: 640, flexDirection: 'row', gap: GAP, transform: [{ rotate: '-9deg' }] }}>
        {OFFSETS.map((off, i) => (
          <Column key={i} index={i} offset={off} width={colWidth} />
        ))}
      </View>
      <LinearGradient colors={[`${t.bg}00`, t.bg]} locations={[0.2, 0.68]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height }} />
    </View>
  );
}

function Column({ index, offset, width }: { index: number; offset: number; width: number }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  const span = (PER_COLUMN * (COVER_H + GAP)) / 2;
  useEffect(() => {
    if (reduce) return;
    y.set(withRepeat(withTiming(-span, { duration: (34 + index * 7) * 1000, easing: Easing.linear }), -1, true));
  }, [reduce, span, index, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() + offset }] }));
  const isbns = [...ISBNS.slice(index * 2), ...ISBNS.slice(0, index * 2), ...ISBNS].slice(0, PER_COLUMN);
  return (
    <Animated.View style={[{ width, gap: GAP }, style]}>
      {isbns.map((isbn, i) => (
        <Image key={i} source={{ uri: coverUrl(isbn) }} cachePolicy="memory-disk" contentFit="cover"
          style={{ width, height: COVER_H, borderRadius: 14 }} />
      ))}
    </Animated.View>
  );
}

/** Google's multicolour "G" mark (brand asset, drawn as SVG). */
function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

const RESEND_SECONDS = 60;

/** Step 2 of email sign-up: enter the code from the confirmation email. */
function ConfirmCode({ email, onBack }: { email: string; onBack: () => void }) {
  const { verifyEmailCode, resendEmailCode } = useAuth();
  const t = useTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async () => {
    setBusy(true);
    try {
      await verifyEmailCode(email, code); // success signs in → onboarding
    } catch (e) {
      Alert.alert('That code didn\'t work', `${errorMessage(e)}\n\nCheck the latest email, or resend a new code.`);
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await resendEmailCode(email);
      setCooldown(RESEND_SECONDS);
      Alert.alert('Code sent', `A new code is on its way to ${email}.`);
    } catch (e) {
      Alert.alert('Could not resend', errorMessage(e));
    }
  };

  return (
    <>
      <Text style={[type.title, { textAlign: 'center', color: t.ink }]}>Check your email</Text>
      <Text style={[type.bodySm, { textAlign: 'center', fontSize: 15, color: t.ink2 }]}>
        We sent a code to <Text style={{ fontFamily: fonts.uiBold, color: t.ink }}>{email}</Text>. Enter it below
        (or tap the link in the email, then come back and sign in).
      </Text>
      <Field label="Confirmation code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
        keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={8}
        autoFocus placeholder="123456" />
      <Button title="Confirm" onPress={verify} loading={busy} disabled={code.length < 6} />
      <Button title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'} variant="ghost"
        disabled={cooldown > 0} onPress={resend} />
      <Button title="Use a different email" variant="ghost" onPress={onBack} />
    </>
  );
}

const make = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 28, paddingBottom: 44, gap: 14 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  google: { height: 54, borderRadius: 27, borderColor: t.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleText: { fontFamily: fonts.uiSemi, fontSize: 17 },
  link: { color: t.accInk, fontFamily: fonts.uiSemi, textDecorationLine: 'underline' },
});
