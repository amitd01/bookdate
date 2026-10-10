/**
 * Open Library search, used when a book isn't in the BookDate catalogue yet.
 * Only works with a cover are returned (this is a cover-swiping app). Liking
 * one adds it to the catalogue via api.addBook.
 */
import { GENRES } from '@/constants/genres';

import type { SearchBook } from './types';

type Doc = { key: string; title: string; author_name?: string[]; cover_i?: number; first_publish_year?: number; subject?: string[] };

/** Maps Open Library subjects ("Horror tales", "Fantasy fiction"…) onto our genre slugs. */
function genresFor(subjects: string[] = []) {
  const text = subjects.join(' | ').toLowerCase().replace(/[\s-]+/g, '_');
  return GENRES.filter((g) => text.includes(g.subject) || text.includes(g.slug)).map((g) => g.slug).slice(0, 5);
}

export async function searchOpenLibrary(query: string, signal?: AbortSignal): Promise<(SearchBook & { cover_id: number })[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=15`
    + '&fields=key,title,author_name,cover_i,first_publish_year,subject';
  const res = await fetch(url, { signal, headers: { 'User-Agent': 'BookDate app (https://amitd01.github.io/bookdate/)' } });
  if (!res.ok) throw new Error(`Open Library search failed (${res.status})`);
  const { docs = [] } = (await res.json()) as { docs?: Doc[] };
  return docs
    .filter((d) => d.cover_i && /^\/works\/OL\d+W$/.test(d.key))
    .map((d) => ({
      id: null,
      ol_key: d.key,
      title: d.title,
      author: d.author_name?.[0] ?? null,
      cover_id: d.cover_i!,
      cover_url: `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`,
      genres: genresFor(d.subject),
      first_published: d.first_publish_year ?? null,
      nearby_likes: 0,
      liked: false,
    }));
}
