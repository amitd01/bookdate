/** Row / RPC shapes mirrored from supabase/migrations. */
import type { DistanceUnit } from '@/constants/distance';
import type { Gender } from '@/constants/genres';
import type { LookingFor } from '@/constants/modes';

export type Profile = {
  id: string;
  display_name: string;
  birthdate: string; // YYYY-MM-DD
  gender: Gender;
  interested_in: Gender[]; // dating only; friends mode matches any gender
  looking_for: LookingFor;
  age_min: number;
  age_max: number;
  max_km: number; // match distance, 1–16.1 km (mutual: the smaller of two readers' choices applies)
  distance_unit: DistanceUnit; // display only
  genres: string[];
  bio: string | null;
};

/** Editable profile fields (everything but the id). */
export type ProfileInput = Omit<Profile, 'id'>;

export type FeedBook = {
  id: number;
  title: string;
  author: string | null;
  cover_url: string;
  genres: string[];
  first_published: number | null;
  nearby_likes: number; // compatible readers in range who liked it
};

/** A search hit: from the catalogue (id set) or Open Library (id null until added). */
export type SearchBook = Omit<FeedBook, 'id'> & { id: number | null; ol_key: string; liked: boolean; cover_id?: number };

/** A match created by a like, with the partner's public card (match moment). */
export type NewMatch = {
  match_id: string;
  mode: LookingFor;
  other_id: string;
  other_name: string;
  other_age: number;
  other_gender: Gender;
  other_bio: string | null;
  other_genres: string[];
};

/** Honest, bucketed count of compatible readers nearby (never an exact small number). */
export type NearbyBucket = 'none' | 'few' | '10+' | '50+';

export type Match = {
  match_id: string;
  created_at: string;
  mode: LookingFor;
  other_id: string;
  other_name: string;
  other_age: number;
  other_gender: Gender;
  other_bio: string | null;
  other_genres: string[];
  book_id: number;
  book_title: string;
  book_author: string | null;
  book_cover: string;
  last_message: string | null;
  last_message_at: string | null;
  last_sender: string | null;
};

export type Message = {
  id: number;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'fake' | 'underage' | 'other';
