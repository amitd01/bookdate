-- =============================================================================
-- Synthetic test readers (seeded by scripts/synthetic-readers.sql).
--   * profiles.is_synthetic marks generated readers. Only SQL/dashboard can set
--     it; app requests can't change it.
--   * public.testers is an allowlist of real accounts that may see and match
--     synthetic readers. Everyone else never meets them: not in matches,
--     "readers near you" counts, the nearby chip, or analytics.
--   * At city density one like could match dozens of readers at once, so a
--     like now matches at most 5: the closest compatible readers first.
-- =============================================================================

alter table public.profiles add column is_synthetic boolean not null default false;
create index profiles_synthetic_idx on public.profiles (id) where is_synthetic;

create table public.testers (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.testers enable row level security; -- no policies: dashboard / SQL only

-- Real readers and synthetic readers only meet when one side is a tester.
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
     and (a.is_synthetic = b.is_synthetic
          or exists (select 1 from testers t where t.user_id in (a.id, b.id)))
     and not exists (select 1 from blocks
                      where (blocker_id = a.id and blocked_id = b.id)
                         or (blocker_id = b.id and blocked_id = a.id))
$$;

-- App requests (auth.uid() set) can't flag or unflag themselves as synthetic.
create or replace function public.tg_profiles_clean() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then
    new.is_synthetic := case when tg_op = 'UPDATE' then old.is_synthetic else false end;
    if tg_op = 'UPDATE' and new.birthdate is distinct from old.birthdate then
      raise exception 'Your birthday can''t be changed in the app. Contact support to correct it.';
    end if;
  end if;
  new.display_name := mask_profanity(new.display_name);
  new.bio          := mask_profanity(new.bio);
  new.updated_at   := now();
  return new;
end $$;

-- A like matches at most 5 readers (closest first). Likes by synthetic readers
-- don't count towards a book's global popularity.
create or replace function public.tg_swipes_match() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare me profiles;
begin
  if not new.liked then return new; end if;
  select * into me from profiles where id = new.user_id;

  if not me.is_synthetic then
    update books set like_count = like_count + 1 where id = new.book_id;
  end if;

  insert into matches (user_a, user_b, book_id, mode)
  select least(me.id, o.id), greatest(me.id, o.id), new.book_id, me.looking_for
  from swipes s
  join profiles o on o.id = s.user_id
  where s.book_id = new.book_id and s.liked and s.user_id <> me.id
    and not exists (select 1 from matches m where m.user_a = least(me.id, o.id) and m.user_b = greatest(me.id, o.id))
    and is_compatible(me, o)
  order by st_distance(me.location, o.location)
  limit 5
  on conflict (user_a, user_b) do nothing;

  return new;
end $$;

-- Team KPIs count real readers only.
create or replace view public.analytics_daily with (security_invoker = true) as
with days as (select generate_series(current_date - 29, current_date, '1 day')::date as day),
real_ids as (select id from profiles where not is_synthetic)
select d.day,
  (select count(*) from profiles where created_at::date = d.day and not is_synthetic) as new_readers,
  (select count(*) from swipes   where created_at::date = d.day and user_id in (select id from real_ids)) as swipes,
  (select count(*) from swipes   where created_at::date = d.day and liked and user_id in (select id from real_ids)) as right_swipes,
  (select count(*) from matches  where created_at::date = d.day and user_a in (select id from real_ids) and user_b in (select id from real_ids)) as matches,
  (select count(*) from messages where created_at::date = d.day and sender_id in (select id from real_ids)) as messages
from days d order by d.day desc;
revoke all on public.analytics_daily from anon, authenticated;
