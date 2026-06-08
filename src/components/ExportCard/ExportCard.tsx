import type { LoadoutResult } from '@/types'
import styles from './ExportCard.module.css'

// Off-screen share card (PRD §8), styled to mirror the Saved Loadouts card
// (text-based Weapons / Stratagems / Gear groups) plus ship name + player title
// and branding. Text-only by design: no per-item icons (matches saved cards and
// rasterizes reliably in html2canvas). Rendered detached, captured, removed.

export interface ExportCardInput {
  context: string // "Automatons · D8 · Heeth · elimination" or "Random Loadout — Safety On"
  modifiers?: string[] // operation modifier names (chips)
  displayName?: string | null
  shipName?: string | null
  playerTitle?: string | null
  timestamp: string // ISO; rendered as a date
  loadout: LoadoutResult
}

function names(items: (LoadoutResult['armor'] | LoadoutResult['stratagems'][number])[]): string {
  return items.filter(Boolean).map(i => i!.name).join(' · ') || '—'
}

export default function ExportCard({ input }: { input: ExportCardInput }) {
  const { loadout } = input
  const date = new Date(input.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  const hasIdentity = Boolean(input.displayName || input.shipName || input.playerTitle)

  const armor = names([loadout.armor])
  const weapons = names([loadout.primaryWeapon, loadout.secondaryWeapon, loadout.grenade])
  const stratagems = names(loadout.stratagems)
  const booster = names([loadout.booster])

  return (
    <div className={styles.frame}>
      <div className={styles.brandTop}>HELLPOD COMPANION</div>

      {hasIdentity && (
        <div className={styles.identity}>
          {input.playerTitle && <span className={styles.playerTitle}>{input.playerTitle}</span>}
          {input.displayName && <span className={styles.displayName}>{input.displayName}</span>}
          {input.shipName && <span className={styles.shipName}>{input.shipName}</span>}
        </div>
      )}

      {/* Saved-card-style body */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardContext}>{input.context}</span>
          {input.modifiers && input.modifiers.length > 0 && (
            <div className={styles.cardModifiers}>
              {input.modifiers.map(m => <span key={m} className={styles.cardModifierChip}>{m}</span>)}
            </div>
          )}
        </div>

        <div className={styles.cardBody}>
          <div className={styles.itemGroup}>
            <span className={styles.groupLabel}>Armor</span>
            <span className={styles.itemList}>{armor}</span>
          </div>
          <div className={styles.itemGroup}>
            <span className={styles.groupLabel}>Weapons</span>
            <span className={styles.itemList}>{weapons}</span>
          </div>
          <div className={styles.itemGroup}>
            <span className={styles.groupLabel}>Stratagems</span>
            <span className={styles.itemList}>{stratagems}</span>
          </div>
          <div className={styles.itemGroup}>
            <span className={styles.groupLabel}>Booster</span>
            <span className={styles.itemList}>{booster}</span>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.brandUrl}>hellpodcompanion.app</span>
        <span className={styles.timestamp}>{date}</span>
      </div>
    </div>
  )
}
