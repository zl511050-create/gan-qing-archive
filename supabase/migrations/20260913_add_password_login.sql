-- Run this migration in the Supabase SQL Editor for an existing deployment.
-- It is safe to rerun after a partial execution.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.users add column if not exists password_hash text;
alter table public.users add column if not exists session_token_hash text;
alter table public.users alter column id set default gen_random_uuid();
alter table public.posts add column if not exists user_id uuid references public.users(id) on delete set null;
alter table public.posts add column if not exists is_anonymous boolean not null default false;

create unique index if not exists users_username_lower_unique on public.users (lower(username));

drop function if exists public.register_community_user(text, text);
drop function if exists public.register_community_user(text, text, text);
drop function if exists public.login_community_user(text, text);

create function public.register_community_user(p_username text, p_password text, p_avatar_url text default null)
returns table (id uuid, username text, avatar_url text, created_at timestamptz, session_token text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  clean_username text := btrim(p_username);
  raw_session_token text := gen_random_uuid()::text;
begin
  if char_length(clean_username) not between 1 and 24 then raise exception 'invalid_username'; end if;
  if p_password !~ '^[0-9]{4}$' then raise exception 'invalid_password'; end if;
  return query
    with inserted_user as (
      insert into public.users as new_user (username, password_hash, session_token_hash, avatar_url)
      values (
        clean_username,
        extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
        extensions.crypt(raw_session_token, extensions.gen_salt('bf', 10)),
        p_avatar_url
      )
      returning new_user.id, new_user.username, new_user.avatar_url, new_user.created_at
    )
    select inserted_user.id, inserted_user.username, inserted_user.avatar_url, inserted_user.created_at, raw_session_token
    from inserted_user;
exception when unique_violation then raise exception 'nickname_taken';
end;
$$;

create function public.login_community_user(p_username text, p_password text)
returns table (id uuid, username text, avatar_url text, created_at timestamptz, session_token text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  matched_user public.users%rowtype;
  raw_session_token text := gen_random_uuid()::text;
begin
  if p_password !~ '^[0-9]{4}$' then return; end if;
  select app_user.* into matched_user
  from public.users as app_user
  where lower(app_user.username) = lower(btrim(p_username))
    and app_user.password_hash is not null
    and app_user.password_hash = extensions.crypt(p_password, app_user.password_hash)
  limit 1;
  if not found then return; end if;
  update public.users as app_user
  set session_token_hash = extensions.crypt(raw_session_token, extensions.gen_salt('bf', 10))
  where app_user.id = matched_user.id;
  return query select matched_user.id, matched_user.username, matched_user.avatar_url, matched_user.created_at, raw_session_token;
end;
$$;

create or replace function public.update_community_user_avatar(p_user_id uuid, p_session_token text, p_avatar_url text)
returns table (id uuid, username text, avatar_url text, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_avatar_url is null or char_length(p_avatar_url) > 1500000 then raise exception 'invalid_avatar'; end if;
  return query
    update public.users as app_user
    set avatar_url = p_avatar_url
    where app_user.id = p_user_id
      and app_user.session_token_hash is not null
      and app_user.session_token_hash = extensions.crypt(p_session_token, app_user.session_token_hash)
    returning app_user.id, app_user.username, app_user.avatar_url, app_user.created_at;
  if not found then raise exception 'invalid_session'; end if;
end;
$$;

drop policy if exists "community users" on public.users;
revoke all privileges on table public.users from anon, authenticated;
revoke all on function public.register_community_user(text, text, text) from public;
revoke all on function public.login_community_user(text, text) from public;
revoke all on function public.update_community_user_avatar(uuid, text, text) from public;
grant execute on function public.register_community_user(text, text, text) to anon, authenticated;
grant execute on function public.login_community_user(text, text) to anon, authenticated;
grant execute on function public.update_community_user_avatar(uuid, text, text) to anon, authenticated;
