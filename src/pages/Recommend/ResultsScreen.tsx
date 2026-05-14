import { useState, useEffect } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Crosshair, Target, Bomb, Shield, Zap, ChevronDown, RefreshCw } from 'lucide-react'
import { generateRecommendation, getAlternatives } from '@/engine'
import { loadoutService } from '@/services/loadouts'
import type {
  MissionParams, LoadoutResult, Weapon, Stratagem, Armor, Booster, FactionId, Loadout,
} from '@/types'
import { stratagemIconUrl } from '@/lib/stratagemIcons'
import styles from './ResultsScreen.module.css'

// ---- Types ----

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

interface LocationState {
  params: MissionParams
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

const EMPTY_LOADOUT: LoadoutResult = {
  primaryWeapon: null,
  secondaryWeapon: null,
  grenade: null,
  stratagems: [null, null, null, null],
  armor: null,
  booster: null,
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

function diffLoadouts(prev: LoadoutResult, next: LoadoutResult): Set<string> {
  const keys: SlotKey[] = ['primary', 'secondary', 'grenade', 'stratagem-0', 'stratagem-1', 'stratagem-2', 'stratagem-3', 'armor', 'booster']
  const changed = new Set<string>()
  for (const key of keys) {
    const prevItem = getSlotItem(prev, key)
    const nextItem = getSlotItem(next, key)
    if (prevItem?.id !== nextItem?.id && nextItem) changed.add(nextItem.id)
  }
  return changed
}

// ---- Rationale ----

const FACTION_STRENGTHS: Record<FactionId, string[]> = {
  terminids: ['crowd-control', 'anti-swarm', 'area-denial'],
  automatons: ['anti-armor', 'anti-tank', 'explosive', 'precision'],
  illuminate: ['anti-shield', 'energy', 'crowd-control'],
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

function makeRationale(item: AnyItem, params: MissionParams): string {
  if ('passive' in item) {
    const tier = item.armorTier === 'heavy' ? 'Maximum protection' : item.armorTier === 'medium' ? 'Balanced protection' : 'High mobility'
    return `${tier}. Passive: ${item.passive}.`
  }
  if ('effect' in item) {
    return item.effect
  }

  const reasons: string[] = []
  const strengths = FACTION_STRENGTHS[params.faction]
  const matching = item.tags.filter(t => strengths.includes(t))
  if (matching.length > 0) {
    const factionName = params.faction.charAt(0).toUpperCase() + params.faction.slice(1)
    reasons.push(`Effective vs ${factionName}: ${matching.map(t => TAG_LABELS[t] ?? t).join(', ')}.`)
  }
  if (params.difficulty >= 7 && (item.tags.includes('anti-armor') || item.tags.includes('anti-tank'))) {
    reasons.push('Anti-armor essential at this difficulty.')
  }
  if (item.tags.includes('versatile')) {
    reasons.push('Handles multiple threat types.')
  }
  if ('cooldownTier' in item) {
    const cdText = { short: 'Short cooldown — redeploy often.', medium: 'Medium cooldown.', long: 'Long cooldown — use decisively.' }
    reasons.push(cdText[item.cooldownTier])
  }
  return reasons.length > 0 ? reasons.join(' ') : 'Solid choice for this configuration.'
}

// ---- Icon components ----

function StratagemIcon({ iconRef }: { iconRef: string }) {
  const url = stratagemIconUrl(iconRef)
  if (!url) return null
  return <img src={url} alt="" className={styles.stratagemIcon} />
}

function SlotIcon({ slotKey }: { slotKey: SlotKey }) {
  if (slotKey.startsWith('stratagem')) {
    return <span className={styles.genericIcon}><Zap size={20} /></span>
  }
  const map: Partial<Record<SlotKey, React.ReactNode>> = {
    primary: <Crosshair size={20} />,
    secondary: <Target size={20} />,
    grenade: <Bomb size={20} />,
    armor: <Shield size={20} />,
    booster: <Zap size={20} />,
  }
  return <span className={styles.genericIcon}>{map[slotKey] ?? null}</span>
}

function ItemIcon({ item, slotKey }: { item: AnyItem | null; slotKey: SlotKey }) {
  if (item && 'iconRef' in item && item.iconRef && slotKey.startsWith('stratagem')) {
    return (
      <div className={styles.iconWrap}>
        <StratagemIcon iconRef={item.iconRef} />
      </div>
    )
  }
  return (
    <div className={styles.iconWrap}>
      <SlotIcon slotKey={slotKey} />
    </div>
  )
}

// ---- LoadoutRow ----

interface RowProps {
  slotKey: SlotKey
  item: AnyItem | null
  isNew: boolean
  isOpen: boolean
  params: MissionParams
  onToggle: () => void
  onSwap: () => void
}

function LoadoutRow({ slotKey, item, isNew, isOpen, params, onToggle, onSwap }: RowProps) {
  const label = SLOT_LABELS[slotKey]
  const tags = item?.tags.slice(0, 3) ?? []

  return (
    <div className={`${styles.row} ${isNew ? styles.rowNew : ''}`}>
      <div className={styles.rowTop}>
        <ItemIcon item={item} slotKey={slotKey} />

        <div className={styles.rowMain}>
          <span className={styles.rowSlotLabel}>{label}</span>
          <div className={styles.rowNameRow}>
            <span className={styles.rowName}>{item?.name ?? '—'}</span>
            {isNew && <span className={styles.newPill}>NEW</span>}
          </div>
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
          <button
            className={`${styles.infoBtn} ${isOpen ? styles.infoBtnOpen : ''}`}
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Close' : 'Show'} rationale for ${label}`}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {isOpen && item && (
        <div className={styles.accordion}>
          <p className={styles.rationale}>{makeRationale(item, params)}</p>
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
                {sheet.slotKey.startsWith('stratagem') && 'iconRef' in alt && alt.iconRef
                  ? <StratagemIcon iconRef={alt.iconRef} />
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

export default function ResultsScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const maybeParams = (location.state as LocationState | null)?.params ?? null

  const [loadout, setLoadout] = useState<LoadoutResult>(() =>
    maybeParams ? generateRecommendation(maybeParams) : EMPTY_LOADOUT
  )
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set())
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set())
  const [swapSheet, setSwapSheet] = useState<SwapSheetState | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'full'>('idle')

  useEffect(() => { window.scrollTo(0, 0) }, [])

  if (!maybeParams) return <Navigate to="/recommend" replace />
  const params: MissionParams = maybeParams

  const missionSummary = [
    params.faction.charAt(0).toUpperCase() + params.faction.slice(1),
    params.planet === '__manual' ? 'Manual' : params.planet,
    `Difficulty ${params.difficulty}`,
    params.missionType,
  ].join(' · ')

  // ---- Handlers ----

  function toggleAccordion(key: string) {
    setOpenAccordions(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleReroll() {
    const next = generateRecommendation(params)
    setNewItemIds(diffLoadouts(loadout, next))
    setLoadout(next)
    setOpenAccordions(new Set())
    setSaveState('idle')
  }

  function handleOpenSwap(slotKey: SlotKey) {
    const currentItem = getSlotItem(loadout, slotKey)
    const excludeIds: string[] = []

    // For stratagems, exclude all 4 currently selected
    if (slotKey.startsWith('stratagem')) {
      for (let i = 0; i < 4; i++) {
        const s = loadout.stratagems[i]
        if (s) excludeIds.push(s.id)
      }
    } else if (currentItem) {
      excludeIds.push(currentItem.id)
    }

    const slot = slotKey.startsWith('stratagem') ? 'stratagem'
      : slotKey as 'primary' | 'secondary' | 'grenade' | 'armor' | 'booster'

    const alternatives = getAlternatives(slot, excludeIds, params, 3)
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

    setNewItemIds(prev => new Set([...prev, item.id]))
    setSwapSheet(null)
    setSaveState('idle')
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
      faction: params.faction,
      planet: params.planet,
      difficulty: params.difficulty,
      missionType: params.missionType,
      generationMode: 'recommended',
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

  // ---- Render ----

  const weaponSlots: SlotKey[] = ['primary', 'secondary', 'grenade']
  const stratagemSlots: SlotKey[] = ['stratagem-0', 'stratagem-1', 'stratagem-2', 'stratagem-3']
  const gearSlots: SlotKey[] = ['armor', 'booster']

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)}>← Back</button>
        <button className={styles.startOver} onClick={() => navigate('/recommend', { replace: true })}>
          Start over
        </button>
      </div>

      <img src="/hd2-logo.svg" alt="Helldivers 2" className={styles.gameLogo} />
      <p className={styles.summary}>{missionSummary}</p>
      <h1 className={styles.title}>Recommended Loadout</h1>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>Weapons</p>
        {weaponSlots.map(key => (
          <LoadoutRow
            key={key}
            slotKey={key}
            item={getSlotItem(loadout, key)}
            isNew={!!newItemIds.has(getSlotItem(loadout, key)?.id ?? '')}
            isOpen={openAccordions.has(key)}
            params={params}
            onToggle={() => toggleAccordion(key)}
            onSwap={() => handleOpenSwap(key)}
          />
        ))}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>Stratagems</p>
        {stratagemSlots.map(key => (
          <LoadoutRow
            key={key}
            slotKey={key}
            item={getSlotItem(loadout, key)}
            isNew={!!newItemIds.has(getSlotItem(loadout, key)?.id ?? '')}
            isOpen={openAccordions.has(key)}
            params={params}
            onToggle={() => toggleAccordion(key)}
            onSwap={() => handleOpenSwap(key)}
          />
        ))}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>Gear</p>
        {gearSlots.map(key => (
          <LoadoutRow
            key={key}
            slotKey={key}
            item={getSlotItem(loadout, key)}
            isNew={!!newItemIds.has(getSlotItem(loadout, key)?.id ?? '')}
            isOpen={openAccordions.has(key)}
            params={params}
            onToggle={() => toggleAccordion(key)}
            onSwap={() => handleOpenSwap(key)}
          />
        ))}
      </div>

      <div className={styles.actionBar}>
        <button
          className={`${styles.saveBtn} ${saveState === 'saved' ? styles.saveBtnSaved : ''}`}
          onClick={handleSave}
          disabled={saveState !== 'idle'}
        >
          {saveState === 'saved' ? 'Saved!' : saveState === 'full' ? 'Limit reached (50)' : 'Save Loadout'}
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
