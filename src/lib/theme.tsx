/**
 * Theme context: combines the system colour scheme with the reader's mode
 * (dating / friends) into one flat token object (see constants/theme.ts).
 *   - `useTheme()` returns the tokens.
 *   - `useStyles(make)` builds a StyleSheet from them, rebuilt only when the theme changes.
 *   - `previewMode(m)` re-themes the app instantly (e.g. the Profile "Looking for"
 *     switch, or the onboarding mode step) before the profile has been saved.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { getTheme, type Mode, type Theme } from '@/constants/theme';

type Ctx = { theme: Theme; previewMode: (m: Mode | null) => void };
const ThemeContext = createContext<Ctx>({ theme: getTheme('light', 'dating'), previewMode: () => undefined });

export function ThemeProvider({ mode, children }: { mode: Mode; children: ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  // A preview applies until the saved mode catches up with it (or it's cleared).
  const [preview, setPreview] = useState<{ mode: Mode; over: Mode } | null>(null);
  const active = preview && preview.over === mode ? preview.mode : mode;
  const value = useMemo<Ctx>(() => ({
    theme: getTheme(scheme, active),
    previewMode: (m) => setPreview(m ? { mode: m, over: mode } : null),
  }), [scheme, active, mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext).theme;
export const usePreviewMode = () => useContext(ThemeContext).previewMode;

/**
 * Theme-aware styles, rebuilt only when the theme changes:
 *   const make = (t: Theme) => StyleSheet.create({ ... });
 *   const s = useStyles(make);
 */
export function useStyles<T>(make: (t: Theme) => T): T {
  const t = useTheme();
  return useMemo(() => make(t), [t, make]);
}
