create table if not exists public.users (
  id uuid primary key,
  username text not null check (char_length(username) between 1 and 24),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 24),
  avatar text,
  mood text not null,
  content text not null check (char_length(content) between 1 and 500),
  category text not null check (category in ('keep', 'release', 'wait')),
  likes integer not null default 0 check (likes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key,
  username text not null check (char_length(username) between 1 and 24),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.like_records (
  note_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  primary key (note_id, user_id)
);

create table if not exists public.replies (
  id uuid primary key,
  note_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  author_name text not null,
  author_avatar text,
  content text not null check (char_length(content) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.users add column if not exists avatar_url text;
alter table public.posts add column if not exists avatar text;
alter table public.posts add column if not exists nickname text;
alter table public.replies add column if not exists author_avatar text;

alter table public.users enable row level security;
alter table public.posts enable row level security;
alter table public.like_records enable row level security;
alter table public.replies enable row level security;

create policy "community users" on public.users for all to anon using (true) with check (true);
create policy "community posts" on public.posts for all to anon using (true) with check (true);
create policy "community likes" on public.like_records for all to anon using (true) with check (true);
create policy "community replies" on public.replies for all to anon using (true) with check (true);
