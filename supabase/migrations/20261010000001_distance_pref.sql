-- =============================================================================
-- Per-reader match distance.
-- Readers pick how far to look: 1–15 km, or 1–10 miles (10 mi ≈ 16.1 km).
-- Matching is mutual, so two readers connect only within the SMALLER of their
-- two distances. The hard cap rises from 15 km to 16.1 km to fit 10 miles.
-- =============================================================================

-- Hard cap (metres): 10 miles, rounded up. Also the index-assisted prefilter in get_feed.
create or replace function public.match_radius_m() returns int
language sql immutable as $$ select 16100 $$;

alter table public.profiles
  add column max_km        numeric(3,1) not null default 15 check (max_km between 1 and 16.1),
  add column distance_unit text not null default 'km' check (distance_unit in ('km', 'mi'));

-- Same rules as before, but the distance is the closer of the two readers' choices.
create or replace function public.is_compatible(a public.profiles, b public.profiles) returns boolean
language sql stable set search_path = public, extensions as $$
  select a.id <> b.id
     and a.location is not null and b.location is not null
     and st_dwithin(a.location, b.location, least(a.max_km, b.max_km) * 1000)
     and a.gender = any (b.interested_in) and b.gender = any (a.interested_in)
     and age_of(b.birthdate) between a.age_min and a.age_max
     and age_of(a.birthdate) between b.age_min and b.age_max
     and not exists (select 1 from blocks
                      where (blocker_id = a.id and blocked_id = b.id)
                         or (blocker_id = b.id and blocked_id = a.id))
$$;
