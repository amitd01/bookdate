/** Typed access to the shared genre catalogue (also used by scripts/seed-books.mjs). */
import data from './genres.json';

export type Genre = { slug: string; label: string; emoji: string; subject: string };
export const GENRES: Genre[] = data;
export const genreLabel = (slug: string) => GENRES.find((g) => g.slug === slug)?.label ?? slug;

export const GENDERS = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'nonbinary', label: 'Non‑binary' },
] as const;
export type Gender = (typeof GENDERS)[number]['value'];

/** Product rule: discovery radius is fixed (mirrors public.match_radius_m()). */
export const RADIUS_KM = 15;
