import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crosshair, Target, Bomb, Shield, Zap, ChevronDown, RefreshCw, Download } from 'lucide-react'
import { generateConstrained, generateFullRandom } from '@/engine'
import { catalogService } from '@/services/catalog'
import { loadoutService } from '@/services/loadouts'
import { exportLoadout } from '@/lib/exportLoadout'
import { useSettings } from '@/context/SettingsContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import type { LoadoutResult, Weapon, Stratagem, Armor, Booster, Loadout } from '@/types'
import { stratagemIconUrl } from '@/lib/stratagemIcons'
import styles from './Randomizer.module.css'

// ---- Types ----

type SafetyMode = 'on' | 'off'

type SlotKey =
  | 'primary' | 'secondary' | 'grenade'
  | 'stratagem-0' | 'stratagem-1' | 'stratagem-2' | 'stratagem-3'
  | 'armor' | 'booster'

type AnyItem = Weapon | Stratagem | Armor | Booster

interface SwapSheetState {
  slotKey: SlotKey
  label: string
  alternatives: AnyItem[]
}

// ---- Constants ----

const SLOT_LABELS: Record<SlotKey, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  grenade: 'Grenade',
  'stratagem-0': 'Stratagem 1',
  'stratagem-1': 'Stratagem 2',
  'stratagem-2': 'Stratagem 3',
  'stratagem-3': 'Stratagem 4',
  armor: 'Armor',
  booster: 'Booster',
}

const TAG_LABELS: Record<string, string> = {
  'crowd-control': 'crowd control',
  'anti-swarm': 'anti-swarm',
  'area-denial': 'area denial',
  'anti-armor': 'anti-armor',
  'anti-tank': 'anti-tank',
  'explosive': 'explosive',
  'precision': 'precision',
  'anti-shield': 'shield-bypass',
  'energy': 'energy',
  'versatile': 'versatile',
  'support': 'support',
  'resupply': 'resupply',
  'mobility': 'mobility',
  'stun': 'stun',
  'smoke': 'smoke',
  'utility': 'utility',
}

// ---- Helpers ----

function getSlotItem(loadout: LoadoutResult, key: SlotKey): AnyItem | null {
  if (key === 'primary') return loadout.primaryWeapon
  if (key === 'secondary') return loadout.secondaryWeapon
  if (key === 'grenade') return loadout.grenade
  if (key === 'armor') return loadout.armor
  if (key === 'booster') return loadout.booster
  return loadout.stratagems[parseInt(key.split('-')[1])] ?? null
}

function describeItem(item: AnyItem): string {
  if ('passive' in item) {
    const tier = item.armorTier === 'heavy' ? 'Heavy armor' : item.armorTier === 'medium' ? 'Medium armor' : 'Light armor'
    return `${tier}. Passive: ${item.passive}.`
  }
  if ('effect' in item) return item.effect
  if ('cooldownTier' in item) {
    const fam = item.family.replace(/[-_]/g, ' ')
    const cd = { short: 'Short cooldown.', medium: 'Medium cooldown.', long: 'Long cooldown — use decisively.' }[item.cooldownTier]
    return `${fam.charAt(0).toUpperCase() + fam.slice(1)}. ${cd}`
  }
  return item.tags.map(t => TAG_LABELS[t] ?? t).join(', ') || '—'
}

function getRandomAlts(slotKey: SlotKey, excludeIds: string[], count = 3, hidePaid = false): AnyItem[] {
  let pool: AnyItem[]
  if (slotKey === 'primary' || slotKey === 'secondary' || slotKey === 'grenade') {
    pool = catalogService.getWeapons(slotKey)
  } else if (slotKey.startsWith('stratagem')) {
    pool = catalogService.getStratagems()
  } else if (slotKey === 'armor') {
    pool = catalogService.getArmor()
  } else {
    pool = catalogService.getBoosters()
  }
  return pool
    .filter(item => !excludeIds.includes(item.id))
    .filter(item => !hidePaid || !item.is_paid)
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
}

// Both modes honor the paid filter (PRD §7.1 deviation — Safety Off would be
// pointless for a player who opted out of paid items; see engine EngineOptions).
function generateLoadout(safety: SafetyMode, hidePaidItems: boolean): LoadoutResult {
  return safety === 'on' ? generateConstrained({ hidePaidItems }) : generateFullRandom({ hidePaidItems })
}

// ---- Icon sub-components ----

function StratagemIcon({ iconRef }: { iconRef: string }) {
  const url = stratagemIconUrl(iconRef)
  if (!url) return null
  return <img src={url} alt="" className={styles.stratagemIcon} />
}

function SlotIcon({ slotKey }: { slotKey: SlotKey }) {
  const map: Partial<Record<SlotKey, React.ReactNode>> = {
    primary: <Crosshair size={20} />,
    secondary: <Target size={20} />,
    grenade: <Bomb size={20} />,
    armor: <Shield size={20} />,
    booster: <Zap size={20} />,
  }
  const icon = slotKey.startsWith('stratagem') ? <Zap size={20} /> : (map[slotKey] ?? null)
  return <span className={styles.genericIcon}>{icon}</span>
}

function ItemIcon({ item, slotKey }: { item: AnyItem | null; slotKey: SlotKey }) {
  if (item && 'iconRef' in item && (item as Stratagem).iconRef && slotKey.startsWith('stratagem')) {
    return (
      <div className={styles.iconWrap}>
        <StratagemIcon iconRef={(item as Stratagem).iconRef} />
      </div>
    )
  }
  return <div className={styles.iconWrap}><SlotIcon slotKey={slotKey} /></div>
}

// ---- LoadoutRow ----

interface RowProps {
  slotKey: SlotKey
  item: AnyItem | null
  isOpen: boolean
  onToggle: () => void
  onSwap: () => void
}

function LoadoutRow({ slotKey, item, isOpen, onToggle, onSwap }: RowProps) {
  const label = SLOT_LABELS[slotKey]
  const tags = item?.tags.slice(0, 3) ?? []

  return (
    <div className={styles.row}>
      <div className={styles.rowTop}>
        <ItemIcon item={item} slotKey={slotKey} />
        <div className={styles.rowMain}>
          <span className={styles.rowSlotLabel}>{label}</span>
          <span className={styles.rowName}>{item?.name ?? '—'}</span>
          {tags.length > 0 && (
            <div className={styles.rowTags}>
              {tags.map(t => (
                <span key={t} className={styles.tag}>{TAG_LABELS[t] ?? t}</span>
              ))}
            </div>
          )}
        </div>
        <div className={styles.rowActions}>
          <button className={styles.swapBtn} onClick={onSwap} aria-label={`Swap ${label}`}>
            <RefreshCw size={15} />
          </button>
          {item && (
            <button
              className={`${styles.infoBtn} ${isOpen ? styles.infoBtnOpen : ''}`}
              onClick={onToggle}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? 'Close' : 'Show'} info for ${label}`}
            >
              <ChevronDown size={16} />
            </button>
          )}
        </div>
      </div>
      {isOpen && item && (
        <div className={styles.accordion}>
          <p className={styles.rationale}>{describeItem(item)}</p>
        </div>
      )}
    </div>
  )
}

// ---- SwapSheet ----

interface SwapSheetProps {
  sheet: SwapSheetState
  onPick: (item: AnyItem) => void
  onClose: () => void
}

function SwapSheet({ sheet, onPick, onClose }: SwapSheetProps) {
  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-label={`Swap ${sheet.label}`}>
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <span className={styles.sheetTitle}>Swap {sheet.label}</span>
          <button className={styles.sheetClose} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.sheetAlts}>
          {sheet.alternatives.length === 0 && (
            <p className={styles.sheetEmpty}>No alternatives available.</p>
          )}
          {sheet.alternatives.map(alt => (
            <button key={alt.id} className={styles.sheetAlt} onClick={() => onPick(alt)}>
              <div className={styles.sheetAltIcon}>
                {sheet.slotKey.startsWith('stratagem') && 'iconRef' in alt && (alt as Stratagem).iconRef
                  ? <StratagemIcon iconRef={(alt as Stratagem).iconRef} />
                  : <SlotIcon slotKey={sheet.slotKey} />
                }
              </div>
              <div className={styles.sheetAltMain}>
                <span className={styles.sheetAltName}>{alt.name}</span>
                <div className={styles.rowTags}>
                  {alt.tags.slice(0, 3).map(t => (
                    <span key={t} className={styles.tag}>{TAG_LABELS[t] ?? t}</span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ---- Main Component ----

export default function Randomizer() {
  const navigate = useNavigate()
  const { hidePaidItems } = useSettings()
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [safety, setSafety] = useState<SafetyMode>('on')
  const [loadout, setLoadout] = useState<LoadoutResult>(() => generateConstrained({ hidePaidItems }))
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set())
  const [swapSheet, setSwapSheet] = useState<SwapSheetState | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'full'>('idle')
  const [exporting, setExporting] = useState(false)

  function handleSafetyChange(mode: SafetyMode) {
    if (mode === safety) return
    setSafety(mode)
    setLoadout(generateLoadout(mode, hidePaidItems))
    setOpenAccordions(new Set())
    setSaveState('idle')
    setSwapSheet(null)
  }

  function handleReroll() {
    setLoadout(generateLoadout(safety, hidePaidItems))
    setOpenAccordions(new Set())
    setSaveState('idle')
  }

  function toggleAccordion(key: string) {
    setOpenAccordions(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleOpenSwap(slotKey: SlotKey) {
    const currentItem = getSlotItem(loadout, slotKey)
    const excludeIds: string[] = []
    if (slotKey.startsWith('stratagem')) {
      for (let i = 0; i < 4; i++) {
        const s = loadout.stratagems[i]
        if (s) excludeIds.push(s.id)
      }
    } else if (currentItem) {
      excludeIds.push(currentItem.id)
    }
    const alternatives = getRandomAlts(slotKey, excludeIds, 3, hidePaidItems)
    setSwapSheet({ slotKey, label: SLOT_LABELS[slotKey], alternatives })
  }

  function handlePickSwap(item: AnyItem) {
    if (!swapSheet) return
    const { slotKey } = swapSheet
    setLoadout(prev => {
      const next = { ...prev }
      if (slotKey === 'primary') next.primaryWeapon = item as Weapon
      else if (slotKey === 'secondary') next.secondaryWeapon = item as Weapon
      else if (slotKey === 'grenade') next.grenade = item as Weapon
      else if (slotKey === 'armor') next.armor = item as Armor
      else if (slotKey === 'booster') next.booster = item as Booster
      else {
        const idx = parseInt(slotKey.split('-')[1])
        const strats = [...prev.stratagems] as (Stratagem | null)[]
        strats[idx] = item as Stratagem
        next.stratagems = strats as LoadoutResult['stratagems']
      }
      return next
    })
    setSaveState('idle')
    setSwapSheet(null)
  }

  async function handleSave() {
    if (saveState !== 'idle') return
    const { primaryWeapon, secondaryWeapon, grenade, stratagems, armor, booster } = loadout
    if (!primaryWeapon || !secondaryWeapon || !grenade || !armor || !booster) return

    const record: Loadout = {
      id: crypto.randomUUID(),
      primaryWeapon: primaryWeapon.id,
      secondaryWeapon: secondaryWeapon.id,
      grenade: grenade.id,
      stratagems: stratagems.filter(Boolean).map(s => s!.id),
      armor: armor.id,
      booster: booster.id,
      generationMode: safety === 'on' ? 'constrained_random' : 'full_random',
      noPaidItems: hidePaidItems,
      createdAt: new Date().toISOString(),
    }

    try {
      const { saved } = await loadoutService.save(record)
      if (saved) {
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 2000)
      } else {
        setSaveState('full')
      }
    } catch {
      // ignore — save failures are non-critical
    }
  }

  async function handleExport() {
    if (exporting) return
    const { primaryWeapon, secondaryWeapon, grenade, armor, booster } = loadout
    if (!primaryWeapon || !secondaryWeapon || !grenade || !armor || !booster) return
    setExporting(true)
    const result = await exportLoadout({
      context: safety === 'on' ? 'Random — Safety On' : 'Random — Safety Off',
      displayName: profile?.displayName,
      shipName: profile?.shipName,
      playerTitle: profile?.playerTitle,
      timestamp: new Date().toISOString(),
      loadout,
    })
    setExporting(false)
    if (result === 'error') showToast("Couldn't create the image — please try again.")
  }

  const weaponSlots: SlotKey[] = ['primary', 'secondary', 'grenade']
  const stratagemSlots: SlotKey[] = ['stratagem-0', 'stratagem-1', 'stratagem-2', 'stratagem-3']

  function renderRow(key: SlotKey) {
    return (
      <LoadoutRow
        key={key}
        slotKey={key}
        item={getSlotItem(loadout, key)}
        isOpen={openAccordions.has(key)}
        onToggle={() => toggleAccordion(key)}
        onSwap={() => handleOpenSwap(key)}
      />
    )
  }

  return (
    <div className={styles.page}>
      <img src="/hd2-logo.svg" alt="Hellpod Companion" className={styles.gameLogo} />
      <h1 className={styles.title}>Random Loadout</h1>

      <div className={styles.toggleGroup}>
        <button
          className={`${styles.toggleBtn} ${safety === 'on' ? styles.toggleBtnActive : ''}`}
          onClick={() => handleSafetyChange('on')}
        >
          Safety On
        </button>
        <button
          className={`${styles.toggleBtn} ${safety === 'off' ? styles.toggleBtnActive : ''}`}
          onClick={() => handleSafetyChange('off')}
        >
          Safety Off
        </button>
      </div>
      <p className={styles.modeDesc}>
        {safety === 'on' ? 'Balanced — avoids duplicate stratagem roles.' : 'True random — anything goes.'}
      </p>

      {hidePaidItems && (
        <div className={styles.paidBanner}>
          Paid items hidden ·{' '}
          <button type="button" className={styles.paidBannerLink} onClick={() => navigate('/settings')}>
            Change in Settings
          </button>
        </div>
      )}

      <div className={styles.section}>
        <p className={styles.sectionLabel}>Armor</p>
        {renderRow('armor')}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>Weapons</p>
        {weaponSlots.map(renderRow)}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>Stratagems</p>
        {stratagemSlots.map(renderRow)}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>Booster</p>
        {renderRow('booster')}
      </div>

      <div className={styles.actionBar}>
        <button
          className={`${styles.saveBtn} ${saveState === 'saved' ? styles.saveBtnSaved : ''}`}
          onClick={handleSave}
          disabled={saveState !== 'idle'}
        >
          {saveState === 'saved' ? 'Saved!' : saveState === 'full' ? 'Limit reached (50)' : 'Save Loadout'}
        </button>
        <button
          className={styles.exportBtn}
          onClick={handleExport}
          disabled={exporting}
          aria-label="Export loadout as image"
        >
          <Download size={16} />
          <span className={styles.exportLabel}>{exporting ? 'Exporting…' : 'Export'}</span>
        </button>
        <button className={styles.rerollBtn} onClick={handleReroll}>
          Re-roll
        </button>
      </div>

      {swapSheet && (
        <SwapSheet
          sheet={swapSheet}
          onPick={handlePickSwap}
          onClose={() => setSwapSheet(null)}
        />
      )}
    </div>
  )
}
