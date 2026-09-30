/** Small shared UI primitives (buttons, chips, fields, headers) on the theme tokens. */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { colors, radius, space, type } from '@/constants/theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.button, v.box, (disabled || pressed) && { opacity: 0.6 }, style]}>
      {loading ? <ActivityIndicator color={v.text.color} /> : <Text style={[s.buttonText, v.text]}>{title}</Text>}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { box: { backgroundColor: colors.accent }, text: { color: '#fff' } },
  secondary: { box: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }, text: { color: colors.ink } },
  danger: { box: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.danger }, text: { color: colors.danger } },
  ghost: { box: { backgroundColor: 'transparent' }, text: { color: colors.accent } },
};

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[s.chip, selected && s.chipOn]}>
      <Text style={[s.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={s.chipGroup}>{children}</View>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: space(1.5) }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.inkMuted} style={s.input} {...props} />
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

/** Numeric stepper, e.g. for the preferred age range. */
export function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <View style={s.stepper}>
      <Pressable accessibilityLabel="decrease" onPress={() => onChange(Math.max(min, value - 1))} style={s.stepBtn}>
        <Text style={s.stepGlyph}>−</Text>
      </Pressable>
      <Text style={[type.h2, { minWidth: 36, textAlign: 'center' }]}>{value}</Text>
      <Pressable accessibilityLabel="increase" onPress={() => onChange(Math.min(max, value + 1))} style={s.stepBtn}>
        <Text style={s.stepGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({ emoji, title, body, children }: { emoji: string; title: string; body: string; children?: ReactNode }) {
  return (
    <View style={s.empty}>
      <Text style={{ fontSize: 56 }}>{emoji}</Text>
      <Text style={[type.h2, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.small, { textAlign: 'center', fontSize: 15 }]}>{body}</Text>
      {children}
    </View>
  );
}

/** Initials avatar — BookDate is cover-first, so there are no profile photos. */
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue}, 45%, 42%)`, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  button: { height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(6) },
  buttonText: { fontSize: 17, fontWeight: '700' },
  chip: { paddingVertical: space(2), paddingHorizontal: space(3.5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 15, color: colors.ink, fontWeight: '500' },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  label: { fontSize: 13, fontWeight: '700', color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space(3.5), fontSize: 17, color: colors.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  stepBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 22, color: colors.ink },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(8), gap: space(3) },
});
