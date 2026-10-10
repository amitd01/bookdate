-- End-to-end behaviour checks for the BookDate schema. Each block raises on failure.
-- Cast: Asha (woman→men) & Ben (man→women) ~2 km apart in Bengaluru;
--       Cal (man→women) ~37 km away; Dev (man→men) nearby but incompatible.
grant select, insert, update, delete on all tables in schema public to authenticated;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d');
insert into profiles (id, display_name, birthdate, gender, interested_in, genres, bio, push_token) values
  ('00000000-0000-0000-0000-00000000000a', 'Asha', '1995-01-01', 'woman', '{man}', '{fantasy,romance,classics}', 'I love shit books', 'ExponentPushToken[a]'),
  ('00000000-0000-0000-0000-00000000000b', 'Ben',  '1993-01-01', 'man',   '{woman}', '{fantasy,thriller,classics}', null, 'ExponentPushToken[b]'),
  ('00000000-0000-0000-0000-00000000000c', 'Cal',  '1990-01-01', 'man',   '{woman}', '{fantasy,thriller,classics}', null, null),
  ('00000000-0000-0000-0000-00000000000d', 'Dev',  '1992-01-01', 'man',   '{man}',   '{fantasy,thriller,classics}', null, null);
insert into books (ol_key, title, author, cover_url, genres) values
  ('/w/1', 'The Hobbit', 'Tolkien', 'x', '{fantasy,classics}'),
  ('/w/2', 'Gone Girl',  'Flynn',   'x', '{thriller}'),
  ('/w/3', 'Emma',       'Austen',  'x', '{romance,classics}');

create function pg_temp.as_user(c text) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || c, false) $$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as
  $$ begin if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok  %', what; end $$;
-- True when the statement raises an error.
create function pg_temp.raises(stmt text) returns boolean language plpgsql as
  $$ begin execute stmt; return false; exception when others then return true; end $$;

set role authenticated;
select pg_temp.as_user('a'); select update_location(12.9716, 77.5946);
select pg_temp.as_user('b'); select update_location(12.9900, 77.6000);
select pg_temp.as_user('c'); select update_location(13.3000, 77.6000);
select pg_temp.as_user('d'); select update_location(12.9800, 77.5950);

select pg_temp.as_user('c'); select swipe(1, true);
select pg_temp.as_user('d'); select swipe(1, true);
select pg_temp.as_user('b'); select swipe(1, true); select swipe(2, false);

select pg_temp.as_user('a');
select pg_temp.check((select title from get_feed(10) limit 1) = 'The Hobbit', 'feed ranks nearby-liked book first');
select pg_temp.check((select nearby_likes from get_feed(10) where title = 'The Hobbit') = 1, 'nearby_likes counts only compatible readers in range');
select pg_temp.check((select count(*) from profiles) = 1, 'RLS: profiles only exposes own row');
select pg_temp.check((select bio from profiles) = 'I love **** books', 'profanity masked in bio');
select pg_temp.check((select other_name from swipe(1, true)) = 'Ben', 'right swipe matches compatible nearby reader');
select pg_temp.check((select count(*) from get_matches()) = 1, 'no match with far (Cal) or incompatible (Dev) readers');
select pg_temp.check(not exists (select 1 from get_feed(10) where title = 'The Hobbit'), 'swiped books leave the feed');
insert into messages (match_id, sender_id, body)
  select match_id, auth.uid(), 'What the fuck did you think of Smaug?' from get_matches();
select pg_temp.check((select body from messages) like 'What the **** %', 'profanity masked in messages');

select pg_temp.as_user('c');
select pg_temp.check((select count(*) from messages) = 0, 'RLS: outsiders cannot read a match chat');
select pg_temp.check((select count(*) from get_matches()) = 0, 'outsiders see no matches');

-- Distance preference: Asha (~2 km from Ben) narrows to 1 km, so they no longer fit.
select pg_temp.as_user('a');
update profiles set max_km = 1 where id = auth.uid();
reset role;
select pg_temp.check(not is_compatible(a, b), 'distance: the smaller of the two choices applies')
  from profiles a, profiles b where a.display_name = 'Asha' and b.display_name = 'Ben';
update profiles set max_km = 16.1 where display_name = 'Asha';
select pg_temp.check(is_compatible(a, b), 'distance: up to 10 miles (16.1 km) allowed')
  from profiles a, profiles b where a.display_name = 'Asha' and b.display_name = 'Ben';
set role authenticated;

-- Search, genre browsing, adding Open Library books, birthday lock, nearby chip.
select pg_temp.as_user('a');
select pg_temp.check((select liked from search_books('hobb')) and (select count(*) from search_books('hobb')) = 1, 'search finds a book by title and shows it as liked');
select pg_temp.check((select count(*) from search_books('tolkien')) = 1, 'search matches author');
select pg_temp.check((select count(*) from search_books('h')) = 0, 'search ignores one-letter queries');
select pg_temp.check((select bool_and('thriller' = any (genres)) and count(*) = 1 from get_feed(10, 'thriller')), 'genre browsing filters the feed');
select add_book('/works/OL1W', 'Tomb of Sand', 'Geetanjali Shree', 123, 2018, '{literary_fiction,"Bad!"}');
select pg_temp.check((select cover_url from books where ol_key = '/works/OL1W') = 'https://covers.openlibrary.org/b/id/123-L.jpg', 'add_book builds the cover URL server-side');
select pg_temp.check((select genres from books where ol_key = '/works/OL1W') = '{literary_fiction}', 'add_book drops invalid genres');
select pg_temp.check(add_book('/works/OL1W', 'Again', null, 1, null, '{}') = (select id from books where ol_key = '/works/OL1W'), 'add_book is idempotent');
select pg_temp.check(pg_temp.raises($$select add_book('javascript:x', 'X', null, 1, null, '{}')$$), 'add_book rejects bad keys');
select pg_temp.check(pg_temp.raises($$update profiles set birthdate = '1990-01-01' where id = auth.uid()$$), 'birthday is locked after onboarding');
select pg_temp.check(nearby_readers() = 'few', 'nearby chip shows a bucket, not a count');

-- Friends mode: Esha (woman, friends) near Asha. Asha passes Gone Girl, switches
-- to friends, then likes it from search: they match as book buddies.
reset role;
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000e');
insert into profiles (id, display_name, birthdate, gender, interested_in, genres, looking_for)
  values ('00000000-0000-0000-0000-00000000000e', 'Esha', '1994-01-01', 'woman', '{man}', '{thriller,romance,classics}', 'friends');
set role authenticated;
select pg_temp.as_user('e'); select update_location(12.9750, 77.5960); select swipe(2, true); select swipe(3, true);
select pg_temp.as_user('a'); select swipe(2, false);
update profiles set looking_for = 'friends' where id = auth.uid();
select pg_temp.check((select mode = 'friends' and other_name = 'Esha' from swipe(2, true)), 'friends mode ignores gender; re-liking a passed book matches');
select pg_temp.check((select count(*) from swipe(3, true)) = 0, 'one match per pair');
select pg_temp.check((select array_agg(mode order by mode) from get_matches()) = '{dating,friends}', 'switching modes keeps existing matches, tagged');
select unmatch((select match_id from get_matches() where mode = 'friends'));
select pg_temp.check((select count(*) from get_matches()) = 1, 'unmatch removes the person');
select pg_temp.check((select liked from swipes where book_id = 2), 'unmatch keeps your like on the book');
reset role;
select pg_temp.check(not is_compatible(a, e), 'unmatched readers never match again')
  from profiles a, profiles e where a.display_name = 'Asha' and e.display_name = 'Esha';
select pg_temp.check(not is_compatible(a, b), 'dating and friends readers never match')
  from profiles a, profiles b where a.display_name = 'Asha' and b.display_name = 'Ben';
set role authenticated;

select pg_temp.as_user('b');
select block_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from get_matches()) = 0, 'blocking removes the match');
select delete_account();

reset role;
select pg_temp.check((select count(*) from profiles) = 4, 'delete_account cascades');
select pg_temp.check((select count(*) from net.sent) = 4, 'push sent for matches and messages (Esha has no push token)');
select pg_temp.check((select count(*) from net.sent where body->>'title' like 'You found a book buddy%') = 1, 'friends matches use book-buddy push copy');
select pg_temp.check((select count(*) from analytics_daily) = 30, 'analytics view has 30 days');
