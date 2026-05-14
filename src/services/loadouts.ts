import { openDB, type IDBPDatabase } from 'idb'
import type { Loadout } from '@/types'

const DB_NAME = 'hd2-loadout'
const DB_VERSION = 1
const STORE = 'loadouts'

export const MAX_LOADOUTS = 50
export const WARN_AT = 45

let _db: IDBPDatabase | null = null

async function getDb(): Promise<IDBPDatabase> {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      },
    })
  }
  return _db
}

export const loadoutService = {
  async getAll(): Promise<Loadout[]> {
    const db = await getDb()
    const all = (await db.getAll(STORE)) as Loadout[]
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  async get(id: string): Promise<Loadout | undefined> {
    const db = await getDb()
    return (await db.get(STORE, id)) as Loadout | undefined
  },

  async save(loadout: Loadout): Promise<{ saved: boolean; nearLimit: boolean }> {
    const db = await getDb()
    const count = await db.count(STORE)
    if (count >= MAX_LOADOUTS) return { saved: false, nearLimit: false }
    await db.put(STORE, loadout)
    return { saved: true, nearLimit: count + 1 >= WARN_AT }
  },

  async delete(id: string): Promise<void> {
    const db = await getDb()
    await db.delete(STORE, id)
  },

  async deleteAll(): Promise<void> {
    const db = await getDb()
    await db.clear(STORE)
  },

  async count(): Promise<number> {
    const db = await getDb()
    return db.count(STORE)
  },
}
