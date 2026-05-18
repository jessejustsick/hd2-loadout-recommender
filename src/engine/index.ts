import type {
  MissionParams,
  LoadoutResult,
  Stratagem,
  Modifier,
  FactionId,
  ScoredItem,
  Armor,
} from '@/types'
import { catalogService } from '@/services/catalog'

// ---- Layer 1: Hard Constraints ----

function applyHardConstraints(stratagems: Stratagem[], modifiers: Modifier[]): Stratagem[] {
  const hard = modifiers.filter(m => m.constraintType === 'hard')
  return stratagems.filter(s => {
    for (const mod of hard) {
      if (mod.effectTags.includes('no_eagles') && s.subType === 'eagle') return false
    }
    return true
  })
}

// ---- Layer 2: Weighted Scoring ----

const FACTION_WEIGHTS: Record<FactionId, Record<string, number>> = {
  terminids: {
    'crowd-control': 2.0,
    'area-denial': 1.8,
    'anti-swarm': 2.0,
    'anti-armor': 1.2,
    explosive: 1.5,
  },
  automatons: {
    'anti-armor': 2.0,
    'anti-tank': 2.0,
    explosive: 1.5,
    precision: 1.3,
    'crowd-control': 0.8,
  },
  illuminate: {
    'anti-shield': 1.8,
    energy: 1.5,
    'anti-armor': 1.3,
    'crowd-control': 1.3,
  },
}

// Armor passive → faction affinity weights
const PASSIVE_FACTION_WEIGHTS: Record<string, Partial<Record<FactionId, number>>> = {
  'Fortified':                        { automatons: 2.0 },
  'Ballistic Padding':                { automatons: 1.8 },
  'Concussive Padding, Hazmat':       { automatons: 1.5 },
  'Concussive Padding, Grenadier':    { automatons: 1.5 },
  'Concussive Padding, Reinforced':   { automatons: 1.5 },
  'Inflammable':                      { automatons: 1.5, terminids: 1.3 },
  'Advanced Filtration':              { terminids: 1.8 },
  'Electrical Conduit':               { illuminate: 2.0 },
  'Desert Stormer':                   { illuminate: 1.3 },
  'Engineering Kit':                  { terminids: 1.3 },
  'Integrated Explosives':            { terminids: 1.3 },
  'Scout':                            { terminids: 1.2 },
  'Reduced Signature':                { terminids: 1.2 },
}

// Operation modifier → item tag weights
const MODIFIER_TAG_WEIGHTS: Record<string, Record<string, number>> = {
  'gunship-patrols':       { 'anti-armor': 1.5, 'anti-tank': 1.5, precision: 1.3 },
  'roving-shriekers':      { 'anti-swarm': 1.5, 'crowd-control': 1.5, 'area-denial': 1.3 },
  'leviathan-blockade':    { 'anti-shield': 1.5, energy: 1.5, 'anti-armor': 1.3 },
  'civilians-in-area':     { 'area-denial': 0.7, explosive: 0.8 },
  'medical-supply-strain': { support: 1.4, survivability: 1.2 },
  'poor-intel':            { scout: 1.4 },
  'extreme-heat':          { laser: 0.7 },
  'extreme-cold':          { laser: 1.3 },
  'slower-eagle-rearm':    { eagle: 0.7, orbital: 1.2 },
  'orbital-fluctuations':  { orbital: 0.7, eagle: 1.2 },
  'predator-strain':       { 'anti-swarm': 1.6, 'crowd-control': 1.5, mobility: 1.3 },
  'incineration-corps':    { fire: 0.7, survivability: 1.3, 'anti-armor': 1.3 },
  'jet-brigade':           { 'anti-armor': 1.5, 'anti-tank': 1.3, precision: 1.4 },
  'appropriators':         { 'anti-shield': 1.6, energy: 1.5, 'anti-armor': 1.3 },
  'spore-burst-strain':   { precision: 1.4, 'area-denial': 1.3, 'anti-swarm': 1.3 },
  'rupture-strain':       { 'area-denial': 1.5, 'crowd-control': 1.4, 'anti-swarm': 1.3 },
  'cyborg-legion':        { 'crowd-control': 1.4, explosive: 1.3, 'anti-armor': 1.2 },
  'mindless-masses':      { 'anti-swarm': 1.7, 'crowd-control': 1.6, 'area-denial': 1.5, explosive: 1.3 },
}

// Which loadout damage tags call for which protective passives
const SYNERGY_PASSIVE_MAP: Record<string, string[]> = {
  fire: ['Inflammable'],
  gas:  ['Advanced Filtration'],
  arc:  ['Electrical Conduit'],
}

function scoreItem(tags: string[], params: MissionParams, modifiers: Modifier[]): number {
  let score = 1.0
  const fw = FACTION_WEIGHTS[params.faction] ?? {}
  for (const tag of tags) score *= fw[tag] ?? 1.0

  if (params.difficulty >= 7) {
    if (tags.includes('anti-armor') || tags.includes('anti-tank')) score *= 1.3
    if (tags.includes('resupply') || tags.includes('support')) score *= 1.2
  }

  for (const mod of modifiers.filter(m => m.constraintType === 'soft')) {
    for (const et of mod.effectTags) {
      if (tags.includes(`boost_${et}`)) score *= 1.3
      if (tags.includes(`penalty_${et}`)) score *= 0.6
    }
  }

  for (const mod of modifiers) {
    const mw = MODIFIER_TAG_WEIGHTS[mod.id] ?? {}
    for (const tag of tags) score *= mw[tag] ?? 1.0
  }

  return score
}

function scoreArmor(
  armor: Armor,
  params: MissionParams,
  modifiers: Modifier[],
  loadoutTags: string[],
): number {
  let score = scoreItem(armor.tags, params, modifiers)

  // Faction affinity from passive
  const passiveWeight = PASSIVE_FACTION_WEIGHTS[armor.passive]?.[params.faction]
  if (passiveWeight) score *= passiveWeight

  // Synergy: boost armor that protects against damage types in the loadout,
  // scaled by how many items carry that damage tag so dominant types win
  for (const [dmgTag, passives] of Object.entries(SYNERGY_PASSIVE_MAP)) {
    const count = loadoutTags.filter(t => t === dmgTag).length
    if (count > 0 && passives.includes(armor.passive)) {
      score *= Math.min(1.0 + count * 0.4, 2.2) // 1 item→1.4×, 2→1.8×, 3+→2.2× (cap)
    }
  }

  return score
}

function scoreAll<T extends { tags: string[] }>(
  items: T[],
  params: MissionParams,
  modifiers: Modifier[],
): ScoredItem<T>[] {
  return items
    .map(item => ({ item, score: scoreItem(item.tags, params, modifiers) }))
    .sort((a, b) => b.score - a.score)
}

function scoreAllArmor(
  items: Armor[],
  params: MissionParams,
  modifiers: Modifier[],
  loadoutTags: string[],
): ScoredItem<Armor>[] {
  return items
    .map(item => ({ item, score: scoreArmor(item, params, modifiers, loadoutTags) }))
    .sort((a, b) => b.score - a.score)
}

// ---- Layer 3: Controlled Randomness ----

function weightedRandom<T>(scored: ScoredItem<T>[], topN: number): T | null {
  const pool = scored.slice(0, Math.min(topN, scored.length))
  if (pool.length === 0) return null

  const total = pool.reduce((s, x) => s + x.score, 0)
  if (total === 0) return pool[Math.floor(Math.random() * pool.length)]!.item

  let rand = Math.random() * total
  for (const { item, score } of pool) {
    rand -= score
    if (rand <= 0) return item
  }
  return pool[pool.length - 1]!.item
}

// ---- Role Coverage Boost ----

function boostForCoverage(
  scored: ScoredItem<Stratagem>[],
  selected: Stratagem[],
): ScoredItem<Stratagem>[] {
  const hasAntiArmor = selected.some(s => s.tags.some(t => t === 'anti-armor' || t === 'anti-tank'))
  const hasCrowdControl = selected.some(s => s.tags.some(t => t === 'crowd-control' || t === 'area-denial'))

  return scored.map(s => {
    let multiplier = 1.0
    if (!hasAntiArmor && s.item.tags.some(t => t === 'anti-armor' || t === 'anti-tank')) multiplier *= 2.0
    if (!hasCrowdControl && s.item.tags.some(t => t === 'crowd-control' || t === 'area-denial')) multiplier *= 1.5
    return { ...s, score: s.score * multiplier }
  })
}

// ---- Public API ----

const TOP_N = 10

function resolveModifiers(params: MissionParams): Modifier[] {
  const all = catalogService.getModifiers()
  return all.filter(m => params.modifiers.includes(m.id))
}

export function generateRecommendation(params: MissionParams): LoadoutResult {
  const modifiers = resolveModifiers(params)

  const primaryWeapon = weightedRandom(scoreAll(catalogService.getWeapons('primary'), params, modifiers), TOP_N)
  const secondaryWeapon = weightedRandom(scoreAll(catalogService.getWeapons('secondary'), params, modifiers), TOP_N)
  const grenade = weightedRandom(scoreAll(catalogService.getWeapons('grenade'), params, modifiers), TOP_N)
  const booster = weightedRandom(scoreAll(catalogService.getBoosters(), params, modifiers), TOP_N)

  const eligible = applyHardConstraints(catalogService.getStratagems(), modifiers)
  const selected: Stratagem[] = []

  for (let i = 0; i < 4; i++) {
    const hasWeapon = selected.some(s => s.subType === 'support_weapon')
    const hasBackpack = selected.some(s => s.subType === 'backpack')
    const hasPackedWeapon = selected.some(s => s.tags.includes('needs-backpack'))

    // On the last pick for Terminids, enforce at least one explosive item
    const needsExplosive =
      params.faction === 'terminids' &&
      i === 3 &&
      ![...selected, primaryWeapon, secondaryWeapon, grenade]
        .filter(Boolean)
        .some(item => item!.tags.includes('explosive'))

    const scored = boostForCoverage(scoreAll(eligible, params, modifiers), selected)

    const available = scored.filter(s => {
      if (selected.includes(s.item)) return false
      if (hasWeapon && s.item.subType === 'support_weapon') return false
      if (hasPackedWeapon && s.item.subType === 'backpack') return false
      if (hasBackpack && s.item.tags.includes('needs-backpack')) return false
      if (needsExplosive && !s.item.tags.includes('explosive')) return false
      return true
    })
    const pick = weightedRandom(available, TOP_N)
    if (pick) selected.push(pick)
  }

  // Score armor after loadout is known so synergy passives can influence selection
  const loadoutTags = [...selected, primaryWeapon, secondaryWeapon, grenade]
    .filter(Boolean)
    .flatMap(item => item!.tags)
  const armor = weightedRandom(scoreAllArmor(catalogService.getArmor(), params, modifiers, loadoutTags), TOP_N)

  return {
    primaryWeapon,
    secondaryWeapon,
    grenade,
    stratagems: [selected[0] ?? null, selected[1] ?? null, selected[2] ?? null, selected[3] ?? null],
    armor,
    booster,
  }
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export function generateConstrained(): LoadoutResult {
  const stratagems = shuffle(catalogService.getStratagems())
  const selected: Stratagem[] = []
  const usedSubTypes = new Set<string>()

  for (const s of stratagems) {
    if (selected.length >= 4) break
    if (!usedSubTypes.has(s.subType)) {
      selected.push(s)
      usedSubTypes.add(s.subType)
    }
  }
  for (const s of stratagems) {
    if (selected.length >= 4) break
    if (!selected.includes(s)) selected.push(s)
  }

  return {
    primaryWeapon: shuffle(catalogService.getWeapons('primary'))[0] ?? null,
    secondaryWeapon: shuffle(catalogService.getWeapons('secondary'))[0] ?? null,
    grenade: shuffle(catalogService.getWeapons('grenade'))[0] ?? null,
    stratagems: [selected[0] ?? null, selected[1] ?? null, selected[2] ?? null, selected[3] ?? null],
    armor: shuffle(catalogService.getArmor())[0] ?? null,
    booster: shuffle(catalogService.getBoosters())[0] ?? null,
  }
}

export function generateFullRandom(): LoadoutResult {
  const stratagems = shuffle(catalogService.getStratagems())
  return {
    primaryWeapon: shuffle(catalogService.getWeapons('primary'))[0] ?? null,
    secondaryWeapon: shuffle(catalogService.getWeapons('secondary'))[0] ?? null,
    grenade: shuffle(catalogService.getWeapons('grenade'))[0] ?? null,
    stratagems: [stratagems[0] ?? null, stratagems[1] ?? null, stratagems[2] ?? null, stratagems[3] ?? null],
    armor: shuffle(catalogService.getArmor())[0] ?? null,
    booster: shuffle(catalogService.getBoosters())[0] ?? null,
  }
}

export function getAlternatives(
  slot: 'primary' | 'secondary' | 'grenade' | 'stratagem' | 'armor' | 'booster',
  excludeIds: string[],
  params: MissionParams,
  count = 3,
): (import('@/types').Weapon | Stratagem | import('@/types').Armor | import('@/types').Booster)[] {
  const modifiers = resolveModifiers(params)

  if (slot === 'primary' || slot === 'secondary' || slot === 'grenade') {
    return scoreAll(catalogService.getWeapons(slot), params, modifiers)
      .filter(s => !excludeIds.includes(s.item.id))
      .slice(0, count)
      .map(s => s.item)
  }
  if (slot === 'stratagem') {
    return scoreAll(applyHardConstraints(catalogService.getStratagems(), modifiers), params, modifiers)
      .filter(s => !excludeIds.includes(s.item.id))
      .slice(0, count)
      .map(s => s.item)
  }
  if (slot === 'armor') {
    return scoreAllArmor(catalogService.getArmor(), params, modifiers, [])
      .filter(s => !excludeIds.includes(s.item.id))
      .slice(0, count)
      .map(s => s.item)
  }
  return scoreAll(catalogService.getBoosters(), params, modifiers)
    .filter(s => !excludeIds.includes(s.item.id))
    .slice(0, count)
    .map(s => s.item)
}
