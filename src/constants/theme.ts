/**
 * BookDate design tokens (visual refresh v2). Two axes:
 *   - scheme: light / dark, from the system (useColorScheme)
 *   - mode:   dating (rose → coral) / friends (teal → cyan), from the profile
 * `getTheme(scheme, mode)` flattens both into one object; screens read it
 * through `useTheme()` (src/lib/theme.tsx) and build styles with `useStyles`.
 * Accent text on an accent fill is always white; gradients run acc → acc2.
 */
import { Platform } from 'react-native';

export type Scheme = 'light' | 'dark';
export type Mode = 'dating' | 'friends';

const base = {
  light: {
    bg: '#F5F3F9',
    surface: '#FFFFFF',
    surface2: '#ECE9F2',
    ink: '#15111D',
    ink2: '#575064',
    ink3: '#6F6880',
    line: 'rgba(21,17,29,0.09)',
    lineStrong: 'rgba(21,17,29,0.22)', // control borders (inputs, outline buttons)
    glass: 'rgba(255,255,255,0.55)',
    glassStrong: 'rgba(255,255,255,0.76)',
    glassSolid: '#F9F8FC', // glassStrong flattened onto bg: Android / no-blur fallback
    glassLine: 'rgba(255,255,255,0.95)',
    highlight: 'rgba(255,255,255,0.9)', // 1px inner top highlight on glass
    shadow: 'rgba(46,22,70,0.16)',
    scrim: 'rgba(8,6,14,0.4)',
    gold: '#8F5A00',
    goldSoft: 'rgba(255,176,32,0.18)',
    pass: '#5D6675',
    danger: '#E5484D',
    blurTint: 'light' as const,
  },
  dark: {
    bg: '#0C0A11',
    surface: '#17141F',
    surface2: '#221E2C',
    ink: '#F6F3FB',
    ink2: '#BDB6CA',
    ink3: '#9790A6',
    line: 'rgba(255,255,255,0.09)',
    lineStrong: 'rgba(255,255,255,0.22)',
    glass: 'rgba(30,26,40,0.5)',
    glassStrong: 'rgba(34,30,46,0.72)',
    glassSolid: '#1F1B29',
    glassLine: 'rgba(255,255,255,0.16)',
    highlight: 'rgba(255,255,255,0.14)',
    shadow: 'rgba(0,0,0,0.55)',
    scrim: 'rgba(0,0,0,0.55)',
    gold: '#FFC24D',
    goldSoft: 'rgba(255,184,40,0.14)',
    pass: '#AEB6C4',
    danger: '#FF6369',
    blurTint: 'dark' as const,
  },
};

const accent = {
  dating: {
    light: { acc: '#E8175D', acc2: '#FF6B3D', accSoft: 'rgba(232,23,93,0.10)', accInk: '#C40F4E', amb1: 'rgba(255,64,120,0.18)', amb2: 'rgba(255,150,60,0.14)' },
    dark: { acc: '#E8175D', acc2: '#FF6B3D', accSoft: 'rgba(255,64,120,0.16)', accInk: '#FF7EA6', amb1: 'rgba(255,46,110,0.24)', amb2: 'rgba(120,60,255,0.20)' },
  },
  friends: {
    light: { acc: '#008F7A', acc2: '#12B5D9', accSoft: 'rgba(0,143,122,0.11)', accInk: '#00735F', amb1: 'rgba(0,190,160,0.18)', amb2: 'rgba(18,181,217,0.16)' },
    dark: { acc: '#008F7A', acc2: '#12B5D9', accSoft: 'rgba(30,210,180,0.15)', accInk: '#4BE3C6', amb1: 'rgba(0,200,170,0.22)', amb2: 'rgba(18,140,230,0.20)' },
  },
};

/** Scheme- and mode-independent colours. */
export const brand = {
  gold: '#FFC24D', // nearby pulse dot, match ring
  goldGlow: 'rgba(255,176,32,0.5)',
  ring: ['#E8175D', '#FF6B3D', '#FFC24D'] as const, // "new match" ring
  avatarGradients: [
    ['#FF5E8A', '#FF9F45'], ['#7B5CFF', '#3DB8FF'], ['#00B89C', '#2FD3F0'], ['#FF7A45', '#FFC24D'], ['#C04BFF', '#FF4F9A'],
  ] as const,
  /** Date / Friend tag fills: a match keeps the colour of the mode it was made in. */
  tag: { dating: '#E8175D', friends: '#008F7A' } as Record<Mode, string>,
  matchBg: '#0A0710', // match moment backdrop
};

export const getTheme = (scheme: Scheme, mode: Mode) => ({
  ...base[scheme], ...accent[mode][scheme], brand, scheme, mode,
  /** Accent gradient stops, always acc → acc2 at 135°. */
  grad: [accent[mode][scheme].acc, accent[mode][scheme].acc2] as const,
});
export type Theme = ReturnType<typeof getTheme>;

/** Gradient direction for every accent fill (135°). */
export const GRAD = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;

/** Bricolage Grotesque for UI, Instrument Serif for book titles and quotes (loaded in app/_layout.tsx). */
export const fonts = {
  ui: 'BricolageGrotesque_400Regular',
  uiMedium: 'BricolageGrotesque_500Medium',
  uiSemi: 'BricolageGrotesque_600SemiBold',
  uiBold: 'BricolageGrotesque_700Bold',
  uiHeavy: 'BricolageGrotesque_800ExtraBold',
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
};

/** Text styles without colour; screens add `color` from the theme. */
export const type = {
  largeTitle: { fontFamily: fonts.uiHeavy, fontSize: 34, lineHeight: 40, letterSpacing: -1.2 },
  wordmark: { fontFamily: fonts.uiHeavy, fontSize: 40, letterSpacing: -1.6 },
  hero: { fontFamily: fonts.uiBold, fontSize: 30, lineHeight: 33, letterSpacing: -0.9 },
  title: { fontFamily: fonts.uiHeavy, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  body: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 22 },
  bodySm: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 19 },
  label: { fontFamily: fonts.uiBold, fontSize: 14 },
  caption: { fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 17 },
  eyebrow: { fontFamily: fonts.uiHeavy, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' as const },
  bookXL: { fontFamily: fonts.serif, fontSize: 44, lineHeight: 48 },
  bookL: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 35 },
  bookM: { fontFamily: fonts.serif, fontSize: 25, lineHeight: 28 },
  bookS: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 23 },
  quote: { fontFamily: fonts.serifItalic, fontSize: 20, lineHeight: 25 },
};

export const radius = {
  xs: 7, sm: 9, md: 14, lg: 20, xl: 24, sheet: 36, pill: 999,
  card: Platform.OS === 'ios' ? 30 : 26,
};
/** 4pt grid: space(3) === 12. */
export const space = (n: number) => n * 4;
/** Minimum touch target (Apple HIG 44pt; Material asks 48dp, met via hitSlop). */
export const TOUCH = 44;
/** Blur intensities (expo-blur 1–100). */
export const blur = { chrome: 60, tabBar: 70, sheet: 80, cardPanel: 50, halo: 48 };
export const motion = { swipeOut: 280, springBack: 300, sheetUp: 320, matchFade: 350, matchPop: 700, swipeThreshold: 110 };


/**
 * KeyboardAvoidingView mode. 'padding' on both platforms: under Android
 * edge-to-edge (forced on Android 15+) the window no longer resizes for the
 * keyboard, and where it still does the measured overlap is 0, so it's safe.
 */
export const keyboardBehavior = 'padding' as const;
