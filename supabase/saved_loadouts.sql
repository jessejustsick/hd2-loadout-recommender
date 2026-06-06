-- Phase 4 — saved_loadouts (PRD §12.1)
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent where practical).

-- 1. The table: one row per saved loadout, owned by an auth user. Deleting the
--    auth user cascades and removes their loadouts automatically (Phase 7).
--    No UPDATE path exists by design — loadouts are immutable once saved (v1's
--    read-only constraint carries forward); edits are delete + re-save.
create table if not exists public.saved_loadouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary_weapon_id text,
  secondary_weapon_id text,
  grenade_id text,
  stratagem_1_id text,
  stratagem_2_id text,
  stratagem_3_id text,
  stratagem_4_id text,
  armor_id text,
  booster_id text,
  faction text,        -- nullable: null for randomized loadouts
  planet text,         -- nullable: null for randomized loadouts
  difficulty integer,  -- nullable: 1–10 for recommended; null for randomized
  mission_type text,   -- nullable: null for randomized loadouts
  modifiers text[],    -- nullable: mission modifier ids; rendered as chips on saved cards
  generation_mode text not null
    check (generation_mode in ('recommended', 'constrained_random', 'full_random')),
  no_paid_items boolean not null default false, -- Phase 5: generated with the paid-items filter on; tags the card "No paid items"
  created_at timestamptz not null default now()
);

-- 1a. Modifiers column was added after the table was first created in some
--     environments, so add it idempotently for already-provisioned databases.
--     (Harmless no-op when the create above already included it.)
alter table public.saved_loadouts
  add column if not exists modifiers text[];

-- 1b. Phase 5: paid-items provenance flag, added idempotently for already-
--     provisioned databases. Existing rows default to false (untagged).
alter table public.saved_loadouts
  add column if not exists no_paid_items boolean not null default false;

-- 2. Index for the "most recent first" list query that drives the Saved
--    Loadouts screen and fetch-on-focus reads.
create index if not exists saved_loadouts_user_created_idx
  on public.saved_loadouts (user_id, created_at desc);

-- 3. Row Level Security: a signed-in user can only ever see/insert/delete their
--    own rows. No UPDATE policy on purpose (loadouts are immutable).
alter table public.saved_loadouts enable row level security;

drop policy if exists "read own loadouts" on public.saved_loadouts;
create policy "read own loadouts"
  on public.saved_loadouts for select
  using (auth.uid() = user_id);

drop policy if exists "insert own loadouts" on public.saved_loadouts;
create policy "insert own loadouts"
  on public.saved_loadouts for insert
  with check (auth.uid() = user_id);

drop policy if exists "delete own loadouts" on public.saved_loadouts;
create policy "delete own loadouts"
  on public.saved_loadouts for delete
  using (auth.uid() = user_id);
-- No UPDATE policy: loadouts cannot be edited in place.

-- 4. Server-side 50-loadout cap (PRD §6.6, §12.1). A BEFORE INSERT trigger
--    counts the user's existing rows and rejects the insert once they're at 50.
--
--    Critically, this is a per-row check that raises on overflow — it is NOT a
--    bulk/merge-aware code path. The first-sign-in merge (§6.3) inserts its
--    rows one at a time like any other write: those that fit under 50 succeed
--    and clear their `unsynced` flag client-side; the overflow rows fail here,
--    stay flagged in IndexedDB, and surface through the §6.5 partial-sync
--    banner. The client catches the raised error and keeps the flag — so the
--    cap and the merge share one mechanism rather than two.
create or replace function public.enforce_saved_loadouts_cap()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (select count(*) from public.saved_loadouts where user_id = new.user_id) >= 50 then
    raise exception 'saved_loadouts cap reached: user % already has 50 loadouts', new.user_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists saved_loadouts_enforce_cap on public.saved_loadouts;
create trigger saved_loadouts_enforce_cap
  before insert on public.saved_loadouts
  for each row execute function public.enforce_saved_loadouts_cap();
