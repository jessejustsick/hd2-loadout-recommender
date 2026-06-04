import { openDB, type IDBPDatabase } from 'idb'
import type { Loadout } from '@/types'

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

export const loadoutService = {
  async getAll(): Promise<Loadout[]> {
    const db = await getDb()
    const active = await activeStored(db)
    return active
      .map(toLoadout)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  async get(id: string): Promise<Loadout | undefined> {
    const db = await getDb()
    const stored = (await db.get(STORE, id)) as StoredLoadout | undefined
    if (!stored || stored.deleted) return undefined
    return toLoadout(stored)
  },

  async save(loadout: Loadout): Promise<{ saved: boolean; nearLimit: boolean }> {
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
    const db = await getDb()
    // Phase 0 keeps v1 behavior: a hard delete. Phase 4 introduces tombstoning
    // (`deleted: true`) for offline signed-in deletes per PRD §13.5.
    await db.delete(STORE, id)
  },

  async deleteAll(): Promise<void> {
    const db = await getDb()
    await db.clear(STORE)
  },

  async count(): Promise<number> {
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
