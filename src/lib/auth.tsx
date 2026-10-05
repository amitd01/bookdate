/**
 * Auth + profile state for the whole app.
 *   session === null            -> signed out   (sign-in screen)
 *   session && profile === null -> needs onboarding
 *   session && profile          -> main app
 * Sign-in methods: Sign in with Apple (iOS), Google (iOS + Android, when
 * configured) and email/password (also used for the App Review demo account).
 */
import type { Session } from '@supabase/supabase-js';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { analytics } from './analytics';
import { getMyProfile } from './api';
import { config } from './config';
import { supabase } from './supabase';
import type { Profile } from './types';

/** Google sign-in needs the web client ID everywhere, plus an iOS client ID on iOS. */
export const googleEnabled = !!config.googleWebClientId && (Platform.OS !== 'ios' || !!config.googleIosClientId);
if (googleEnabled) {
  GoogleSignin.configure({ webClientId: config.googleWebClientId, iosClientId: config.googleIosClientId || undefined });
}

type AuthState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Given name shared by Apple on first sign-in, used to prefill onboarding. */
  suggestedName: string;
  refreshProfile: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  /** Resolves false if the user closed the Google sheet. */
  signInWithGoogle: () => Promise<boolean>;
  /** Resolves true when the account must confirm its email (code or link) before signing in. */
  signInWithEmail: (email: string, password: string, create: boolean) => Promise<boolean>;
  /** Confirms a new email account with the 6-digit code from the sign-up email (signs in). */
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  /** Re-sends the sign-up confirmation email (code + link). */
  resendEmailCode: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [suggestedName, setSuggestedName] = useState('');

  const refreshProfile = useCallback(async () => {
    setProfile(await getMyProfile());
  }, []);

  // Load profile whenever the signed-in user changes.
  useEffect(() => {
    const load = async (s: Session | null) => {
      setSession(s);
      if (s) {
        analytics.identify(s.user.id);
        setProfile(await getMyProfile().catch(() => null));
      } else {
        setProfile(null);
      }
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Token refreshes don't change the user; avoid needless reloads.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') load(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithApple = useCallback(async () => {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!cred.identityToken) throw new Error('Apple did not return an identity token');
    if (cred.fullName?.givenName) setSuggestedName(cred.fullName.givenName);
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
    if (error) throw error;
    analytics.track('signed_in', { method: 'apple' });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return false; // cancelled
    if (!res.data.idToken) throw new Error('Google did not return an identity token');
    if (res.data.user.givenName) setSuggestedName(res.data.user.givenName);
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: res.data.idToken });
    if (error) throw error;
    analytics.track('signed_in', { method: 'google' });
    return true;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string, create: boolean) => {
    const { data, error } = create
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: config.confirmedUrl } })
      : await supabase.auth.signInWithPassword({ email, password });
    // Signing in before confirming: send them to the code step instead of an error.
    if (error && !create && /not confirmed/i.test(error.message)) return true;
    if (error) throw error;
    analytics.track(create ? 'signed_up' : 'signed_in', { method: 'email' });
    return !data.session;
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    if (error) throw error;
    analytics.track('email_confirmed', { method: 'code' });
  }, []);

  const resendEmailCode = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: config.confirmedUrl } });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    if (googleEnabled) await GoogleSignin.signOut().catch(() => undefined); // allow picking another account
    analytics.reset();
  }, []);

  const value = useMemo(
    () => ({ ready, session, profile, suggestedName, refreshProfile, signInWithApple, signInWithGoogle, signInWithEmail,
      verifyEmailCode, resendEmailCode, signOut }),
    [ready, session, profile, suggestedName, refreshProfile, signInWithApple, signInWithGoogle, signInWithEmail,
      verifyEmailCode, resendEmailCode, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
