-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- One row per user per game. Row Level Security makes sure people can only ever touch their own rows.

create table if not exists public.progress (
  user_id     uuid   not null references auth.users (id) on delete cascade,
  game        text   not null,                 -- e.g. 'redblue', 'home'
  checked     text[] not null default '{}',    -- ids of the ticked checkboxes
  done        int    not null default 0,
  total       int    not null default 0,
  modified_at bigint not null default 0,       -- ms since epoch, set by the browser that made the change
  primary key (user_id, game)
);

alter table public.progress enable row level security;

create policy "read own progress"   on public.progress for select using (auth.uid() = user_id);
create policy "insert own progress" on public.progress for insert with check (auth.uid() = user_id);
create policy "update own progress" on public.progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own progress" on public.progress for delete using (auth.uid() = user_id);
