-- =============================================================================
-- Discover favours modern books. Anything first published before 1990 counts
-- as "old" and is shown much less often, unless the reader is browsing
-- Classics. 2010+ gets a small extra lift; books with no known year are neutral.
-- (The -2.5 / +0.5 / +1.0 weights sit against: +2 per shared genre, up to
-- +1.5 random, and 3·ln(1+n) for n nearby readers who liked the book, so an
-- old book a lot of nearby readers loved can still surface.)
-- =============================================================================

create or replace function public.get_feed(p_limit int default 20, p_genre text default null)
returns table (id bigint, title text, author text, cover_url text, genres text[],
               first_published int, nearby_likes int)
language sql stable security definer set search_path = public, extensions as $$
  with me as (select * from profiles where profiles.id = auth.uid()),
  nearby_likes as (
    select s.book_id, count(*)::int as n
    from swipes s join nearby_reader_ids() r(id) on r.id = s.user_id
    where s.liked group by s.book_id
  ),
  affinity as (
    select g, avg(case when s.liked then 1.0 else -0.5 end) as score
    from swipes s join books b on b.id = s.book_id, unnest(b.genres) g
    where s.user_id = auth.uid() group by g
  )
  select b.id, b.title, b.author, b.cover_url, b.genres, b.first_published,
         coalesce(nl.n, 0) as nearby_likes
  from books b
  cross join me
  left join nearby_likes nl on nl.book_id = b.id
  where not exists (select 1 from swipes s where s.user_id = auth.uid() and s.book_id = b.id)
    and (p_genre is null or p_genre = any (b.genres))
    and b.source = 'catalogue'                       -- reader-added books stay out of Discover
  order by
      2.0 * cardinality(array(select unnest(b.genres) intersect select unnest(me.genres)))
    + coalesce((select sum(a.score) from affinity a where a.g = any (b.genres)), 0)
    + 3.0 * ln(1 + coalesce(nl.n, 0))
    + 0.3 * ln(1 + b.like_count)
    + case                                            -- recency: modern books first
        when p_genre = 'classics'      then 0              -- browsing classics: age doesn't matter
        when b.first_published >= 2010 then 1.0
        when b.first_published >= 1990 then 0.5
        when b.first_published <  1990 then -2.5          -- "old": still shown, much less often
        else 0                                             -- unknown year: neutral
      end
    + random() * 1.5 desc
  limit least(greatest(p_limit, 1), 50)
$$;
