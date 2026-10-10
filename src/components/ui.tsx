/** Small shared UI primitives (buttons, chips, fields, tags, rows) on the theme tokens. */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { avatarColors, colors, radius, space, TOUCH, type } from '@/constants/theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Fill for primary buttons (teal in friends mode). */
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', color = colors.accent, disabled, loading, style }: ButtonProps) {
  const v = buttonVariants(color)[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.button, v.box, (disabled || pressed) && { opacity: 0.6 }, style]}>
      {loading ? <ActivityIndicator color={v.text.color} /> : <Text style={[s.buttonText, v.text]}>{title}</Text>}
    </Pressable>
  );
}

const buttonVariants = (color: string) => ({
  primary: { box: { backgroundColor: color }, text: { color: '#fff' } },
  secondary: { box: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.lineStrong }, text: { color: colors.ink } },
  danger: { box: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.danger }, text: { color: colors.danger } },
  ghost: { box: { backgroundColor: 'transparent' }, text: { color } },
});

/** Round icon-only button (44pt), e.g. search in the Discover header. */
export function IconButton({ icon, label, onPress, color = colors.ink }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={({ pressed }) => [s.iconButton, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={20} color={color} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, color = colors.accent, radio }: {
  label: string; selected: boolean; onPress: () => void; color?: string; radio?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[s.chip, selected && { backgroundColor: color, borderColor: color }]}>
      <Text style={[s.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={s.chipGroup}>{children}</View>;
}

/** Small label pill, e.g. the Date / Friend tag on a match. */
export function Tag({ label, color, background, icon }: { label: string; color: string; background: string; icon?: IconName }) {
  return (
    <View style={[s.tag, { backgroundColor: background }]}>
      {icon && <Icon name={icon} size={12} color={color} />}
      <Text style={[s.tagText, { color }]}>{label}</Text>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: space(1.5) }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.ink3} style={s.input} accessibilityLabel={label} {...props} />
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label} accessibilityRole="header">{children}</Text>;
}

export function EmptyState({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: ReactNode }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Icon name={icon} size={36} color={colors.ink3} /></View>
      <Text style={[type.h2, { textAlign: 'center' }]} accessibilityRole="header">{title}</Text>
      <Text style={[type.body, { textAlign: 'center', color: colors.inkMuted }]}>{body}</Text>
      <View style={s.emptyActions}>{children}</View>
    </View>
  );
}

/** Settings-style row inside a grouped card. */
export function Row({ label, value, onPress, danger }: { label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.sunken }]}>
      <Text style={[type.body, danger && { color: colors.danger }]}>{label}</Text>
      <View style={s.rowRight}>
        {value ? <Text style={[type.body, { color: colors.inkMuted }]} numberOfLines={1}>{value}</Text> : null}
        {onPress && !danger ? <Icon name="chevronRight" size={14} color={colors.ink3} /> : null}
      </View>
    </Pressable>
  );
}

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space(2) }}>
      {title ? <Text style={[s.label, { paddingHorizontal: space(1) }]} accessibilityRole="header">{title}</Text> : null}
      <View style={s.group}>{children}</View>
    </View>
  );
}

/** Initials avatar — BookDate is cover-first, so there are no profile photos. */
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const fill = avatarColors[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 0) % avatarColors.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: fill, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  button: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(6) },
  buttonText: { fontSize: 17, fontWeight: '700' },
  iconButton: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.lineStrong },
  chip: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: space(4), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.card },
  chipText: { fontSize: 15, color: colors.ink, fontWeight: '500' },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: 2 },
  tagText: { fontSize: 12, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700', color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, padding: space(3.5), fontSize: 17, color: colors.ink },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(8), gap: space(3) },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center', marginBottom: space(1) },
  emptyActions: { alignSelf: 'stretch', gap: space(2), marginTop: space(2) },
  row: { minHeight: TOUCH + 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(3), paddingHorizontal: space(4), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexShrink: 1 },
  group: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
});
