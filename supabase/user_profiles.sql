-- Phase 3 — user_profiles (PRD §12.2)
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent where practical).

-- 1. The table: one row per user, keyed by their auth id. Deleting the auth
--    user cascades and removes the profile automatically (used in Phase 7).
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  ship_name text,
  player_title text,
  hide_paid_items boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Row Level Security: lock the table so a signed-in user can only ever touch
--    their own row. Nothing is readable/writable without matching auth.uid().
alter table public.user_profiles enable row level security;

drop policy if exists "read own profile" on public.user_profiles;
create policy "read own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "insert own profile" on public.user_profiles;
create policy "insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own profile" on public.user_profiles;
create policy "update own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- No DELETE policy on purpose: profile deletion happens only via the account
-- deletion Edge Function in Phase 7 (which deletes the auth user → cascade).

-- 3. Auto-create a blank profile whenever a new auth user signs up. Runs as the
--    function owner (security definer) so it can insert past RLS during signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Keep updated_at honest on every change.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_touch_updated_at on public.user_profiles;
create trigger user_profiles_touch_updated_at
  before update on public.user_profiles
  for each row execute function public.touch_updated_at();

-- 5. Backfill profiles for any users who signed up before this trigger existed
--    (e.g. the accounts created while testing Phase 2).
insert into public.user_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;
