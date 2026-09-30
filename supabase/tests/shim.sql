-- Minimal stand-in for Supabase's platform objects so migrations can be
-- tested on plain Postgres + PostGIS (used by supabase/tests/run.sh and CI).
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, extensions, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- pg_net stub: records requests instead of sending them.
create schema net;
create table net.sent (url text, body jsonb);
create function net.http_post(url text, headers jsonb, body jsonb) returns bigint
  language sql as $$ insert into net.sent values (url, body); select 1::bigint $$;
