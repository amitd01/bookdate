-- Removes every synthetic test reader (scripts/synthetic-readers.sql) and,
-- by cascade, their likes, matches and messages. Real readers are untouched.
-- Books' like counts never included synthetic likes, so nothing to undo there.
begin;
delete from auth.users where id in (select id from public.profiles where is_synthetic);
select count(*) as synthetic_left from public.profiles where is_synthetic;
commit;
