/**
 * BookDate design tokens: warm "library" palette — paper, ink and a burgundy
 * accent, plus teal for friends mode and gilt for "readers near you" social
 * proof. Every text pair meets WCAG AA. The app ships in light mode only
 * (see app.json); dark tokens are planned (see BACKLOG.md).
 */
import { Platform } from 'react-native';

/** System serif: New York on iOS, Noto Serif on Android. */
export const serif = Platform.select({ ios: 'ui-serif', default: 'serif' });

/**
 * KeyboardAvoidingView mode. 'padding' on both platforms: under Android
 * edge-to-edge (forced on Android 15+) the window no longer resizes for the
 * keyboard, and where it still does the measured overlap is 0, so it's safe.
 */
export const keyboardBehavior = 'padding' as const;

export const colors = {
  paper: '#FAF5EC',       // screen background
  card: '#FFFDF9',        // cards, inputs, sheets
  sunken: '#F1E9DC',      // grouped-settings background, tag fills
  ink: '#1E1914',         // primary text
  inkMuted: '#5C5248',    // secondary text
  ink3: '#766B5F',        // tertiary text, inactive icons
  line: '#E6DCCB',        // hairlines (decorative)
  lineStrong: '#9A8C7A',  // control borders (3:1 against card)
  accent: '#8C1C3A',      // burgundy – actions, "like", dating mode
  accentSoft: '#F6E4E8',
  friends: '#1D6B63',     // teal – friends mode, mode-bearing elements only
  friendsSoft: '#DDEFEB',
  gilt: '#7A4F08',        // old gold – "readers near you"
  giltSoft: '#F7EBD3',
  pass: '#55606C',        // slate – "pass"
  success: '#2A7350',
  danger: '#B3261E',
  overlay: 'rgba(30,25,20,0.96)', // match moment backdrop
} as const;

/** Initials-avatar fills; white text passes 4.5:1 on all of them. */
export const avatarColors = ['#8C1C3A', '#1D6B63', '#3E4C7A', '#7A4F08', '#55606C', '#5B3F6E'] as const;

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const space = (n: number) => n * 4;
/** Minimum touch target (Apple HIG 44pt; Material asks 48dp, met via hitSlop). */
export const TOUCH = 44;

export const type = {
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: colors.ink, fontFamily: serif },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.ink, fontFamily: serif },
  body: { fontSize: 16, lineHeight: 22, color: colors.ink },
  small: { fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: colors.gilt },
} as const;
