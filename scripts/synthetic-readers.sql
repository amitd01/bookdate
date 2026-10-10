-- =============================================================================
-- BookDate: seed 10,062 SYNTHETIC test readers in Mumbai and Bengaluru.
--
--   3 genders × every age 18–60 × 78 readers each = 10,062 readers.
--   Each has 3–5 random genres, mostly-dating / some friends mode, a 5–15 km
--   distance, an age range around their own age, and 20–60 book likes
--   (about 75% from their own genres, favouring each genre's best-known books).
--   Homes are random spots (±1.5 km) around 28 neighbourhoods, half per city.
--
-- Synthetic readers are invisible to real users (see migration
-- 20261010000003_synthetic_readers.sql). Only accounts in public.testers can
-- see and match them. They can't sign in (no password) and never reply.
--
-- Run after `npx supabase db push` (1.1 migrations) and after books are seeded:
--   • Supabase dashboard → SQL Editor → paste this file → Run, or
--   • psql "<connection string from Dashboard → Connect>" -f scripts/synthetic-readers.sql
-- Remove them all with scripts/synthetic-readers-remove.sql.
--
-- Make yourself (and other testers) able to see them:
--   insert into public.testers (user_id, note)
--   select id, 'tester' from auth.users where email in ('you@example.com');
-- =============================================================================

begin;

do $$ begin
  if exists (select 1 from public.profiles where is_synthetic) then
    raise exception 'Synthetic readers already exist. Run scripts/synthetic-readers-remove.sql first.';
  end if;
  if (select count(*) from public.books) < 100 then
    raise exception 'Seed the book catalogue first (npm run seed:books).';
  end if;
end $$;

-- Likes are seeded without the match trigger: no matches or pushes between
-- synthetic readers, and no change to books' (real) popularity.
alter table public.swipes disable trigger swipes_match;

create temp table synth_areas (idx serial, city text, area text, lat float8, lng float8) on commit drop;
insert into synth_areas (city, area, lat, lng) values
  ('Mumbai', 'Bandra West', 19.0596, 72.8295), ('Mumbai', 'Andheri West', 19.1364, 72.8296),
  ('Mumbai', 'Powai', 19.1176, 72.9060),       ('Mumbai', 'Colaba', 18.9067, 72.8147),
  ('Mumbai', 'Lower Parel', 18.9953, 72.8302), ('Mumbai', 'Dadar', 19.0178, 72.8478),
  ('Mumbai', 'Juhu', 19.1075, 72.8263),        ('Mumbai', 'Malad', 19.1860, 72.8485),
  ('Mumbai', 'Goregaon', 19.1663, 72.8526),    ('Mumbai', 'Chembur', 19.0522, 72.9005),
  ('Mumbai', 'Thane', 19.2183, 72.9781),       ('Mumbai', 'Vashi', 19.0771, 72.9986),
  ('Mumbai', 'Worli', 19.0176, 72.8162),       ('Mumbai', 'Borivali', 19.2307, 72.8567),
  ('Bengaluru', 'Indiranagar', 12.9784, 77.6408), ('Bengaluru', 'Koramangala', 12.9352, 77.6245),
  ('Bengaluru', 'HSR Layout', 12.9116, 77.6474),  ('Bengaluru', 'Jayanagar', 12.9308, 77.5838),
  ('Bengaluru', 'Whitefield', 12.9698, 77.7500),  ('Bengaluru', 'Malleshwaram', 13.0031, 77.5643),
  ('Bengaluru', 'JP Nagar', 12.9063, 77.5857),    ('Bengaluru', 'BTM Layout', 12.9166, 77.6101),
  ('Bengaluru', 'Marathahalli', 12.9591, 77.6974), ('Bengaluru', 'Hebbal', 13.0358, 77.5970),
  ('Bengaluru', 'Electronic City', 12.8452, 77.6602), ('Bengaluru', 'Basavanagudi', 12.9421, 77.5737),
  ('Bengaluru', 'Yelahanka', 13.1007, 77.5963),   ('Bengaluru', 'MG Road', 12.9756, 77.6066);

-- One row per synthetic reader with every random choice made up front.
-- (Subqueries reference s.k so Postgres re-runs them per row instead of once.)
create temp table synth on commit drop as
with grid as (
  select g.gender, a.age, row_number() over () as k
  from unnest(array['woman', 'man', 'nonbinary']) g(gender),
       generate_series(18, 60) a(age),
       generate_series(1, 78) n
), draws as (
  select grid.*, random() as r_pref, random() as r_mode, 1 + floor(random() * 28)::int as area_idx,
         20 + floor(random() * 41)::int as n_likes, 3 + floor(random() * 3)::int as n_genres
  from grid
)
select gen_random_uuid() as id, s.k, s.gender, s.age, s.n_likes, a.city, a.area,
  -- Names: common Indian first names; gender-neutral ones for non-binary readers.
  case s.gender
    when 'woman' then (array['Aanya','Diya','Ishita','Kavya','Meera','Nisha','Priya','Riya','Saanvi','Tara','Zoya','Ananya','Neha','Pooja','Sneha','Aditi','Ira','Myra','Rhea','Tanvi'])[1 + floor(random() * 20)::int]
    when 'man'   then (array['Aarav','Arjun','Dev','Kabir','Rohan','Vihaan','Ishaan','Aditya','Rahul','Karan','Nikhil','Siddharth','Varun','Yash','Aman','Kunal','Neil','Omkar','Pranav','Reyansh'])[1 + floor(random() * 20)::int]
    else              (array['Ariv','Kiran','Noor','Sasha','Shan','Jyoti','Avi','Rumi','Inder','Sam','Alex','Ray','Nikki','Mani','Shiv','Jas','Ronnie','Kim','Sunny','Tej'])[1 + floor(random() * 20)::int]
  end as display_name,
  case s.gender
    when 'woman' then case when s.r_pref < .75 then '{man}' when s.r_pref < .85 then '{woman}' when s.r_pref < .95 then '{man,woman}' else '{woman,man,nonbinary}' end
    when 'man'   then case when s.r_pref < .75 then '{woman}' when s.r_pref < .85 then '{man}' when s.r_pref < .95 then '{man,woman}' else '{woman,man,nonbinary}' end
    else              case when s.r_pref < .40 then '{woman,man,nonbinary}' when s.r_pref < .60 then '{woman,nonbinary}' when s.r_pref < .80 then '{man,nonbinary}' else '{nonbinary}' end
  end::text[] as interested_in,
  case when s.r_mode < .2 then 'friends' else 'dating' end as looking_for,
  (select array_agg(slug) from (
     select slug from unnest(array['fantasy','science_fiction','romance','mystery','thriller','horror','historical_fiction',
       'classics','literary_fiction','young_adult','graphic_novels','poetry','biography','history','science','philosophy',
       'self_help','business','humor','travel']) slug
     where s.k is not null order by random() limit s.n_genres) x) as genres,
  a.lat + (random() - 0.5) * 0.028 as lat,
  a.lng + (random() - 0.5) * 0.028 as lng
from draws s join synth_areas a on a.idx = s.area_idx;

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       'synthetic+' || k || '@bookdate.invalid',
       '{"provider": "synthetic", "providers": ["synthetic"]}', '{"synthetic": true}', now(), now()
from synth;

insert into public.profiles (id, display_name, birthdate, gender, interested_in, looking_for, age_min, age_max,
                             max_km, distance_unit, genres, bio, location, location_updated_at, is_synthetic, created_at)
select id, display_name,
       (current_date - make_interval(years => age))::date - floor(random() * 360)::int,
       gender, interested_in, looking_for,
       greatest(18, age - 2 - floor(random() * 6)::int), least(99, age + 3 + floor(random() * 10)::int),
       5 + floor(random() * 11)::int, 'km', genres,
       'Test reader in ' || area || '. Big on ' || replace(genres[1], '_', ' ') || ' and ' || replace(genres[2], '_', ' ') || '.',
       extensions.st_setsrid(extensions.st_makepoint(round(lng::numeric, 3)::float8, round(lat::numeric, 3)::float8), 4326)::extensions.geography,
       now() - random() * interval '25 days', true, now() - random() * interval '60 days'
from synth;

-- Popularity proxy: books are seeded in Open Library's popularity order per
-- genre, so earlier books in a genre get up to 4× the chance of a like.
create temp table synth_weights on commit drop as
select id, genres, 1 + 3 * exp(-(row_number() over (partition by genres[1] order by id)) / 40.0) as w
from public.books;

-- 20–60 likes each: ~75% weighted picks from their genres, the rest anywhere.
insert into public.swipes (user_id, book_id, liked, created_at)
select s.id, pick.id, true, now() - random() * interval '30 days'
from synth s
cross join lateral (
  (select b.id from synth_weights b
   where b.genres && (select genres from public.profiles p where p.id = s.id)
   order by random() ^ (1.0 / b.w) desc
   limit round(s.n_likes * 0.75))
  union
  (select b.id from synth_weights b where s.k is not null
   order by random() limit s.n_likes - round(s.n_likes * 0.75))
) pick
on conflict (user_id, book_id) do nothing;

alter table public.swipes enable trigger swipes_match;
analyze public.profiles;
analyze public.swipes;

-- Summary
select city, count(*) as readers,
       count(*) filter (where looking_for = 'friends') as friends_mode
from synth group by city order by city;
select count(*) as synthetic_likes from public.swipes
where user_id in (select id from public.profiles where is_synthetic);

commit;
