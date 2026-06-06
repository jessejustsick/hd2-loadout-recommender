export type FactionId = 'terminids' | 'automatons' | 'illuminate'

export type GenerationMode = 'recommended' | 'constrained_random' | 'full_random'

export type WeaponCategory = 'primary' | 'secondary' | 'grenade'

export type StratagemCategory = 'offensive' | 'defensive' | 'support'
// Fine-grained classification driving slot constraints + same-family swap options.
// (Replaced the old coarse `subType` 'other' bucket that lumped sentries, mines,
// exosuits, vehicles, emplacements, etc. into one indistinct group.)
export type StratagemFamily =
  | 'eagle' | 'orbital' | 'support-weapon' | 'backpack'
  | 'sentry' | 'mine' | 'exosuit' | 'emplacement' | 'vehicle' | 'utility'
export type CooldownTier = 'short' | 'medium' | 'long'
export type CallInType = 'single_use' | 'multi_use' | 'persistent'

export type ArmorTier = 'light' | 'medium' | 'heavy'

// Permanently unobtainable items (pre-order / event exclusives). Optional — its
// absence means the item is normally obtainable. See UNOBTAINABLE_PENALTY in the engine.
export type Availability = 'unobtainable'

export type ConstraintType = 'hard' | 'soft'
export type ModifierSeverity = 'low' | 'medium' | 'high'

// Curated capability: which factions' spawners this item can reliably *close*
// (Terminid bug holes, Automaton fabricators, Illuminate Warp Ships). Deliberately
// NOT derived from the `explosive` tag — many explosive items can't close a spawner
// (sentries, auto-targeters, area fire) and some non-explosive ones can (Gas grenade,
// Autocannon). An omitted/absent value means it can't close any. We intentionally do
// NOT distinguish heavy spawners (Bulk Fabricators / Bile Titan holes): standard
// closers handle them too (just slower), Bulk Fabs are urban-only so the engine can't
// reliably know to weight for them, and the `anti-tank` logic already favors the
// efficient heavy closers.
export type SpawnerKill = FactionId[]

export interface Weapon {
  id: string
  name: string
  category: WeaponCategory
  tags: string[]
  spawnerKill?: SpawnerKill
  source: string
  is_paid: boolean
  availability?: Availability
  iconRef: string
  lastUpdated: string
}

export interface Stratagem {
  id: string
  name: string
  category: StratagemCategory
  family: StratagemFamily
  tags: string[]
  spawnerKill?: SpawnerKill
  cooldownTier: CooldownTier
  callInType: CallInType
  iconRef: string
  source: string
  is_paid: boolean
  availability?: Availability
  lastUpdated: string
}

export interface Armor {
  id: string
  name: string
  passive: string
  armorTier: ArmorTier
  tags: string[]
  iconRef: string
  source: string
  is_paid: boolean
  availability?: Availability
  lastUpdated: string
}

export interface Booster {
  id: string
  name: string
  effect: string
  tags: string[]
  source: string
  is_paid: boolean
  availability?: Availability
  lastUpdated: string
}

export interface Faction {
  id: FactionId
  name: string
  icon: string
  enemyProfile: Record<string, string>
}

export type ModifierCategory = 'environmental' | 'operation'

export interface Modifier {
  id: string
  name: string
  effectTags: string[]
  severity: ModifierSeverity
  constraintType: ConstraintType
  category: ModifierCategory
  factions: FactionId[]
}

export interface Planet {
  name: string
  faction: FactionId
  hazards: string[]
  modifiers: string[]
  biome: string | null
}

export type CampaignMode = 'attack' | 'defense'

export interface MissionType {
  id: string
  name: string
  tags: string[]
  modes: CampaignMode[]
  requiredModifiers?: string[] // planet must have at least one of these to show this mission
  requiredBiomes?: string[]   // planet must have one of these biomes to show this mission
  availability: {
    difficulties: number[]
    factions: FactionId[]
  }
}

export interface MissionParams {
  faction: FactionId
  difficulty: number
  planet: string
  missionType: string
  modifiers: string[]
}

export interface Loadout {
  id: string
  primaryWeapon: string
  secondaryWeapon: string
  grenade: string
  stratagems: string[]
  armor: string
  booster: string
  faction?: FactionId
  planet?: string
  difficulty?: number
  missionType?: string
  modifiers?: string[]
  generationMode: GenerationMode
  createdAt: string
}

export interface LoadoutResult {
  primaryWeapon: Weapon | null
  secondaryWeapon: Weapon | null
  grenade: Weapon | null
  stratagems: (Stratagem | null)[]
  armor: Armor | null
  booster: Booster | null
}

export interface ScoredItem<T> {
  item: T
  score: number
}

export interface Catalog {
  weapons: Weapon[]
  stratagems: Stratagem[]
  armor: Armor[]
  boosters: Booster[]
  factions: Faction[]
  missionTypes: MissionType[]
  modifiers: Modifier[]
}
