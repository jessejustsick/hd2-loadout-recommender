import { useCallback, useEffect, useState } from 'react'
import { Trash2, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { loadoutService } from '@/services/loadouts'
import { onConnectivityChange } from '@/services/connectivity'
import { catalogService } from '@/services/catalog'
import type { Loadout, MissionParams } from '@/types'
import styles from './SavedLoadouts.module.css'

// ---- Helpers ----

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function resolveName(id: string): string {
  return catalogService.getItemById(id)?.name ?? id
}

function resolveModifierNames(ids: string[]): string[] {
  const all = catalogService.getModifiers()
  return ids
    .map(id => all.find(m => m.id === id)?.name)
    .filter((n): n is string => Boolean(n))
}

function checkStale(loadout: Loadout): boolean {
  return [
    loadout.primaryWeapon,
    loadout.secondaryWeapon,
    loadout.grenade,
    ...loadout.stratagems,
    loadout.armor,
    loadout.booster,
  ].some(id => catalogService.getItemById(id) === null)
}

function contextLabel(loadout: Loadout): string {
  if (loadout.faction) {
    return [
      loadout.faction.charAt(0).toUpperCase() + loadout.faction.slice(1),
      loadout.difficulty != null ? `D${loadout.difficulty}` : null,
      loadout.planet && loadout.planet !== '__manual' ? loadout.planet : null,
      loadout.missionType ?? null,
    ].filter(Boolean).join(' · ')
  }
  return loadout.generationMode === 'constrained_random' ? 'Random — Safety On' : 'Random — Safety Off'
}

// ---- LoadoutCard ----

interface CardProps {
  loadout: Loadout
  onDelete: (id: string) => void
  onReoptimize: (loadout: Loadout) => void
}

function LoadoutCard({ loadout, onDelete, onReoptimize }: CardProps) {
  const stale = checkStale(loadout)
  const weapons = [loadout.primaryWeapon, loadout.secondaryWeapon, loadout.grenade].map(resolveName)
  const stratagems = loadout.stratagems.map(resolveName)
  const gear = [loadout.armor, loadout.booster].map(resolveName)
  const modifiers = loadout.modifiers ? resolveModifierNames(loadout.modifiers) : []
  // Only recommended loadouts carry the mission context needed to regenerate.
  const canReoptimize = loadout.faction != null && loadout.difficulty != null

  return (
    <div className={`${styles.card} ${stale ? styles.cardStale : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardMeta}>
          <span className={styles.cardContext}>{contextLabel(loadout)}</span>
          {modifiers.length > 0 && (
            <div className={styles.cardModifiers}>
              {modifiers.map(name => (
                <span key={name} className={styles.cardModifierChip}>{name}</span>
              ))}
            </div>
          )}
          <span className={styles.cardTime}>{timeAgo(loadout.createdAt)}</span>
        </div>
        <button
          className={styles.deleteBtn}
          onClick={() => onDelete(loadout.id)}
          aria-label="Delete loadout"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {stale && (
        <p className={styles.staleWarning}>Some items in this loadout are no longer available.</p>
      )}

      <div className={styles.cardBody}>
        <div className={styles.itemGroup}>
          <span className={styles.groupLabel}>Weapons</span>
          <span className={styles.itemList}>{weapons.join(' · ')}</span>
        </div>
        <div className={styles.itemGroup}>
          <span className={styles.groupLabel}>Stratagems</span>
          <span className={styles.itemList}>{stratagems.join(' · ')}</span>
        </div>
        <div className={styles.itemGroup}>
          <span className={styles.groupLabel}>Gear</span>
          <span className={styles.itemList}>{gear.join(' · ')}</span>
        </div>
      </div>

      {canReoptimize && (
        <div className={styles.cardFooter}>
          <button className={styles.reoptimizeBtn} onClick={() => onReoptimize(loadout)}>
            <RefreshCw size={14} />
            Re-optimize
          </button>
        </div>
      )}
    </div>
  )
}

// ---- Main Component ----

export default function SavedLoadouts() {
  const navigate = useNavigate()
  const [loadouts, setLoadouts] = useState<Loadout[]>([])
  const [loading, setLoading] = useState(true)

  // `silent` refreshes update the list in place without flashing the skeleton —
  // used by the fetch-on-focus path so a background sync isn't visually jarring.
  // Pull from the server (no-op when signed out/offline) before reading, so the
  // cache reflects other devices' changes per PRD §13.2.
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    await loadoutService.refresh()
    const data = await loadoutService.getAll()
    setLoadouts(data)
    setLoading(false)
  }, [])

  // Initial load (skeleton). Mounting already covers "tab opened from app launch
  // or navigated to" per PRD §13.2.
  useEffect(() => {
    refresh()
  }, [refresh])

  // Fetch-on-focus (PRD §13.2): re-fetch from the source of truth when the tab
  // regains focus after being backgrounded, so a loadout saved on another device
  // appears without a manual reload. Silent so it doesn't flash the skeleton.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') refresh(true)
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  // When connectivity returns while this screen is open, refresh so queued
  // writes that just synced (and any server-side changes) show up (PRD §13.4).
  useEffect(() => {
    return onConnectivityChange(online => {
      if (online) refresh(true)
    })
  }, [refresh])

  async function handleDelete(id: string) {
    await loadoutService.delete(id)
    setLoadouts(prev => prev.filter(l => l.id !== id))
  }

  function handleReoptimize(loadout: Loadout) {
    if (loadout.faction == null || loadout.difficulty == null) return
    // Round-trip the saved mission context so the fresh recommendation uses the
    // exact same scoring inputs as the original. Non-destructive: opens a new
    // result the user can save separately; the saved loadout is untouched.
    const params: MissionParams = {
      faction: loadout.faction,
      difficulty: loadout.difficulty,
      planet: loadout.planet ?? '__manual',
      missionType: loadout.missionType ?? '',
      modifiers: loadout.modifiers ?? [],
    }
    navigate('/recommend/results', { state: { params } })
  }

  return (
    <div className={styles.page}>
      <img src="/hd2-logo.svg" alt="Hellpod Companion" className={styles.gameLogo} />
      <div className={styles.header}>
        <h1 className={styles.title}>Saved Loadouts</h1>
        {!loading && loadouts.length > 0 && (
          <span className={styles.count}>{loadouts.length} / 50</span>
        )}
      </div>

      {loading && (
        <div className={styles.skeletonList}>
          {[0, 1, 2].map(i => <div key={i} className={styles.skeletonCard} />)}
        </div>
      )}

      {!loading && loadouts.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No loadouts have been saved yet.</p>
          <div className={styles.emptyCtas}>
            <button className={styles.emptyCtaPrimary} onClick={() => navigate('/recommend')}>
              Generate a recommended loadout
            </button>
            <button className={styles.emptyCtaSecondary} onClick={() => navigate('/randomizer')}>
              Generate a random loadout
            </button>
          </div>
        </div>
      )}

      {!loading && loadouts.length > 0 && (
        <div className={styles.list}>
          {loadouts.map(l => (
            <LoadoutCard key={l.id} loadout={l} onDelete={handleDelete} onReoptimize={handleReoptimize} />
          ))}
        </div>
      )}
    </div>
  )
}
