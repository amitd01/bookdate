-- =============================================================================
-- Push notifications via Expo's push service, sent straight from Postgres
-- using pg_net (async HTTP; never blocks the originating transaction).
-- Tokens are saved by the app in profiles.push_token.
-- =============================================================================

create extension if not exists pg_net with schema extensions;

create or replace function public.send_push(p_user uuid, p_title text, p_body text, p_data jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare tok text;
begin
  select push_token into tok from profiles where id = p_user;
  if tok is null then return; end if;
  perform net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object('to', tok, 'title', p_title, 'body', p_body,
                                  'data', p_data, 'sound', 'default'));
end $$;
revoke execute on function public.send_push from public, anon, authenticated;

-- New match -> notify both readers.
create or replace function public.tg_matches_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  select title into t from books where id = new.book_id;
  perform send_push(new.user_a, 'It''s a book date! 📚', 'You both loved "' || t || '". Say hi!',
                    jsonb_build_object('matchId', new.id));
  perform send_push(new.user_b, 'It''s a book date! 📚', 'You both loved "' || t || '". Say hi!',
                    jsonb_build_object('matchId', new.id));
  return new;
end $$;
create trigger matches_push after insert on public.matches
  for each row execute function public.tg_matches_push();

-- New message -> notify the other participant.
create or replace function public.tg_messages_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare m matches; sender text;
begin
  select * into m from matches where id = new.match_id;
  select display_name into sender from profiles where id = new.sender_id;
  perform send_push(case when m.user_a = new.sender_id then m.user_b else m.user_a end,
                    sender, left(new.body, 120), jsonb_build_object('matchId', new.match_id));
  return new;
end $$;
create trigger messages_push after insert on public.messages
  for each row execute function public.tg_messages_push();
