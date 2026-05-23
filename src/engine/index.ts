import type {
  MissionParams,
  LoadoutResult,
  Stratagem,
  Modifier,
  FactionId,
  ScoredItem,
  Armor,
  ArmorTier,
  Availability,
  StratagemFamily,
} from '@/types'
import { catalogService } from '@/services/catalog'

// ---- Layer 1: Hard Constraints ----

// A stratagem occupies the single backpack slot if it IS a backpack, or if it's a
// support weapon that ships with one (needs-backpack). Only one such item can be worn.
function usesBackpackSlot(s: Stratagem): boolean {
  return s.family === 'backpack' || s.tags.includes('needs-backpack')
}

// A stratagem occupies your hands (the held support-weapon slot) if it's a carried
// support weapon, or the C4 pack — family 'backpack', but you must keep its detonator
// in hand, so it can't share your hands with a support weapon. Every needs-backpack
// item is also wielded (the 8 support weapons + the C4 detonator), which catches it.
// Expendables (EATs) are grab-fire-drop, not persistently held, so one may ride along.
function usesWeaponSlot(s: Stratagem): boolean {
  if (s.tags.includes('expendable')) return false
  return s.family === 'support-weapon' || s.tags.includes('needs-backpack')
}

function applyHardConstraints(stratagems: Stratagem[], modifiers: Modifier[]): Stratagem[] {
  const hard = modifiers.filter(m => m.constraintType === 'hard')
  return stratagems.filter(s => {
    for (const mod of hard) {
      if (mod.effectTags.includes('no_eagles') && s.family === 'eagle') return false
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
    'anti-swarm': 1.5,    // Voteless hordes + Obtruder flying groups
    explosive: 1.5,       // Warp Ships (spawners), Lightning Spires, Overseer shield bypass, Fleshmob
    'anti-tank': 1.4,     // Harvester (AV4 body, eye/hip joints)
    fire: 1.3,            // Voteless instant-kill, Fleshmob 1.8x vulnerability
    precision: 1.3,       // weak points everywhere; Watcher one-shots (kill the reinforcement caller)
    'crowd-control': 1.3, // Voteless/Obtruder swarm (NOT Fleshmob — it's stun-immune)
    gas: 1.3,             // Voteless confusion (4-7s neutralize), Fleshmob divert
    'area-denial': 1.3,   // Tesla/Flame sentries vs hordes
    'anti-armor': 1.2,    // Harvester joints, medium Overseer bodies
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
  'Electrical Conduit':               { illuminate: 1.8 },
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
  'leviathan-blockade':    { 'anti-tank': 1.5, 'anti-armor': 1.4, explosive: 1.2 },
  'civilians-in-area':     { 'area-denial': 0.7, explosive: 0.8 },
  'medical-supply-strain': { support: 1.4, survivability: 1.2 },
  'poor-intel':            { scout: 1.4 },
  'extreme-heat':          { laser: 0.7 },
  'extreme-cold':          { laser: 1.3 },
  'slower-eagle-rearm':    { eagle: 0.7, orbital: 1.2 },
  'orbital-fluctuations':  { orbital: 0.7, eagle: 1.2 },
  'predator-strain':       { 'anti-swarm': 1.6, 'crowd-control': 1.5, gas: 1.4, fire: 1.3, mobility: 1.3 }, // gas/fire counter the cloaking hunters
  'incineration-corps':    { survivability: 1.3, 'anti-armor': 1.3 }, // units are NOT fire-resistant — no fire suppressor; they deal fire TO you → survivability
  'jet-brigade':           { 'anti-armor': 1.5, precision: 1.4, explosive: 1.4, 'anti-tank': 1.3, mine: 0.6 }, // jump packs are explosive-vulnerable; mild mine suppress (they jump, dodge ground AoE)
  'appropriators':         { 'anti-tank': 1.6, 'anti-armor': 1.4, precision: 1.3, 'anti-swarm': 1.2, mine: 0.3 }, // Veracitor + Gatekeeper war machines (AT) + flying Obtruders; mines whiff on flyers/armor
  'spore-burst-strain':   { fire: 1.5, gas: 1.4, 'crowd-control': 1.4, 'anti-swarm': 1.4, 'area-denial': 1.3 }, // kill-while-burning prevents the death-spore release; CC slows the buffed swarm
  'rupture-strain':       { explosive: 1.5, 'area-denial': 1.4, 'anti-armor': 1.3, 'crowd-control': 1.3, 'anti-swarm': 1.3 }, // explosive forces burrowers to surface (primary counter); anti-armor for Rupture Chargers
  'cyborg-legion':        { 'crowd-control': 1.4, 'anti-armor': 1.4, precision: 1.3, 'anti-tank': 1.3, explosive: 1.3 }, // priority-kill the armored Agitator commander (precision/AT) + Vox Engine mech
  'mindless-masses':      { 'anti-swarm': 1.7, fire: 1.5, 'crowd-control': 1.6, 'area-denial': 1.5, explosive: 1.3, precision: 0.8, 'anti-tank': 0.8 },
}

// Mission type tag → item tag weights. Mission tags come from the selected
// mission type in the catalog; combat-need tags (anti-armor/anti-tank/anti-swarm/
// precision) reinforce the matching capability, structural tags (escort, scout,
// defend-objective, etc.) map to the playstyle that mission rewards.
const MISSION_TYPE_TAG_WEIGHTS: Record<string, Record<string, number>> = {
  'anti-armor':        { 'anti-armor': 1.4, 'anti-tank': 1.2 },
  'anti-tank':         { 'anti-tank': 1.5, 'anti-armor': 1.2 },
  'anti-swarm':        { 'anti-swarm': 1.4, 'crowd-control': 1.3, 'area-denial': 1.2 },
  precision:           { precision: 1.4 },
  elimination:         { precision: 1.3, 'anti-armor': 1.2, 'anti-tank': 1.2 },
  'defend-objective':  { 'area-denial': 1.4, 'crowd-control': 1.3, defensive: 1.3, survivability: 1.2 },
  escort:              { 'crowd-control': 1.4, 'area-denial': 1.3, defensive: 1.2 },
  'destroy-objective': { explosive: 1.3, 'anti-tank': 1.3, expendable: 1.4, guided: 1.2 },
  scout:               { scout: 1.5, mobility: 1.3, suppressed: 1.3 },
  stealth:             { suppressed: 1.5, scout: 1.4, precision: 1.2, mobility: 1.2 },
  'time-pressure':     { mobility: 1.3, eagle: 1.3, 'crowd-control': 1.2 },
  'fast-paced':        { mobility: 1.4, eagle: 1.3, 'anti-swarm': 1.2 },
  'multi-objective':   { mobility: 1.3, eagle: 1.2, versatile: 1.2 },
  'multi-stage':       { survivability: 1.2, versatile: 1.2, resupply: 1.2 },
}

// Which loadout damage tags call for which protective passives
const SYNERGY_PASSIVE_MAP: Record<string, string[]> = {
  fire: ['Inflammable'],
  gas:  ['Advanced Filtration'],
  arc:  ['Electrical Conduit'],
}

// Tiers track the game's real difficulty breakpoints (helldivers.wiki.gg/wiki/Difficulty):
// heavies (Chargers/Hulks/Tanks) first appear at L3, super-heavies (Bile Titan/
// Factory Strider/Harvester) at L4, and patrol density climbs steadily after.
// Difficulty emphasizes threat-response that scales with level (armor, then bodies),
// not sustain/safety padding — effectiveness for the context keeps players alive.
const DIFFICULTY_WEIGHTS: [maxDiff: number, weights: Record<string, number>][] = [
  [2,  { versatile: 1.2, mobility: 1.15 }],
  [3,  { 'anti-armor': 1.2, versatile: 1.1 }],
  [4,  { 'anti-armor': 1.3, 'anti-tank': 1.25 }],
  [6,  { 'anti-armor': 1.35, 'anti-tank': 1.35, 'crowd-control': 1.1, 'anti-swarm': 1.1 }],
  [8,  { 'anti-armor': 1.4, 'anti-tank': 1.45, 'crowd-control': 1.2, 'anti-swarm': 1.15, resupply: 1.1 }],
  [10, { 'anti-armor': 1.5, 'anti-tank': 1.5, 'crowd-control': 1.25, 'anti-swarm': 1.2, resupply: 1.15 }],
]

// A handful of armor sets are permanently unobtainable (pre-order / event
// exclusives). They're valid for the players who own them, but the engine
// shouldn't recommend gear ~nobody can acquire. This penalty sinks them in
// ranking so they drop out of the recommended pool, while leaving them at full
// rate in full-random rolls and (low-ranked) in the swap sheet. Tunable knob.
const UNOBTAINABLE_PENALTY = 0.3

function availabilityMultiplier(item: { availability?: Availability }): number {
  return item.availability === 'unobtainable' ? UNOBTAINABLE_PENALTY : 1.0
}

function scoreItem(
  tags: string[],
  params: MissionParams,
  modifiers: Modifier[],
  missionTags: string[],
): number {
  let score = 1.0
  const fw = FACTION_WEIGHTS[params.faction] ?? {}
  for (const tag of tags) score *= fw[tag] ?? 1.0

  const dw = DIFFICULTY_WEIGHTS.find(([max]) => params.difficulty <= max)?.[1] ?? {}
  for (const tag of tags) score *= dw[tag] ?? 1.0

  for (const mt of missionTags) {
    const mtw = MISSION_TYPE_TAG_WEIGHTS[mt] ?? {}
    for (const tag of tags) score *= mtw[tag] ?? 1.0
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
  missionTags: string[],
): number {
  let score = scoreItem(armor.tags, params, modifiers, missionTags)

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

  return score * availabilityMultiplier(armor)
}

function scoreAll<T extends { tags: string[]; availability?: Availability }>(
  items: T[],
  params: MissionParams,
  modifiers: Modifier[],
  missionTags: string[],
): ScoredItem<T>[] {
  return items
    .map(item => ({ item, score: scoreItem(item.tags, params, modifiers, missionTags) * availabilityMultiplier(item) }))
    .sort((a, b) => b.score - a.score)
}

function scoreAllArmor(
  items: Armor[],
  params: MissionParams,
  modifiers: Modifier[],
  loadoutTags: string[],
  missionTags: string[],
): ScoredItem<Armor>[] {
  return items
    .map(item => ({ item, score: scoreArmor(item, params, modifiers, loadoutTags, missionTags) }))
    .sort((a, b) => b.score - a.score)
}

// ---- Layer 3: Controlled Randomness ----

// Variety controls. The candidate pool scales with the number of items in the
// category (~half of them) instead of a flat cutoff, so large categories like
// primaries don't collapse to the same handful every roll. Selection weight is
// score^EXPONENT with EXPONENT < 1 to flatten the multiplicative score curve,
// so the single highest-scored item stops dominating while still being favored.
const POOL_FRACTION = 0.5
const POOL_MIN = 8
const SELECTION_EXPONENT = 0.5

function weightedRandom<T>(scored: ScoredItem<T>[]): T | null {
  if (scored.length === 0) return null
  const poolSize = Math.max(POOL_MIN, Math.ceil(scored.length * POOL_FRACTION))
  const pool = scored.slice(0, Math.min(poolSize, scored.length))

  const weights = pool.map(x => Math.pow(x.score, SELECTION_EXPONENT))
  const total = weights.reduce((s, w) => s + w, 0)
  if (total === 0) return pool[Math.floor(Math.random() * pool.length)]!.item

  let rand = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    rand -= weights[i]!
    if (rand <= 0) return pool[i]!.item
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

function resolveModifiers(params: MissionParams): Modifier[] {
  const all = catalogService.getModifiers()
  return all.filter(m => params.modifiers.includes(m.id))
}

function resolveMissionTags(params: MissionParams): string[] {
  return catalogService.getMissionTypes().find(m => m.id === params.missionType)?.tags ?? []
}

export function generateRecommendation(params: MissionParams): LoadoutResult {
  const modifiers = resolveModifiers(params)
  const missionTags = resolveMissionTags(params)

  const primaryWeapon = weightedRandom(scoreAll(catalogService.getWeapons('primary'), params, modifiers, missionTags))
  const secondaryWeapon = weightedRandom(scoreAll(catalogService.getWeapons('secondary'), params, modifiers, missionTags))
  const grenade = weightedRandom(scoreAll(catalogService.getWeapons('grenade'), params, modifiers, missionTags))
  const booster = weightedRandom(scoreAll(catalogService.getBoosters(), params, modifiers, missionTags))

  const eligible = applyHardConstraints(catalogService.getStratagems(), modifiers)
  const selected: Stratagem[] = []

  for (let i = 0; i < 4; i++) {
    // One wielded (held) weapon: at most one carried support weapon OR the C4 pack,
    // plus at most one *expendable* (EAT-style grab-fire-drop) on top — a valid but
    // uncommon playstyle. Keyed on family/tags, not the legacy `subType` (which mistags
    // EAT-700/EAT-411/Solo Silo as 'other' and would slip the constraint).
    const hasWieldedWeapon = selected.some(usesWeaponSlot)
    const hasExpendableWeapon = selected.some(
      s => s.family === 'support-weapon' && s.tags.includes('expendable')
    )
    // Only one backpack slot: at most one standalone backpack OR backpack-using
    // weapon. Keyed on family (Shield Gen / Ballistic Shield packs are subType 'other').
    const hasBackpackSlot = selected.some(usesBackpackSlot)

    const fullLoadoutSoFar = [...selected, primaryWeapon, secondaryWeapon, grenade].filter(Boolean)

    // On the last pick, enforce at least one explosive item for factions with
    // explosive-only spawners: Terminids (bug holes) and Illuminate (Warp Ships)
    const needsExplosive =
      (params.faction === 'terminids' || params.faction === 'illuminate') &&
      i === 3 &&
      !fullLoadoutSoFar.some(item => item!.tags.includes('explosive'))

    // At difficulty 4+, enforce at least one anti-tank item — super-heavies
    // (Bile Titan, Factory Strider, Harvester) first appear at L4
    const needsAntiTank =
      params.difficulty >= 4 &&
      i === 3 &&
      !fullLoadoutSoFar.some(item => item!.tags.includes('anti-tank'))

    const scored = boostForCoverage(scoreAll(eligible, params, modifiers, missionTags), selected)

    const available = scored.filter(s => {
      if (selected.includes(s.item)) return false
      const isExpendable = s.item.family === 'support-weapon' && s.item.tags.includes('expendable')
      if (usesWeaponSlot(s.item) && hasWieldedWeapon) return false
      if (isExpendable && hasExpendableWeapon) return false
      if (usesBackpackSlot(s.item) && hasBackpackSlot) return false
      if (needsExplosive && !s.item.tags.includes('explosive')) return false
      if (needsAntiTank && !s.item.tags.includes('anti-tank')) return false
      return true
    })
    const pick = weightedRandom(available)
    if (pick) selected.push(pick)
  }

  // Score armor after loadout is known so synergy passives can influence selection
  const loadoutTags = [...selected, primaryWeapon, secondaryWeapon, grenade]
    .filter(Boolean)
    .flatMap(item => item!.tags)
  const armor = weightedRandom(scoreAllArmor(catalogService.getArmor(), params, modifiers, loadoutTags, missionTags))

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
  count = 4,
  sameFamily?: StratagemFamily,
): (import('@/types').Weapon | Stratagem | import('@/types').Armor | import('@/types').Booster)[] {
  const modifiers = resolveModifiers(params)
  const missionTags = resolveMissionTags(params)

  if (slot === 'primary' || slot === 'secondary' || slot === 'grenade') {
    return scoreAll(catalogService.getWeapons(slot), params, modifiers, missionTags)
      .filter(s => !excludeIds.includes(s.item.id))
      .slice(0, count)
      .map(s => s.item)
  }
  if (slot === 'stratagem') {
    const ranked = scoreAll(applyHardConstraints(catalogService.getStratagems(), modifiers), params, modifiers, missionTags)
      .filter(s => !excludeIds.includes(s.item.id))
    if (sameFamily) {
      // Guarantee a couple of same-family options up front (e.g. another exosuit),
      // then fill with the best-scoring overall so the user isn't boxed in.
      const pinned = ranked.filter(s => s.item.family === sameFamily).slice(0, 2)
      const pinnedIds = new Set(pinned.map(s => s.item.id))
      return [...pinned, ...ranked.filter(s => !pinnedIds.has(s.item.id))].slice(0, count).map(s => s.item)
    }
    return ranked.slice(0, count).map(s => s.item)
  }
  if (slot === 'armor') {
    return scoreAllArmor(catalogService.getArmor(), params, modifiers, [], missionTags)
      .filter(s => !excludeIds.includes(s.item.id))
      .slice(0, count)
      .map(s => s.item)
  }
  return scoreAll(catalogService.getBoosters(), params, modifiers, missionTags)
    .filter(s => !excludeIds.includes(s.item.id))
    .slice(0, count)
    .map(s => s.item)
}

// Armor swap offers the best-scoring set from each weight class so the player
// picks their own mobility/protection tradeoff rather than a tier the engine
// happened to pick. Returns at most one per tier, ordered light → heavy.
export function getArmorAlternativesByTier(excludeIds: string[], params: MissionParams): Armor[] {
  const modifiers = resolveModifiers(params)
  const missionTags = resolveMissionTags(params)
  const scored = scoreAllArmor(catalogService.getArmor(), params, modifiers, [], missionTags)
  const tiers: ArmorTier[] = ['light', 'medium', 'heavy']
  return tiers
    .map(tier => scored.find(s => s.item.armorTier === tier && !excludeIds.includes(s.item.id))?.item)
    .filter((a): a is Armor => a != null)
}
