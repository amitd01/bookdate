/**
 * "Looking for" modes. Dating and friends readers never match each other;
 * friends mode ignores gender. Each match keeps the mode it was made in, so
 * copy and colour follow the match, not the reader's current mode.
 */
import { colors } from './theme';

export type LookingFor = 'dating' | 'friends';

export const MODES = {
  dating: {
    label: 'Dating',
    blurb: 'Book dates. Meet readers you might fall for.',
    tag: 'Date',
    noun: 'Book date',
    headline: (n: number) => (n > 1 ? `It's ${n} book dates!` : "It's a book date!"),
    finish: 'Find my book date',
    color: colors.accent,
    soft: colors.accentSoft,
    fill: '#B8385C', // button fill on the dark match overlay
  },
  friends: {
    label: 'Just meeting people',
    blurb: 'Book buddies. Match with anyone in friends mode, any gender.',
    tag: 'Friend',
    noun: 'Book buddy',
    headline: (n: number) => (n > 1 ? `You've found ${n} book buddies!` : "You've found a book buddy!"),
    finish: 'Find my book buddy',
    color: colors.friends,
    soft: colors.friendsSoft,
    fill: '#237A70',
  },
} as const;

export const modeOf = (m: string | null | undefined): LookingFor => (m === 'friends' ? 'friends' : 'dating');
