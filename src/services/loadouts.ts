import { openDB, type IDBPDatabase } from 'idb'
import type { FactionId, GenerationMode, Loadout } from '@/types'
import { supabase } from './supabase'
import { isOnline } from './connectivity'

const DB_NAME = 'hd2-loadout'
const DB_VERSION = 2
const STORE = 'loadouts'
const META_STORE = 'meta'

export const MAX_LOADOUTS = 50
export const WARN_AT = 45

// Per-row sync metadata introduced in v2 (PRD §13.7). Phase 4 begins using these
// when the source of truth flips to Supabase; in Phase 0 every locally-saved row is
// simply "never synced, not pending" and the flags never affect behavior.
export interface SyncMeta {
  unsynced: boolean // written locally, not yet acknowledged by the server
  deleted: boolean // tombstone for an offline delete pending propagation
  lastSyncedAt: string | null // last successful server sync for this row
}

// What actually lives in IndexedDB: the domain Loadout plus sync bookkeeping.
export type StoredLoadout = Loadout & SyncMeta

const SYNC_DEFAULTS: SyncMeta = { unsynced: false, deleted: false, lastSyncedAt: null }

// Keys for the small key/value `meta` store. `firstSignInMerged` gates the
// once-per-device first-sign-in merge in Phase 4 (PRD §13.7).
export type MetaKey = 'firstSignInMerged'

// Outcome of the first sign-in merge, for the confirmation toast (PRD §6.3).
export interface FirstSignInMergeResult {
  merged: number // local loadouts successfully written to the account
  total: number // local loadouts found to migrate
  capExceeded: boolean // some didn't fit under the 50-loadout cap
}

let _db: IDBPDatabase | null = null

async function getDb(): Promise<IDBPDatabase> {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
        if (oldVersion < 2) {
          // Add the key/value meta store first so no schema mutation happens after
          // the async cursor awaits below (which would risk the versionchange tx).
          db.createObjectStore(META_STORE)
          // Backfill existing v1 loadout rows with safe sync defaults. Defaults go
          // first so the row's own fields always win on the spread.
          const store = tx.objectStore(STORE)
          let cursor = await store.openCursor()
          while (cursor) {
            cursor.update({ ...SYNC_DEFAULTS, ...cursor.value })
            cursor = await cursor.continue()
          }
        }
      },
    })
  }
  return _db
}

// Strip sync bookkeeping before handing rows back to the UI, keeping the v1
// return shape (Loadout) stable across the Phase 4 backend swap.
function toLoadout(stored: StoredLoadout): Loadout {
  const { unsynced: _u, deleted: _d, lastSyncedAt: _l, ...loadout } = stored
  return loadout
}

async function activeStored(db: IDBPDatabase): Promise<StoredLoadout[]> {
  const all = (await db.getAll(STORE)) as StoredLoadout[]
  // Tombstoned rows (offline deletes pending propagation) are invisible to the UI.
  return all.filter(row => !row.deleted)
}

// ---------------------------------------------------------------------------
// Supabase backing (Phase 4). When a user is signed in, Supabase is the source
// of truth and IndexedDB acts as a local read CACHE (PRD §13.2/§13.3):
//
//   - Reads come from the cache. A pull from Supabase (on first read of a
//     session and on every focus event) overwrites the cached mirror.
//   - Online writes go to Supabase first, then mirror into the cache on success.
//   - The cache lets a signed-in user still SEE their loadouts while offline.
//
// Signed-out users use the plain IndexedDB path above, unchanged.
//
// Merge 2 layers offline behavior on top of this cache: unsynced writes,
// tombstone deletes, the reconnect processor, and the first-sign-in merge. Those
// seams (the SyncMeta flags) already exist on StoredLoadout.
// ---------------------------------------------------------------------------

const SB_COLUMNS =
  'id, primary_weapon_id, secondary_weapon_id, grenade_id, ' +
  'stratagem_1_id, stratagem_2_id, stratagem_3_id, stratagem_4_id, ' +
  'armor_id, booster_id, faction, planet, difficulty, mission_type, ' +
  'modifiers, generation_mode, created_at'

interface LoadoutRow {
  id: string
  primary_weapon_id: string
  secondary_weapon_id: string
  grenade_id: string
  stratagem_1_id: string | null
  stratagem_2_id: string | null
  stratagem_3_id: string | null
  stratagem_4_id: string | null
  armor_id: string
  booster_id: string
  faction: string | null
  planet: string | null
  difficulty: number | null
  mission_type: string | null
  modifiers: string[] | null
  generation_mode: string
  created_at: string
}

// Postgres SQLSTATE for the check_violation our 50-row cap trigger raises.
const CAP_VIOLATION_CODE = '23514'
// unique_violation — a queued insert whose id is already on the server (a prior
// attempt that succeeded server-side but didn't get its local flag cleared).
const CONFLICT_CODE = '23505'

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

function rowToLoadout(row: LoadoutRow): Loadout {
  const stratagems = [
    row.stratagem_1_id,
    row.stratagem_2_id,
    row.stratagem_3_id,
    row.stratagem_4_id,
  ].filter((s): s is string => !!s)

  return {
    id: row.id,
    primaryWeapon: row.primary_weapon_id,
    secondaryWeapon: row.secondary_weapon_id,
    grenade: row.grenade_id,
    stratagems,
    armor: row.armor_id,
    booster: row.booster_id,
    faction: (row.faction as FactionId) ?? undefined,
    planet: row.planet ?? undefined,
    difficulty: row.difficulty ?? undefined,
    missionType: row.mission_type ?? undefined,
    modifiers: row.modifiers ?? undefined,
    generationMode: row.generation_mode as GenerationMode,
    createdAt: row.created_at,
  }
}

function loadoutToRow(loadout: Loadout, userId: string): Record<string, unknown> {
  return {
    id: loadout.id,
    user_id: userId,
    primary_weapon_id: loadout.primaryWeapon,
    secondary_weapon_id: loadout.secondaryWeapon,
    grenade_id: loadout.grenade,
    stratagem_1_id: loadout.stratagems[0] ?? null,
    stratagem_2_id: loadout.stratagems[1] ?? null,
    stratagem_3_id: loadout.stratagems[2] ?? null,
    stratagem_4_id: loadout.stratagems[3] ?? null,
    armor_id: loadout.armor,
    booster_id: loadout.booster,
    faction: loadout.faction ?? null,
    planet: loadout.planet ?? null,
    difficulty: loadout.difficulty ?? null,
    mission_type: loadout.missionType ?? null,
    modifiers: loadout.modifiers ?? null,
    generation_mode: loadout.generationMode,
    // Preserve the client timestamp so cross-device ordering matches what the
    // user saw locally rather than drifting to server insert time.
    created_at: loadout.createdAt,
  }
}

// Tracks which account's data the cache currently holds, so the first read of a
// session pulls from the server exactly once. Reset on sign-out / account change.
let hydratedUserId: string | null = null

// Lightweight change notifier so views can re-read after background mutations
// (the first-sign-in merge and the reconnect sync processor) complete, rather
// than racing them. Subscribers re-fetch via getAll(); see SavedLoadouts.
type ChangeListener = () => void
const changeListeners = new Set<ChangeListener>()
export function onLoadoutsChanged(listener: ChangeListener): () => void {
  changeListeners.add(listener)
  return () => changeListeners.delete(listener)
}
function emitLoadoutsChanged(): void {
  changeListeners.forEach(listener => listener())
}

// A cached row is part of the signed-in user's view when it's either a synced
// mirror row (`lastSyncedAt` set) or a pending local write (`unsynced`) — and not
// a tombstone. Pre-sign-in local-only rows (never synced, not pending) are hidden
// from the signed-in view; they await the first-sign-in merge (Step 4) and are
// only visible again signed-out.
function isSignedInVisible(row: StoredLoadout): boolean {
  return !row.deleted && (row.lastSyncedAt != null || row.unsynced)
}

// Pull the authoritative server list and overwrite the cached mirror. Bails
// without touching the cache if offline or the fetch fails, so a transient drop
// leaves the last-known-good cache in place rather than wiping it. Pending local
// writes (`unsynced`) and tombstones are preserved across the reconcile.
async function pullFromServer(userId: string): Promise<boolean> {
  if (!isOnline()) return false
  const { data, error } = await supabase
    .from('saved_loadouts')
    .select(SB_COLUMNS)
    .order('created_at', { ascending: false })
  if (error || !data) return false

  const serverRows = data as unknown as LoadoutRow[]
  const tombstonedIds = new Set<string>()
  const db = await getDb()
  const tx = db.transaction(STORE, 'readwrite')

  // Drop the previous clean mirror (synced, not pending, not a tombstone); keep
  // unsynced writes and tombstones so Steps 2–3's pending state survives a pull.
  let cursor = await tx.store.openCursor()
  while (cursor) {
    const row = cursor.value as StoredLoadout
    if (row.deleted) tombstonedIds.add(row.id)
    if (row.lastSyncedAt != null && !row.unsynced && !row.deleted) {
      await cursor.delete()
    }
    cursor = await cursor.continue()
  }

  // Write the fresh server rows as clean mirror entries, skipping any the user
  // has locally tombstoned (their DELETE just hasn't propagated yet).
  const syncedAt = new Date().toISOString()
  for (const row of serverRows) {
    if (tombstonedIds.has(row.id)) continue
    const stored: StoredLoadout = {
      ...rowToLoadout(row),
      unsynced: false,
      deleted: false,
      lastSyncedAt: syncedAt,
    }
    await tx.store.put(stored)
  }

  await tx.done
  hydratedUserId = userId
  return true
}

// Ensure the cache has been populated from the server at least once this session
// for this account. Subsequent reads serve from the cache until a focus-driven
// pull refreshes it (PRD §13.2).
async function ensureHydrated(userId: string): Promise<void> {
  if (hydratedUserId === userId) return
  await pullFromServer(userId)
}

// Mirror a single server-confirmed row into the cache as a clean synced entry.
async function mirrorToCache(loadout: Loadout): Promise<void> {
  const db = await getDb()
  const stored: StoredLoadout = {
    ...loadout,
    unsynced: false,
    deleted: false,
    lastSyncedAt: new Date().toISOString(),
  }
  await db.put(STORE, stored)
}

// Reconnect sync processor (PRD §13.4). Pushes locally-queued writes to Supabase
// in chronological order, clearing each row's `unsynced` flag on success. A
// failure leaves the flag set and moves on: the 50-cap (23514) is the expected
// case and surfaces to the user via the Saved Loadouts banner (Step 5); other
// failures retry on the next focus/online event. Tombstone deletes are added in
// Step 3.
async function pushPending(userId: string): Promise<void> {
  if (!isOnline()) return
  const db = await getDb()
  const all = (await db.getAll(STORE)) as StoredLoadout[]
  const pendingSaves = all
    .filter(row => row.unsynced && !row.deleted)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  let changed = false
  for (const row of pendingSaves) {
    try {
      const { error } = await supabase
        .from('saved_loadouts')
        .insert(loadoutToRow(toLoadout(row), userId))
      // Leave the flag set on cap or transient failure so it retries / surfaces.
      if (error && error.code !== CONFLICT_CODE) continue
    } catch {
      // Network threw mid-sync: leave flagged, the next trigger retries.
      continue
    }
    // Success (or already present server-side): promote to a clean synced row.
    const cleared: StoredLoadout = {
      ...row,
      unsynced: false,
      deleted: false,
      lastSyncedAt: new Date().toISOString(),
    }
    await db.put(STORE, cleared)
    changed = true
  }

  // Propagate offline deletes (PRD §13.5): DELETE the server row, then remove the
  // local tombstone once confirmed. A failure leaves the tombstone for next time.
  const pendingDeletes = all.filter(row => row.unsynced && row.deleted)
  for (const row of pendingDeletes) {
    try {
      const { error } = await supabase.from('saved_loadouts').delete().eq('id', row.id)
      if (error) continue
    } catch {
      continue
    }
    await db.delete(STORE, row.id)
    changed = true
  }

  if (changed) emitLoadoutsChanged()
}

// Coalesce concurrent sync runs (focus + online event can fire together) so the
// queue is only drained by one in-flight pass at a time.
let syncInFlight: Promise<void> | null = null
function pushPendingGuarded(userId: string): Promise<void> {
  if (!syncInFlight) {
    syncInFlight = pushPending(userId).finally(() => {
      syncInFlight = null
    })
  }
  return syncInFlight
}

export const loadoutService = {
  // Fetch-on-focus entry point (PRD §13.2/§13.4): drain any queued local writes
  // first, then pull the server list into the cache. No-op signed out; offline,
  // both halves bail safely. The caller then reads the cache via getAll().
  async refresh(): Promise<void> {
    const userId = await currentUserId()
    if (!userId) return
    await pushPendingGuarded(userId)
    await pullFromServer(userId)
  },

  // Drain the offline write queue without re-pulling — used by the connectivity
  // (`online` event) trigger so pending writes sync the moment we reconnect.
  async syncPending(): Promise<void> {
    const userId = await currentUserId()
    if (userId) await pushPendingGuarded(userId)
  },

  // First sign-in merge (PRD §6.3/§13.6). Migrates loadouts saved while signed
  // out (local-only rows: never synced, not tombstoned) into the account. Runs
  // once per device/account, gated by `meta.firstSignInMerged`. Inserts go in as
  // ordinary writes so the 50-cap produces the same partial-sync outcome as any
  // other queued write: rows that fit become synced, the rest stay flagged
  // unsynced and surface via the Saved Loadouts banner (Step 5). Returns null
  // when there's nothing to do (already merged, signed out, or offline → retry).
  async firstSignInMerge(): Promise<FirstSignInMergeResult | null> {
    const userId = await currentUserId()
    if (!userId) return null
    if (await metaService.get<boolean>('firstSignInMerged')) return null
    if (!isOnline()) return null

    const db = await getDb()
    const all = (await db.getAll(STORE)) as StoredLoadout[]
    const localOnly = all
      .filter(row => !row.deleted && row.lastSyncedAt == null)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    if (localOnly.length === 0) {
      await metaService.set('firstSignInMerged', true)
      return { merged: 0, total: 0, capExceeded: false }
    }

    let merged = 0
    let capExceeded = false
    for (const row of localOnly) {
      try {
        const { error } = await supabase
          .from('saved_loadouts')
          .insert(loadoutToRow(toLoadout(row), userId))
        if (error) {
          if (error.code === CAP_VIOLATION_CODE) {
            // Doesn't fit under the cap: keep it as a flagged local write.
            capExceeded = true
            await db.put(STORE, { ...row, unsynced: true })
            continue
          }
          if (error.code !== CONFLICT_CODE) {
            // Transient: keep as a queued write; the reconnect processor retries.
            await db.put(STORE, { ...row, unsynced: true })
            continue
          }
          // CONFLICT_CODE: already on the server — count it as merged.
        }
      } catch {
        await db.put(STORE, { ...row, unsynced: true })
        continue
      }
      merged++
      await db.put(STORE, { ...row, unsynced: false, deleted: false, lastSyncedAt: new Date().toISOString() })
    }

    await metaService.set('firstSignInMerged', true)
    // §13.6 steps 6–7: re-pull so the cache reflects server truth post-merge.
    await pullFromServer(userId)
    emitLoadoutsChanged()
    return { merged, total: localOnly.length, capExceeded }
  },

  async getAll(): Promise<Loadout[]> {
    const userId = await currentUserId()
    if (userId) {
      await ensureHydrated(userId)
      const db = await getDb()
      const all = (await db.getAll(STORE)) as StoredLoadout[]
      return all
        .filter(isSignedInVisible)
        .map(toLoadout)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    const db = await getDb()
    const active = await activeStored(db)
    return active
      .map(toLoadout)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  async get(id: string): Promise<Loadout | undefined> {
    const userId = await currentUserId()
    if (userId) await ensureHydrated(userId)

    const db = await getDb()
    const stored = (await db.get(STORE, id)) as StoredLoadout | undefined
    if (!stored) return undefined
    // Signed in, apply the cache visibility rule; signed out, just hide tombstones.
    if (userId ? !isSignedInVisible(stored) : stored.deleted) return undefined
    return toLoadout(stored)
  },

  async save(loadout: Loadout): Promise<{ saved: boolean; nearLimit: boolean }> {
    const userId = await currentUserId()
    if (userId) {
      // Online write: Supabase first, then mirror into the cache on success
      // (PRD §13.3).
      if (isOnline()) {
        try {
          const { error } = await supabase
            .from('saved_loadouts')
            .insert(loadoutToRow(loadout, userId))
          // Server-side 50-row cap rejects the insert; surface as "not saved" so
          // the UI shows its storage-full state (same as the local cap below).
          if (error?.code === CAP_VIOLATION_CODE) return { saved: false, nearLimit: false }
          if (!error) {
            await mirrorToCache(loadout)
            const { count } = await supabase
              .from('saved_loadouts')
              .select('id', { count: 'exact', head: true })
            return { saved: true, nearLimit: (count ?? 0) >= WARN_AT }
          }
          // Non-cap failure while nominally online: `navigator.onLine` isn't
          // authoritative, so rather than mislabel this as "storage full" we fall
          // through and queue it locally for the reconnect processor to retry.
        } catch {
          // Network threw (offline despite navigator.onLine): fall through to queue.
        }
      }

      // Offline (or an online insert that failed for a non-cap reason): queue
      // the write in IndexedDB flagged unsynced (PRD §13.3). The UI still
      // confirms the save; the reconnect processor pushes it later.
      const db = await getDb()
      const all = (await db.getAll(STORE)) as StoredLoadout[]
      // Client-side hard cap on local count, synced + unsynced (PRD §6.6).
      const localCount = all.filter(isSignedInVisible).length
      if (localCount >= MAX_LOADOUTS) return { saved: false, nearLimit: false }
      const queued: StoredLoadout = { ...loadout, unsynced: true, deleted: false, lastSyncedAt: null }
      await db.put(STORE, queued)
      return { saved: true, nearLimit: localCount + 1 >= WARN_AT }
    }

    const db = await getDb()
    const count = (await activeStored(db)).length
    if (count >= MAX_LOADOUTS) return { saved: false, nearLimit: false }
    // Signed-out / local writes carry the default sync metadata.
    const stored: StoredLoadout = { ...SYNC_DEFAULTS, ...loadout }
    await db.put(STORE, stored)
    return { saved: true, nearLimit: count + 1 >= WARN_AT }
  },

  async delete(id: string): Promise<void> {
    const userId = await currentUserId()
    if (userId) {
      const db = await getDb()
      // Online delete: Supabase first, then drop from the cache.
      if (isOnline()) {
        try {
          const { error } = await supabase.from('saved_loadouts').delete().eq('id', id)
          if (!error) {
            await db.delete(STORE, id)
            return
          }
          // Non-network error: fall through and tombstone so it retries.
        } catch {
          // Network threw: fall through to the offline tombstone path.
        }
      }

      // Offline (or a failed online delete): tombstone for deferred propagation
      // (PRD §13.5). A row that never reached the server (a queued offline create,
      // lastSyncedAt null) has nothing to propagate, so just drop it locally.
      const row = (await db.get(STORE, id)) as StoredLoadout | undefined
      if (!row) return
      if (row.lastSyncedAt == null) {
        await db.delete(STORE, id)
      } else {
        await db.put(STORE, { ...row, unsynced: true, deleted: true })
      }
      return
    }

    const db = await getDb()
    // Phase 0 keeps v1 behavior: a hard delete. Phase 4 introduces tombstoning
    // (`deleted: true`) for offline signed-in deletes per PRD §13.5.
    await db.delete(STORE, id)
  },

  async deleteAll(): Promise<void> {
    const userId = await currentUserId()
    if (userId) {
      // Delete requires a filter; user_id matches every row RLS would expose.
      await supabase.from('saved_loadouts').delete().eq('user_id', userId)
      // Force a re-pull on the next read now that the mirror is gone.
      hydratedUserId = null
    }

    // Always clear the local store too, so signing out leaves nothing behind.
    const db = await getDb()
    await db.clear(STORE)
  },

  // Wipe the local cache + sync state WITHOUT touching the server (PRD §13.8/§4.6).
  // Used on sign-out: the account keeps its loadouts server-side, while this
  // device starts clean (no stale rows visible to the next user) and the
  // first-sign-in merge becomes eligible again for the next sign-in. Pending
  // unsynced writes are discarded per assumption A-V2-9.
  async clearLocalData(): Promise<void> {
    const db = await getDb()
    await db.clear(STORE)
    await db.delete(META_STORE, 'firstSignInMerged')
    hydratedUserId = null
  },

  async count(): Promise<number> {
    const userId = await currentUserId()
    if (userId) {
      await ensureHydrated(userId)
      const db = await getDb()
      const all = (await db.getAll(STORE)) as StoredLoadout[]
      return all.filter(isSignedInVisible).length
    }

    const db = await getDb()
    return (await activeStored(db)).length
  },

  // Ids of loadouts written locally but not yet acknowledged by the server, for
  // the Saved Loadouts "Local" pill + cap banner (PRD §6.5). Empty when signed
  // out (local-only rows have no sync state to surface).
  async unsyncedIds(): Promise<string[]> {
    const userId = await currentUserId()
    if (!userId) return []
    const db = await getDb()
    const all = (await db.getAll(STORE)) as StoredLoadout[]
    return all.filter(row => row.unsynced && !row.deleted).map(row => row.id)
  },
}

// Small typed accessor over the key/value `meta` store. Unused in Phase 0 beyond
// reserving the seam; Phase 4 reads/writes `firstSignInMerged` through it.
export const metaService = {
  async get<T>(key: MetaKey): Promise<T | undefined> {
    const db = await getDb()
    return (await db.get(META_STORE, key)) as T | undefined
  },

  async set<T>(key: MetaKey, value: T): Promise<void> {
    const db = await getDb()
    await db.put(META_STORE, value, key)
  },
}
