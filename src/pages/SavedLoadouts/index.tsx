import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { loadoutService } from '@/services/loadouts'
import { catalogService } from '@/services/catalog'
import type { Loadout } from '@/types'
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
}

function LoadoutCard({ loadout, onDelete }: CardProps) {
  const stale = checkStale(loadout)
  const weapons = [loadout.primaryWeapon, loadout.secondaryWeapon, loadout.grenade].map(resolveName)
  const stratagems = loadout.stratagems.map(resolveName)
  const gear = [loadout.armor, loadout.booster].map(resolveName)

  return (
    <div className={`${styles.card} ${stale ? styles.cardStale : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardMeta}>
          <span className={styles.cardContext}>{contextLabel(loadout)}</span>
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
    </div>
  )
}

// ---- Main Component ----

export default function SavedLoadouts() {
  const navigate = useNavigate()
  const [loadouts, setLoadouts] = useState<Loadout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadoutService.getAll().then(data => {
      setLoadouts(data)
      setLoading(false)
    })
  }, [])

  async function handleDelete(id: string) {
    await loadoutService.delete(id)
    setLoadouts(prev => prev.filter(l => l.id !== id))
  }

  return (
    <div className={styles.page}>
      <img src="/hd2-logo.svg" alt="Helldivers 2" className={styles.gameLogo} />
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
            <LoadoutCard key={l.id} loadout={l} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
