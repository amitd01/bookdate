/**
 * BookDate design tokens: warm "library" palette — paper, ink and a
 * burgundy accent. The app ships in light mode only (see app.json).
 */
import { Platform } from 'react-native';

/** System serif: New York on iOS, Noto Serif on Android. */
export const serif = Platform.select({ ios: 'ui-serif', default: 'serif' });

/** KeyboardAvoidingView mode: iOS needs padding; Android (edge-to-edge) resizes natively. */
export const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined;

export const colors = {
  paper: '#FBF6EE',      // screen background
  card: '#FFFFFF',
  ink: '#1F1B16',        // primary text
  inkMuted: '#6E655A',   // secondary text
  line: '#E8DFD2',       // hairlines / borders
  accent: '#8C1C3A',     // burgundy – primary actions, "like"
  accentSoft: '#F4E3E7',
  pass: '#5B6B7A',       // slate – "pass"
  success: '#2F7D5B',
  danger: '#B3261E',
} as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;
export const space = (n: number) => n * 4;

export const type = {
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, fontFamily: serif },
  h2: { fontSize: 20, fontWeight: '700', color: colors.ink, fontFamily: serif },
  body: { fontSize: 16, color: colors.ink },
  small: { fontSize: 13, color: colors.inkMuted },
} as const;
