import type { Catalog, Weapon, Stratagem, Armor, Booster, Faction, MissionType, Modifier } from '@/types'
import catalogData from '@/data/catalog.json'

const catalog = catalogData as Catalog

export const catalogService = {
  getWeapons(category?: Weapon['category']): Weapon[] {
    if (category) return catalog.weapons.filter(w => w.category === category)
    return catalog.weapons
  },

  getStratagems(): Stratagem[] {
    return catalog.stratagems
  },

  getArmor(): Armor[] {
    return catalog.armor
  },

  getBoosters(): Booster[] {
    return catalog.boosters
  },

  getFactions(): Faction[] {
    return catalog.factions
  },

  getMissionTypes(): MissionType[] {
    return catalog.missionTypes
  },

  getModifiers(): Modifier[] {
    return catalog.modifiers
  },

  getItemById(id: string): Weapon | Stratagem | Armor | Booster | null {
    return (
      catalog.weapons.find(w => w.id === id) ??
      catalog.stratagems.find(s => s.id === id) ??
      catalog.armor.find(a => a.id === id) ??
      catalog.boosters.find(b => b.id === id) ??
      null
    )
  },
}
