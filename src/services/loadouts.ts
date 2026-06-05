import { openDB, type IDBPDatabase } from 'idb'
import type { FactionId, GenerationMode, Loadout } from '@/types'
import { supabase } from './supabase'

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
// Supabase backing (Phase 4). When a user is signed in, the cloud table is the
// source of truth and these helpers map between it and the v1 `Loadout` shape.
// Signed-out users continue to use the IndexedDB path above unchanged.
//
// Merge 1 (this code) covers the online happy path: signed-in reads/writes go
// straight to Supabase. Merge 2 will add the IndexedDB mirror that backs
// offline use — unsynced writes, tombstone deletes, the reconnect processor,
// and the first-sign-in merge. Those seams already exist on StoredLoadout.
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

export const loadoutService = {
  async getAll(): Promise<Loadout[]> {
    const userId = await currentUserId()
    if (userId) {
      // RLS scopes the select to the caller's rows; the index backs this order.
      const { data, error } = await supabase
        .from('saved_loadouts')
        .select(SB_COLUMNS)
        .order('created_at', { ascending: false })
      if (error || !data) return []
      return (data as unknown as LoadoutRow[]).map(rowToLoadout)
    }

    const db = await getDb()
    const active = await activeStored(db)
    return active
      .map(toLoadout)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  async get(id: string): Promise<Loadout | undefined> {
    const userId = await currentUserId()
    if (userId) {
      const { data, error } = await supabase
        .from('saved_loadouts')
        .select(SB_COLUMNS)
        .eq('id', id)
        .maybeSingle()
      if (error || !data) return undefined
      return rowToLoadout(data as unknown as LoadoutRow)
    }

    const db = await getDb()
    const stored = (await db.get(STORE, id)) as StoredLoadout | undefined
    if (!stored || stored.deleted) return undefined
    return toLoadout(stored)
  },

  async save(loadout: Loadout): Promise<{ saved: boolean; nearLimit: boolean }> {
    const userId = await currentUserId()
    if (userId) {
      const { error } = await supabase
        .from('saved_loadouts')
        .insert(loadoutToRow(loadout, userId))
      // Server-side 50-row cap rejects the insert; surface as "not saved" so the
      // UI shows its storage-full state (same as the local cap path below).
      if (error?.code === CAP_VIOLATION_CODE) return { saved: false, nearLimit: false }
      // Merge 2 will treat other failures (offline) as a queued unsynced write.
      // For the merge-1 online path, any other error is a failed save.
      if (error) return { saved: false, nearLimit: false }
      const { count } = await supabase
        .from('saved_loadouts')
        .select('id', { count: 'exact', head: true })
      return { saved: true, nearLimit: (count ?? 0) >= WARN_AT }
    }

    const db = await getDb()
    const count = (await activeStored(db)).length
    if (count >= MAX_LOADOUTS) return { saved: false, nearLimit: false }
    // Signed-out / local writes carry the default sync metadata. Phase 4 sets
    // `unsynced: true` here when a signed-in user is offline.
    const stored: StoredLoadout = { ...SYNC_DEFAULTS, ...loadout }
    await db.put(STORE, stored)
    return { saved: true, nearLimit: count + 1 >= WARN_AT }
  },

  async delete(id: string): Promise<void> {
    const userId = await currentUserId()
    if (userId) {
      // Merge 2 adds offline tombstoning (PRD §13.5); merge 1 deletes directly.
      await supabase.from('saved_loadouts').delete().eq('id', id)
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
    }

    // Always clear the local store too, so signing out leaves nothing behind.
    const db = await getDb()
    await db.clear(STORE)
  },

  async count(): Promise<number> {
    const userId = await currentUserId()
    if (userId) {
      const { count } = await supabase
        .from('saved_loadouts')
        .select('id', { count: 'exact', head: true })
      return count ?? 0
    }

    const db = await getDb()
    return (await activeStored(db)).length
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
