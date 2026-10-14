/**
 * "Looking for" modes. Dating and friends readers never match each other;
 * friends mode ignores gender. Each match keeps the mode it was made in, so
 * copy and colour follow the match, not the reader's current mode.
 * Colours live in theme.ts (accent per mode, brand.tag for Date / Friend tags).
 */

export type LookingFor = 'dating' | 'friends';

export const MODES = {
  dating: {
    label: 'Dating',
    blurb: 'Book dates. Meet readers you might fall for.',
    tag: 'Date',
    noun: 'Book date',
    headline: (n: number) => (n > 1 ? `It's ${n} book dates!` : "It's a book date!"),
    finish: 'Find my book date',
  },
  friends: {
    label: 'Just meeting people',
    blurb: 'Book buddies. Match with anyone in friends mode, any gender.',
    tag: 'Friend',
    noun: 'Book buddy',
    headline: (n: number) => (n > 1 ? `You've found ${n} book buddies!` : "You've found a book buddy!"),
    finish: 'Find my book buddy',
  },
} as const;

export const modeOf = (m: string | null | undefined): LookingFor => (m === 'friends' ? 'friends' : 'dating');
