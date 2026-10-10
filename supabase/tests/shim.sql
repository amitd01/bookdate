-- Minimal stand-in for Supabase's platform objects so migrations can be
-- tested on plain Postgres + PostGIS (used by supabase/tests/run.sh and CI).
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), instance_id uuid, aud text, role text,
  email text, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, extensions, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- pg_net stub: records requests instead of sending them.
create schema net;
create table net.sent (url text, body jsonb);
create function net.http_post(url text, headers jsonb, body jsonb) returns bigint
  language sql as $$ insert into net.sent values (url, body); select 1::bigint $$;
-- Supabase grants new public functions to API roles by default; mirror it so
-- tests catch functions that must be revoked explicitly.
alter default privileges in schema public grant execute on functions to anon, authenticated;
-- pgsql-http stub: canned Open Library responses for add_book.
create type extensions.http_response as (status int, content_type text, headers jsonb, content text);
create function extensions.http_set_curlopt(opt text, val text) returns boolean language sql as $$ select true $$;
create function extensions.http_get(uri text) returns extensions.http_response language sql as $$
  select case uri
    when 'https://openlibrary.org/works/OL1W.json' then
      row(200, 'application/json', null, '{"title": "Tomb of Sand", "covers": [123], "first_publish_date": "2018", "authors": [{"author": {"key": "/authors/OL1A"}}]}')::extensions.http_response
    when 'https://openlibrary.org/authors/OL1A.json' then
      row(200, 'application/json', null, '{"name": "Geetanjali Shree"}')::extensions.http_response
    else row(404, 'application/json', null, '{}')::extensions.http_response
  end $$;
