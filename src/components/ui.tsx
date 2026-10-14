/**
 * Shared UI primitives on the refresh-v2 tokens: glass surfaces, gradient
 * fills, ambient glow, buttons, chips, tags, fields, grouped rows, avatars,
 * a segmented control and gradient rings. All read the theme via useTheme().
 */
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

import { Icon, type IconName } from '@/components/Icon';
import { brand, fonts, GRAD, radius, space, TOUCH, type, type Theme } from '@/constants/theme';
import { useStyles, useTheme } from '@/lib/theme';

// ------------------------------------------------------------- surfaces ---

type GlassProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** More opaque fill: sheets, headers, composer, hero cards. */
  strong?: boolean;
  intensity?: number;
  /** Override fill/border, e.g. dark glass on the match overlay. */
  fill?: string;
  border?: string;
  tint?: 'light' | 'dark';
};

/**
 * Frosted surface: blur + translucent fill + 1px border + 1px top highlight.
 * Android draws a solid fill instead of blurring (cheaper; the design holds).
 */
export function Glass({ children, style, strong, intensity = 60, fill, border, tint }: GlassProps) {
  const t = useTheme();
  const ios = Platform.OS === 'ios';
  const bg = fill ?? (ios ? (strong ? t.glassStrong : t.glass) : t.glassSolid);
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: ios ? undefined : bg, borderWidth: 1, borderColor: border ?? t.glassLine }, style]}>
      {ios && <BlurView intensity={intensity} tint={tint ?? t.blurTint} style={StyleSheet.absoluteFill} />}
      {ios && <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} pointerEvents="none" />}
      {!fill && <View style={[g.highlight, { backgroundColor: t.highlight }]} pointerEvents="none" />}
      {children}
    </View>
  );
}

/** Accent gradient fill (acc → acc2, 135°) behind its children. */
export function Gradient({ children, style, colors }: { children?: ReactNode; style?: StyleProp<ViewStyle>; colors?: readonly [string, string, ...string[]] }) {
  const t = useTheme();
  return <LinearGradient colors={colors ?? t.grad} start={GRAD.start} end={GRAD.end} style={style}>{children}</LinearGradient>;
}

/**
 * Ambient glow behind a screen: two soft radial blobs (amb1 top-left, amb2
 * top-right) over `bg`. Render first inside a screen; it never takes touches.
 */
export function Ambient() {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="a1" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={t.amb1} stopOpacity={1} />
            <Stop offset="1" stopColor={t.amb1} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="a2" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={t.amb2} stopOpacity={1} />
            <Stop offset="1" stopColor={t.amb2} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={0} cy={0} rx={width * 1.1} ry={height * 0.55} fill="url(#a1)" />
        <Ellipse cx={width} cy={height * 0.12} rx={width * 0.9} ry={height * 0.5} fill="url(#a2)" />
      </Svg>
    </View>
  );
}

/**
 * Gradient outline ring (rounded rect or circle) drawn around its children,
 * e.g. new-match covers and the profile avatar. `gap` leaves a bg-coloured gutter.
 */
export function Ring({ children, width, height, r, stroke = 3, gap = 2, colors = brand.ring, gapColor }: {
  children: ReactNode; width: number; height: number; r: number; stroke?: number; gap?: number; colors?: readonly string[]; gapColor?: string;
}) {
  const t = useTheme();
  const pad = stroke + gap;
  const W = width + pad * 2;
  const H = height + pad * 2;
  return (
    <View style={{ width: W, height: H, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            {colors.map((c, i) => <Stop key={i} offset={i / (colors.length - 1)} stopColor={c} />)}
          </SvgGradient>
        </Defs>
        <Rect x={stroke / 2} y={stroke / 2} width={W - stroke} height={H - stroke} rx={r + pad - stroke / 2}
          fill={gapColor ?? t.bg} stroke="url(#ring)" strokeWidth={stroke} />
      </Svg>
      {children}
    </View>
  );
}

// -------------------------------------------------------------- buttons ---

type ButtonProps = {
  title: string;
  onPress: () => void;
  /** primary = gradient pill · secondary = outline · danger = red outline · ghost = accent text. */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  /** Override the ghost text colour (e.g. white on the match overlay). */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, color, style }: ButtonProps) {
  const t = useTheme();
  const s = useStyles(make);
  const textColor = { primary: '#FFFFFF', secondary: t.ink, danger: t.danger, ghost: color ?? t.accInk }[variant];
  const content = loading ? <ActivityIndicator color={textColor} /> : <Text style={[s.buttonText, { color: textColor }]}>{title}</Text>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.button,
        variant === 'primary' && s.primary,
        variant === 'secondary' && s.secondary,
        variant === 'danger' && [s.secondary, { borderColor: t.danger }],
        variant === 'ghost' && { minHeight: 48 },
        (disabled || pressed) && { opacity: disabled ? 0.45 : 0.75 },
        style,
      ]}>
      {variant === 'primary' && <Gradient style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />}
      {content}
    </Pressable>
  );
}

/** Round glass icon-only button (44pt), e.g. search, back, safety. */
export function IconButton({ icon, label, onPress, color, size = TOUCH }: { icon: IconName; label: string; onPress: () => void; color?: string; size?: number }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={Math.max(0, (TOUCH - size) / 2)}
      style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Glass strong style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={color ?? t.ink} />
      </Glass>
    </Pressable>
  );
}

// ------------------------------------------------------- chips and tags ---

/** Selectable pill; selected = accent gradient with white text. `color` overrides the gradient (e.g. danger). */
export function Chip({ label, selected, onPress, radio, color }: {
  label: string; selected: boolean; onPress: () => void; radio?: boolean; color?: string;
}) {
  const s = useStyles(make);
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      hitSlop={4}
      style={[s.chip, selected && { borderColor: 'transparent' }]}>
      {selected && <Gradient colors={color ? [color, color] : undefined} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />}
      <Text style={[s.chipText, selected && { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>{children}</View>;
}

/** Small label pill, e.g. the Date / Friend tag on a match (white on the mode colour by default). */
export function Tag({ label, color = '#FFFFFF', background, size = 11 }: { label: string; color?: string; background: string; size?: number }) {
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: background }}>
      <Text style={{ fontFamily: fonts.uiBold, fontSize: size, color }}>{label}</Text>
    </View>
  );
}

// --------------------------------------------------------------- inputs ---

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  const s = useStyles(make);
  return (
    <View style={{ gap: space(1.5) }}>
      <Eyebrow>{label}</Eyebrow>
      <TextInput placeholderTextColor={t.ink3} style={[s.input, style]} accessibilityLabel={label} {...props} />
    </View>
  );
}

/** Small uppercase section label. */
export function Eyebrow({ children, color, style }: { children: ReactNode; color?: string; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={style}>
      <Text style={[type.eyebrow, { color: color ?? t.ink3 }]} accessibilityRole="header">{children}</Text>
    </View>
  );
}
/** Kept for existing call sites (form labels). */
export const Label = Eyebrow;

/** Large in-screen page title ("Book Dates", "Profile"). */
export function LargeTitle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[type.largeTitle, { color: t.ink, paddingHorizontal: space(5) }]} accessibilityRole="header">{children}</Text>;
}

/** Two- or more-option pill switch; the selected segment is the accent gradient. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const s = useStyles(make);
  return (
    <View style={s.segTrack} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} style={[s.seg, on && s.segOn]} onPress={() => onChange(o.value)}
            accessibilityRole="radio" accessibilityState={{ checked: on }}>
            {on && <Gradient style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />}
            <Text style={[s.segText, on && { color: '#FFFFFF' }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- states ---

/** Centred icon + title + body + actions (empty deck, permissions, errors). */
export function EmptyState({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: ReactNode }) {
  const t = useTheme();
  const s = useStyles(make);
  return (
    <View style={s.empty}>
      <View style={s.emptyHalo}>
        <View style={s.emptyIcon}><Icon name={icon} size={36} color={t.accInk} /></View>
      </View>
      <Text style={[type.bookL, { color: t.ink, textAlign: 'center' }]} accessibilityRole="header">{title}</Text>
      <Text style={[type.body, { fontSize: 15, textAlign: 'center', color: t.ink2 }]}>{body}</Text>
      <View style={s.emptyActions}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------- grouped list ---

/** Settings-style row inside a Group. */
export function Row({ label, value, onPress, danger }: { label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  const t = useTheme();
  const s = useStyles(make);
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: t.accSoft }]}>
      <Text style={[type.body, { color: danger ? t.danger : t.ink }]}>{label}</Text>
      <View style={s.rowRight}>
        {value ? <Text style={[type.body, { color: t.ink2, flexShrink: 1 }]} numberOfLines={1}>{value}</Text> : null}
        {onPress && !danger ? <Icon name="chevronRight" size={14} color={t.ink3} /> : null}
      </View>
    </Pressable>
  );
}

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  const s = useStyles(make);
  return (
    <View style={{ gap: space(2) }}>
      {title ? <Eyebrow style={{ paddingHorizontal: space(1) }}>{title}</Eyebrow> : null}
      <View style={s.group}>{children}</View>
    </View>
  );
}

// --------------------------------------------------------------- avatar ---

/** Initials avatar on a gradient picked from the name — BookDate is cover-first, no photos. */
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 0);
  const pair = brand.avatarGradients[hash % brand.avatarGradients.length];
  return (
    <Gradient colors={pair} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontFamily: fonts.uiHeavy, fontSize: size * 0.4 }}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </Gradient>
  );
}

// --------------------------------------------------------------- styles ---

const g = StyleSheet.create({
  highlight: { position: 'absolute', top: 0, left: 16, right: 16, height: 1 },
});

const make = (t: Theme) => StyleSheet.create({
  button: { minHeight: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(6) },
  primary: { shadowColor: t.acc, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  secondary: { minHeight: 50, borderWidth: 1.5, borderColor: t.lineStrong, backgroundColor: t.surface },
  buttonText: { fontFamily: fonts.uiBold, fontSize: 17 },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: space(4), borderRadius: radius.pill, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.surface },
  chipText: { fontFamily: fonts.uiSemi, fontSize: 14, color: t.ink },
  input: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.lineStrong, borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(3.5), fontFamily: fonts.ui, fontSize: 17, color: t.ink },
  segTrack: { flexDirection: 'row', backgroundColor: t.surface2, borderRadius: radius.pill, padding: 4 },
  seg: { flex: 1, minHeight: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(2) },
  segOn: { shadowColor: t.acc, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  segText: { fontFamily: fonts.uiBold, fontSize: 15, color: t.ink2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(8), gap: space(3) },
  emptyHalo: { padding: 10, borderRadius: 52, backgroundColor: t.accSoft, marginBottom: space(2), shadowColor: t.acc, shadowOpacity: 0.3, shadowRadius: 30 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: t.accSoft, alignItems: 'center', justifyContent: 'center' },
  emptyActions: { alignSelf: 'stretch', gap: space(2.5), marginTop: space(3) },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(3), paddingHorizontal: space(4), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexShrink: 1 },
  group: { backgroundColor: t.surface, borderRadius: 22, borderWidth: 1, borderColor: t.line, overflow: 'hidden' },
});
