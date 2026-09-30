/**
 * Auth + profile state for the whole app.
 *   session === null            -> signed out   (sign-in screen)
 *   session && profile === null -> needs onboarding
 *   session && profile          -> main app
 * Sign-in methods: Sign in with Apple (primary) and email/password
 * (used for the App Review demo account).
 */
import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { analytics } from './analytics';
import { getMyProfile } from './api';
import { supabase } from './supabase';
import type { Profile } from './types';

type AuthState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Given name shared by Apple on first sign-in, used to prefill onboarding. */
  suggestedName: string;
  refreshProfile: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  /** Resolves true when a new account must confirm its email before signing in. */
  signInWithEmail: (email: string, password: string, create: boolean) => Promise<boolean>;
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

  const signInWithEmail = useCallback(async (email: string, password: string, create: boolean) => {
    const { data, error } = create
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    analytics.track(create ? 'signed_up' : 'signed_in', { method: 'email' });
    return !data.session;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    analytics.reset();
  }, []);

  const value = useMemo(
    () => ({ ready, session, profile, suggestedName, refreshProfile, signInWithApple, signInWithEmail, signOut }),
    [ready, session, profile, suggestedName, refreshProfile, signInWithApple, signInWithEmail, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
