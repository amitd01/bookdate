-- =============================================================================
-- Release 1.1
--   * Friends mode: profiles.looking_for ('dating' | 'friends'). Readers only
--     match within the same mode; friends mode ignores gender. Each match
--     remembers the mode it was made in (matches.mode), so switching modes
--     keeps existing matches, tagged.
--   * Genre browsing: get_feed(p_limit, p_genre).
--   * Book search: search_books() over the catalogue, add_book() to pull a
--     book in from Open Library so it can be liked. The database fetches the
--     work from Open Library itself, so readers can't inject titles or covers;
--     reader-added books are searchable but never pushed into Discover.
--   * Unmatch is permanent (blocks silently) but keeps your like on the book.
--   * Birthday is locked after onboarding.
--   * nearby_readers(): honest, bucketed count of compatible readers nearby.
--   * update_location() is throttled (one move per 2 minutes) so spoofed
--     locations can't be used to triangulate other readers.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists http with schema extensions;  -- synchronous HTTP for add_book

-- ------------------------------------------------------------- columns ------

alter table public.profiles
  add column looking_for text not null default 'dating' check (looking_for in ('dating', 'friends'));

alter table public.matches
  add column mode text not null default 'dating' check (mode in ('dating', 'friends'));

-- Where a book came from: the seeded catalogue, or a reader's search.
alter table public.books
  add column source   text not null default 'catalogue' check (source in ('catalogue', 'user')),
  add column added_by uuid references public.profiles (id) on delete set null;

-- Fast "contains" search on title + author (trigram index, scales past the seed catalogue).
create index books_search_idx on public.books
  using gin ((title || ' ' || coalesce(author, '')) extensions.gin_trgm_ops);

-- ------------------------------------------------------- compatibility ------

-- Same as before plus: same mode, and gender preferences only apply to dating.
create or replace function public.is_compatible(a public.profiles, b public.profiles) returns boolean
language sql stable set search_path = public, extensions as $$
  select a.id <> b.id
     and a.location is not null and b.location is not null
     and st_dwithin(a.location, b.location, least(a.max_km, b.max_km) * 1000)
     and a.looking_for = b.looking_for
     and (a.looking_for = 'friends'
          or (a.gender = any (b.interested_in) and b.gender = any (a.interested_in)))
     and age_of(b.birthdate) between a.age_min and a.age_max
     and age_of(a.birthdate) between b.age_min and b.age_max
     and not exists (select 1 from blocks
                      where (blocker_id = a.id and blocked_id = b.id)
                         or (blocker_id = b.id and blocked_id = a.id))
$$;

-- Compatible readers in range of the caller (shared by feed, search and the nearby chip).
create or replace function public.nearby_reader_ids() returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select o.id from profiles o, profiles me
  where me.id = auth.uid()
    and st_dwithin(o.location, me.location, match_radius_m())   -- index-assisted prefilter
    and is_compatible(me, o)
$$;

-- ------------------------------------------------------------ triggers ------

-- Matches record the mode they were made in.
create or replace function public.tg_swipes_match() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not new.liked then return new; end if;

  update books set like_count = like_count + 1 where id = new.book_id;

  insert into matches (user_a, user_b, book_id, mode)
  select least(me.id, o.id), greatest(me.id, o.id), new.book_id, me.looking_for
  from profiles me
  join swipes s   on s.book_id = new.book_id and s.liked and s.user_id <> me.id
  join profiles o on o.id = s.user_id
  where me.id = new.user_id
    and is_compatible(me, o)
  on conflict (user_a, user_b) do nothing;

  return new;
end $$;

-- Profanity masking (as before) + birthday lock: once set, only support can
-- change it (dashboard/service-role edits have no auth.uid()).
create or replace function public.tg_profiles_clean() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.birthdate is distinct from old.birthdate and auth.uid() is not null then
    raise exception 'Your birthday can''t be changed in the app. Contact support to correct it.';
  end if;
  new.display_name := mask_profanity(new.display_name);
  new.bio          := mask_profanity(new.bio);
  new.updated_at   := now();
  return new;
end $$;

-- Match push copy follows the mode.
create or replace function public.tg_matches_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text; headline text;
begin
  select title into t from books where id = new.book_id;
  headline := case new.mode when 'friends' then 'You found a book buddy! 📚' else 'It''s a book date! 📚' end;
  perform send_push(new.user_a, headline, 'You both loved "' || t || '". Say hi!', jsonb_build_object('matchId', new.id));
  perform send_push(new.user_b, headline, 'You both loved "' || t || '". Say hi!', jsonb_build_object('matchId', new.id));
  return new;
end $$;

-- ---------------------------------------------------------------- RPCs ------

-- Feed, now with an optional genre filter ("Browsing: Horror").
drop function public.get_feed(int);
create function public.get_feed(p_limit int default 20, p_genre text default null)
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
    + random() * 1.5 desc
  limit least(greatest(p_limit, 1), 50)
$$;

-- Catalogue search by title or author. `liked` says whether the caller already
-- liked it; passed books are included so readers can change their mind.
create or replace function public.search_books(p_query text, p_limit int default 20)
returns table (id bigint, ol_key text, title text, author text, cover_url text, genres text[],
               first_published int, nearby_likes int, liked boolean)
language sql stable security definer set search_path = public, extensions as $$
  with q as (select trim(p_query) as t),
  hits as (
    select b.* from books b, q
    where char_length(q.t) >= 2
      and (b.title || ' ' || coalesce(b.author, '')) ilike '%' || replace(replace(q.t, '%', ''), '_', '') || '%'
  ),
  nearby_likes as (
    select s.book_id, count(*)::int as n
    from swipes s join nearby_reader_ids() r(id) on r.id = s.user_id
    where s.liked and s.book_id in (select hits.id from hits) group by s.book_id
  )
  select h.id, h.ol_key, h.title, h.author, h.cover_url, h.genres, h.first_published,
         coalesce(nl.n, 0), coalesce(my.liked, false)
  from hits h
  cross join q
  left join nearby_likes nl on nl.book_id = h.id
  left join swipes my on my.book_id = h.id and my.user_id = auth.uid()
  order by (h.title ilike q.t || '%') desc, coalesce(nl.n, 0) desc, h.like_count desc, h.title
  limit least(greatest(p_limit, 1), 50)
$$;

-- Adds an Open Library work to the catalogue (found via in-app search) and
-- returns its id. Only the work key comes from the app: title, author, cover
-- and year are fetched from Open Library here, so nothing can be injected.
-- Limited to 30 new books per reader per day.
create or replace function public.add_book(p_ol_key text, p_genres text[] default '{}')
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id bigint;
  res  extensions.http_response;
  work jsonb;
  v_author text;
  v_cover bigint;
begin
  if p_ol_key !~ '^/works/OL[0-9]+W$' then raise exception 'Invalid book'; end if;
  select id into v_id from books where ol_key = p_ol_key;
  if v_id is not null then return v_id; end if;
  if (select count(*) from books where added_by = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'You''ve added a lot of books today. Try again tomorrow.';
  end if;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '5000');
  res := extensions.http_get('https://openlibrary.org' || p_ol_key || '.json');
  if res.status <> 200 then raise exception 'Book not found on Open Library'; end if;
  work := res.content::jsonb;
  v_cover := nullif(work->'covers'->>0, '')::bigint;
  if work->>'title' is null or v_cover is null or v_cover <= 0 then raise exception 'That book has no cover yet'; end if;

  if work->'authors'->0->'author'->>'key' ~ '^/authors/OL[0-9]+A$' then
    res := extensions.http_get('https://openlibrary.org' || (work->'authors'->0->'author'->>'key') || '.json');
    if res.status = 200 then v_author := res.content::jsonb->>'name'; end if;
  end if;

  insert into books (ol_key, title, author, cover_url, genres, first_published, source, added_by)
  values (p_ol_key, left(mask_profanity(work->>'title'), 300), left(mask_profanity(v_author), 200),
          'https://covers.openlibrary.org/b/id/' || v_cover || '-L.jpg',
          coalesce((select array_agg(g) from unnest(p_genres[1:5]) g where g ~ '^[a-z_]{2,40}$'), '{}'),
          substring(work->>'first_publish_date' from '\d{4}')::int, 'user', auth.uid())
  on conflict (ol_key) do nothing
  returning id into v_id;
  return coalesce(v_id, (select id from books where ol_key = p_ol_key));
end $$;

-- Records a swipe (or a like from search). Re-liking a passed book flips it to
-- a like and runs matching. Returns every match it created, with the
-- partner's public card for the match screen.
drop function public.swipe(bigint, boolean);
create function public.swipe(p_book_id bigint, p_liked boolean)
returns table (match_id uuid, mode text, other_id uuid, other_name text, other_age int,
               other_gender text, other_bio text, other_genres text[])
language plpgsql security definer set search_path = public as $$
begin
  if p_liked and exists (select 1 from swipes where user_id = auth.uid() and book_id = p_book_id and not liked) then
    -- The match trigger runs on insert, so a changed mind is re-inserted.
    delete from swipes where user_id = auth.uid() and book_id = p_book_id;
  end if;
  insert into swipes (user_id, book_id, liked) values (auth.uid(), p_book_id, p_liked)
  on conflict (user_id, book_id) do nothing;

  return query
    select m.id, m.mode, p.id, p.display_name, age_of(p.birthdate), p.gender, p.bio, p.genres
    from matches m
    join profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
    where m.book_id = p_book_id and auth.uid() in (m.user_a, m.user_b)
      and m.created_at = now();   -- now() is the txn timestamp => only matches made by this swipe
end $$;

-- Match list, now with the match's mode.
drop function public.get_matches();
create function public.get_matches()
returns table (match_id uuid, created_at timestamptz, mode text, other_id uuid, other_name text, other_age int,
               other_gender text, other_bio text, other_genres text[],
               book_id bigint, book_title text, book_author text, book_cover text,
               last_message text, last_message_at timestamptz, last_sender uuid)
language sql stable security definer set search_path = public as $$
  select m.id, m.created_at, m.mode, p.id, p.display_name, age_of(p.birthdate), p.gender, p.bio, p.genres,
         b.id, b.title, b.author, b.cover_url, lm.body, lm.created_at, lm.sender_id
  from matches m
  join profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  join books b on b.id = m.book_id
  left join lateral (select body, created_at, sender_id from messages
                     where match_id = m.id order by created_at desc limit 1) lm on true
  where auth.uid() in (m.user_a, m.user_b)
  order by coalesce(lm.created_at, m.created_at) desc
$$;

-- Unmatch: removes the person for good (a silent block, so you never match
-- again on another book) but keeps your like, so the book can still match
-- you with other readers.
create or replace function public.unmatch(p_match_id uuid) returns void
language sql security definer set search_path = public as $$
  select block_user(case when user_a = auth.uid() then user_b else user_a end)
  from matches where id = p_match_id and auth.uid() in (user_a, user_b);
$$;

-- Report + unmatch in one transaction, so a retry can't file a duplicate report.
create or replace function public.report_and_unmatch(p_match_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare other uuid;
begin
  select case when user_a = auth.uid() then user_b else user_a end into other
  from matches where id = p_match_id and auth.uid() in (user_a, user_b);
  if other is null then raise exception 'Match not found'; end if;
  insert into reports (reporter_id, reported_id, reason, details)
  values (auth.uid(), other, p_reason, nullif(trim(p_details), ''));
  perform unmatch(p_match_id);
end $$;

-- Location updates are throttled to one move per 2 minutes, so a spoofed
-- location can't be swept around to triangulate other readers.
create or replace function public.update_location(lat double precision, lng double precision) returns void
language sql security definer set search_path = public, extensions as $$
  update profiles
     set location = st_setsrid(st_makepoint(round(lng::numeric, 3)::float8, round(lat::numeric, 3)::float8), 4326)::geography,
         location_updated_at = now()
   where id = auth.uid()
     and (location is null or location_updated_at < now() - interval '2 minutes')
$$;

-- Honest density for the Discover chip. Only buckets leave the database, so
-- small exact numbers never reveal individual readers. Counts compatible
-- readers in range who opened the app in the last 30 days.
create or replace function public.nearby_readers() returns text
language sql stable security definer set search_path = public, extensions as $$
  select case when n = 0 then 'none' when n < 10 then 'few' when n < 50 then '10+' else '50+' end
  from (select count(*) as n from profiles p join nearby_reader_ids() r(id) on r.id = p.id
        where p.location_updated_at > now() - interval '30 days') c
$$;

-- RPCs are for signed-in users only. nearby_reader_ids stays internal (Supabase
-- grants new functions to authenticated by default, so revoke explicitly): the
-- SECURITY DEFINER RPCs above call it as their owner.
revoke execute on function public.nearby_reader_ids from public, anon, authenticated;
revoke execute on function public.get_feed, public.search_books, public.add_book, public.swipe, public.get_matches,
  public.unmatch, public.report_and_unmatch, public.nearby_readers from public, anon;
grant execute on function public.get_feed, public.search_books, public.add_book, public.swipe, public.get_matches,
  public.unmatch, public.report_and_unmatch, public.nearby_readers to authenticated;
