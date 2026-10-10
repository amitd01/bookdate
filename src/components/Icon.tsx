/**
 * App icons: SF Symbols on iOS, Material Symbols on Android (expo-symbols).
 * Screens use semantic names, so swapping a glyph happens in one place.
 * Icons are decorative; the control around them carries the label.
 */
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { colors } from '@/constants/theme';

const GLYPHS = {
  heart: { ios: 'heart.fill', android: 'favorite' },
  heartOutline: { ios: 'heart', android: 'favorite' },
  pass: { ios: 'xmark', android: 'close' },
  close: { ios: 'xmark.circle.fill', android: 'cancel' },
  search: { ios: 'magnifyingglass', android: 'search' },
  browse: { ios: 'line.3.horizontal.decrease', android: 'filter_list' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  shield: { ios: 'checkmark.shield', android: 'verified_user' },
  send: { ios: 'arrow.up', android: 'arrow_upward' },
  people: { ios: 'person.2.fill', android: 'group' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on' },
  location: { ios: 'location.fill', android: 'my_location' },
  bell: { ios: 'bell.fill', android: 'notifications' },
  books: { ios: 'books.vertical.fill', android: 'menu_book' },
  chats: { ios: 'bubble.left.and.bubble.right.fill', android: 'forum' },
  profile: { ios: 'person.crop.circle.fill', android: 'account_circle' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  check: { ios: 'checkmark', android: 'check' },
  lamp: { ios: 'lamp.desk', android: 'menu_book' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome' },
} satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof GLYPHS;

export function Icon({ name, size = 20, color = colors.ink }: { name: IconName; size?: number; color?: ColorValue }) {
  return <SymbolView name={GLYPHS[name]} size={size} tintColor={color} accessible={false} />;
}
