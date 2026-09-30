-- =============================================================================
-- BookDate core schema
--   profiles  -> one row per reader (created during onboarding)
--   books     -> catalogue seeded from Open Library (scripts/seed-books.mjs)
--   swipes    -> left/right decisions; a right swipe can create a match
--   matches   -> two compatible readers within 15 km who liked the same book
--   messages  -> the per-match "book club" chat (streamed via Realtime)
--   blocks / reports / banned_words -> safety & moderation (App Store 1.2)
-- All client access goes through RLS or SECURITY DEFINER RPCs that filter on
-- auth.uid(); other users' raw rows (and locations) are never exposed.
-- =============================================================================

create extension if not exists postgis with schema extensions;

-- Fixed discovery radius (metres). Product rule: always < 15 km.
create or replace function public.match_radius_m() returns int
language sql immutable as $$ select 15000 $$;

-- ---------------------------------------------------------------- tables ----

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 40),
  birthdate     date not null check (birthdate <= current_date - interval '18 years'),
  gender        text not null check (gender in ('woman', 'man', 'nonbinary')),
  interested_in text[] not null check (cardinality(interested_in) > 0
                  and interested_in <@ array['woman', 'man', 'nonbinary']),
  age_min       int  not null default 18 check (age_min >= 18),
  age_max       int  not null default 99 check (age_max <= 99 and age_max >= age_min),
  genres        text[] not null check (cardinality(genres) >= 3),
  bio           text check (char_length(bio) <= 300),
  location      extensions.geography(point, 4326),
  location_updated_at timestamptz,
  push_token    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index profiles_location_idx on public.profiles using gist (location);

create table public.books (
  id              bigint generated always as identity primary key,
  ol_key          text unique not null,          -- Open Library work key, e.g. /works/OL45804W
  title           text not null,
  author          text,
  cover_url       text not null,
  genres          text[] not null default '{}',
  first_published int,
  like_count      int not null default 0,        -- global popularity signal
  created_at      timestamptz not null default now()
);
create index books_genres_idx on public.books using gin (genres);

create table public.swipes (
  user_id    uuid   not null references public.profiles (id) on delete cascade,
  book_id    bigint not null references public.books (id) on delete cascade,
  liked      boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
create index swipes_book_liked_idx on public.swipes (book_id) where liked;

create table public.matches (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid   not null references public.profiles (id) on delete cascade,
  user_b     uuid   not null references public.profiles (id) on delete cascade,
  book_id    bigint not null references public.books (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),                       -- canonical ordering => one match per pair
  unique (user_a, user_b)
);
create index matches_user_b_idx on public.matches (user_b);

create table public.messages (
  id         bigint generated always as identity primary key,
  match_id   uuid not null references public.matches (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_match_idx on public.messages (match_id, created_at desc);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (reason in ('spam', 'harassment', 'inappropriate', 'fake', 'underage', 'other')),
  details     text check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at  timestamptz not null default now()
);

-- Words masked in user-generated text. Extend via the Supabase dashboard.
create table public.banned_words (word text primary key);
insert into public.banned_words (word) values
  ('fuck'), ('shit'), ('bitch'), ('cunt'), ('asshole'), ('dick'), ('pussy'), ('whore'), ('slut'), ('bastard');

-- --------------------------------------------------------------- helpers ----

create or replace function public.age_of(d date) returns int
language sql stable as $$ select extract(year from age(current_date, d))::int $$;

-- Replace banned words (whole-word, case-insensitive) with asterisks.
-- SECURITY DEFINER so it can read banned_words (no client policy) from triggers.
create or replace function public.mask_profanity(t text) returns text
language plpgsql stable security definer set search_path = public as $$
declare w text;
begin
  if t is null then return null; end if;
  for w in select word from banned_words loop
    t := regexp_replace(t, '\m' || w || '\w*', repeat('*', char_length(w)), 'gi');
  end loop;
  return t;
end $$;

-- Two readers are compatible when: both located, within the radius, each fits
-- the other's gender + age preferences, and neither has blocked the other.
create or replace function public.is_compatible(a public.profiles, b public.profiles) returns boolean
language sql stable set search_path = public, extensions as $$
  select a.id <> b.id
     and a.location is not null and b.location is not null
     and st_dwithin(a.location, b.location, match_radius_m())
     and a.gender = any (b.interested_in) and b.gender = any (a.interested_in)
     and age_of(b.birthdate) between a.age_min and a.age_max
     and age_of(a.birthdate) between b.age_min and b.age_max
     and not exists (select 1 from blocks
                      where (blocker_id = a.id and blocked_id = b.id)
                         or (blocker_id = b.id and blocked_id = a.id))
$$;

-- -------------------------------------------------------------- triggers ----

create or replace function public.tg_profiles_clean() returns trigger
language plpgsql set search_path = public as $$
begin
  new.display_name := mask_profanity(new.display_name);
  new.bio          := mask_profanity(new.bio);
  new.updated_at   := now();
  return new;
end $$;
create trigger profiles_clean before insert or update on public.profiles
  for each row execute function public.tg_profiles_clean();

create or replace function public.tg_messages_clean() returns trigger
language plpgsql set search_path = public as $$
begin
  new.body := mask_profanity(new.body);
  return new;
end $$;
create trigger messages_clean before insert on public.messages
  for each row execute function public.tg_messages_clean();

-- The heart of the app: on a right swipe, bump popularity and create a match
-- with every compatible nearby reader who already liked the same book.
create or replace function public.tg_swipes_match() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not new.liked then return new; end if;

  update books set like_count = like_count + 1 where id = new.book_id;

  insert into matches (user_a, user_b, book_id)
  select least(me.id, o.id), greatest(me.id, o.id), new.book_id
  from profiles me
  join swipes s   on s.book_id = new.book_id and s.liked and s.user_id <> me.id
  join profiles o on o.id = s.user_id
  where me.id = new.user_id
    and is_compatible(me, o)
  on conflict (user_a, user_b) do nothing;

  return new;
end $$;
create trigger swipes_match after insert on public.swipes
  for each row execute function public.tg_swipes_match();

-- ------------------------------------------------------------------ RLS -----

alter table public.profiles     enable row level security;
alter table public.books        enable row level security;
alter table public.swipes       enable row level security;
alter table public.matches      enable row level security;
alter table public.messages     enable row level security;
alter table public.blocks       enable row level security;
alter table public.reports      enable row level security;
alter table public.banned_words enable row level security;

create policy "own profile: read"   on public.profiles for select using (id = auth.uid());
create policy "own profile: insert" on public.profiles for insert with check (id = auth.uid());
create policy "own profile: update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "books: read" on public.books for select to authenticated using (true);

create policy "own swipes: read"   on public.swipes for select using (user_id = auth.uid());
create policy "own swipes: insert" on public.swipes for insert with check (user_id = auth.uid());

create policy "my matches: read"   on public.matches for select using (auth.uid() in (user_a, user_b));
create policy "my matches: delete" on public.matches for delete using (auth.uid() in (user_a, user_b));

create policy "match messages: read" on public.messages for select using (
  exists (select 1 from public.matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b)));
create policy "match messages: send" on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b)));

create policy "own blocks: read"   on public.blocks  for select using (blocker_id = auth.uid());
create policy "own blocks: insert" on public.blocks  for insert with check (blocker_id = auth.uid());
create policy "own reports: insert" on public.reports for insert with check (reporter_id = auth.uid());

-- ----------------------------------------------------------------- RPCs -----

-- Store the caller's location, rounded to ~100 m so exact positions are never kept.
create or replace function public.update_location(lat double precision, lng double precision) returns void
language sql security definer set search_path = public, extensions as $$
  update profiles
     set location = st_setsrid(st_makepoint(round(lng::numeric, 3)::float8, round(lat::numeric, 3)::float8), 4326)::geography,
         location_updated_at = now()
   where id = auth.uid()
$$;

-- Personalised deck of unseen books. Score blends:
--   * overlap with the reader's chosen genres
--   * learned genre affinity from past swipes (likes +1, passes -0.5)
--   * "nearby_likes": compatible readers within 15 km who liked it
--     (a right swipe on these can match instantly)
--   * global popularity, plus a little randomness for exploration.
create or replace function public.get_feed(p_limit int default 20)
returns table (id bigint, title text, author text, cover_url text, genres text[],
               first_published int, nearby_likes int)
language sql stable security definer set search_path = public, extensions as $$
  with me as (select * from profiles where profiles.id = auth.uid()),
  nearby as (
    select o.id from profiles o, me
    where st_dwithin(o.location, me.location, match_radius_m())   -- index-assisted prefilter
      and is_compatible(me, o)
  ),
  nearby_likes as (
    select s.book_id, count(*)::int as n
    from swipes s join nearby on nearby.id = s.user_id
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
  order by
      2.0 * cardinality(array(select unnest(b.genres) intersect select unnest(me.genres)))
    + coalesce((select sum(a.score) from affinity a where a.g = any (b.genres)), 0)
    + 3.0 * ln(1 + coalesce(nl.n, 0))
    + 0.3 * ln(1 + b.like_count)
    + random() * 1.5 desc
  limit least(greatest(p_limit, 1), 50)
$$;

-- Records a swipe; returns the match (if this swipe created or joined one).
create or replace function public.swipe(p_book_id bigint, p_liked boolean)
returns table (match_id uuid, other_name text)
language plpgsql security definer set search_path = public as $$
begin
  insert into swipes (user_id, book_id, liked) values (auth.uid(), p_book_id, p_liked)
  on conflict (user_id, book_id) do nothing;

  return query
    select m.id, p.display_name
    from matches m
    join profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
    where m.book_id = p_book_id and auth.uid() in (m.user_a, m.user_b)
      and m.created_at = now();   -- now() is the txn timestamp => only matches made by this swipe
end $$;

-- Match list with the partner's public card and the latest message.
create or replace function public.get_matches()
returns table (match_id uuid, created_at timestamptz, other_id uuid, other_name text, other_age int,
               other_gender text, other_bio text, other_genres text[],
               book_id bigint, book_title text, book_author text, book_cover text,
               last_message text, last_message_at timestamptz, last_sender uuid)
language sql stable security definer set search_path = public as $$
  select m.id, m.created_at, p.id, p.display_name, age_of(p.birthdate), p.gender, p.bio, p.genres,
         b.id, b.title, b.author, b.cover_url, lm.body, lm.created_at, lm.sender_id
  from matches m
  join profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  join books b on b.id = m.book_id
  left join lateral (select body, created_at, sender_id from messages
                     where match_id = m.id order by created_at desc limit 1) lm on true
  where auth.uid() in (m.user_a, m.user_b)
  order by coalesce(lm.created_at, m.created_at) desc
$$;

-- Block a reader: hides them everywhere and removes any match (and its chat).
create or replace function public.block_user(p_user_id uuid) returns void
language sql security definer set search_path = public as $$
  insert into blocks (blocker_id, blocked_id) values (auth.uid(), p_user_id) on conflict do nothing;
  delete from matches where user_a = least(auth.uid(), p_user_id) and user_b = greatest(auth.uid(), p_user_id);
$$;

-- In-app account deletion (App Store 5.1.1(v)). Cascades to all user data.
create or replace function public.delete_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid()
$$;

-- RPCs are for signed-in users only.
revoke execute on function public.update_location, public.get_feed, public.swipe, public.get_matches,
  public.block_user, public.delete_account from public, anon;
grant execute on function public.update_location, public.get_feed, public.swipe, public.get_matches,
  public.block_user, public.delete_account to authenticated;

-- ------------------------------------------------------------- realtime -----
-- Stream new messages & matches to clients (RLS still applies).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.matches;
  end if;
end $$;

-- ------------------------------------------------------------ analytics -----
-- Daily product KPIs for the team (service_role / dashboard only).
create or replace view public.analytics_daily with (security_invoker = true) as
with days as (select generate_series(current_date - 29, current_date, '1 day')::date as day)
select d.day,
  (select count(*) from profiles where created_at::date = d.day) as new_readers,
  (select count(*) from swipes   where created_at::date = d.day) as swipes,
  (select count(*) from swipes   where created_at::date = d.day and liked) as right_swipes,
  (select count(*) from matches  where created_at::date = d.day) as matches,
  (select count(*) from messages where created_at::date = d.day) as messages
from days d order by d.day desc;

create or replace view public.analytics_top_books with (security_invoker = true) as
select b.id, b.title, b.author, b.like_count,
       (select count(*) from matches m where m.book_id = b.id) as matches_sparked
from books b order by b.like_count desc limit 100;

revoke all on public.analytics_daily, public.analytics_top_books from anon, authenticated;
