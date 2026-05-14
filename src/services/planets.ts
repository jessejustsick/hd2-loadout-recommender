import type { Planet, FactionId, CampaignMode } from '@/types'

const API_BASE = 'https://api.helldivers2.dev'
const CACHE_TTL = 10 * 60 * 1000

interface ApiPlanet {
  name: string
  currentOwner: string
  biome: { name: string } | null
  hazards: Array<{ name: string }> | null
}

interface ApiCampaign {
  id: number
  planet: ApiPlanet
  type: number // 0 = liberation/attack, 1 = defense
}

interface PlanetCache {
  data: Planet[]
  fetchedAt: number
}

interface CampaignCache {
  data: Map<string, CampaignMode>
  fetchedAt: number
}

let cache: PlanetCache | null = null
let campaignCache: CampaignCache | null = null

const OWNER_TO_FACTION: Record<string, FactionId> = {
  Terminids: 'terminids',
  Automaton: 'automatons',
  Illuminate: 'illuminate',
}

// Maps API hazard names to catalog modifier IDs
const HAZARD_TO_MODIFIER_ID: Record<string, string> = {
  'Acid Storms': 'acid-storms',
  'Blizzards': 'blizzard',
  'Fire Tornadoes': 'fire-tornadoes',
  'Ion Storms': 'ion-storm',
  'Intense Heat': 'extreme-heat',
  'Meteor Storms': 'meteor-showers',
  'Sandstorms': 'sandstorms',
  'Thick Fog': 'thick-fog',
  'Tremors': 'tremors',
  'Extreme Cold': 'extreme-cold',
  'Rainstorms': 'rainstorm',
  'Volcanic Activity': 'volcanic-activity',
  'Atmospheric Spores': 'atmospheric-spores',
  'Heavy Gloom Shroud': 'heavy-gloom-shroud',
  'Light Gloom Cover': 'light-gloom-cover',
}

async function fetchCampaigns(): Promise<Map<string, CampaignMode>> {
  const res = await fetch(`${API_BASE}/api/v1/campaigns`, {
    headers: {
      'X-Super-Client': 'hd2-loadout-recommender',
      'X-Super-Contact': 'jessejusek@gmail.com',
      'Accept-Language': 'en-US',
    },
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  const raw = (await res.json()) as ApiCampaign[]
  const map = new Map<string, CampaignMode>()
  for (const c of raw) {
    map.set(c.planet.name, c.type === 1 ? 'defense' : 'attack')
  }
  return map
}

async function fetchFromApi(): Promise<Planet[]> {
  const res = await fetch(`${API_BASE}/api/v1/planets`, {
    headers: {
      'X-Super-Client': 'hd2-loadout-recommender',
      'X-Super-Contact': 'jessejusek@gmail.com',
      'Accept-Language': 'en-US',
    },
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  const raw = (await res.json()) as ApiPlanet[]
  return raw
    .filter(p => p.currentOwner in OWNER_TO_FACTION)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => {
      const hazardNames = (p.hazards ?? []).map(h => h.name).filter(n => n !== 'None')
      return {
        name: p.name,
        faction: OWNER_TO_FACTION[p.currentOwner] as FactionId,
        biome: p.biome?.name ?? null,
        hazards: hazardNames,
        modifiers: hazardNames
          .map(n => HAZARD_TO_MODIFIER_ID[n])
          .filter((id): id is string => id !== undefined),
      }
    })
}

async function ensureCampaignCache(): Promise<Map<string, CampaignMode>> {
  const now = Date.now()
  if (!campaignCache || now - campaignCache.fetchedAt > CACHE_TTL) {
    const data = await fetchCampaigns()
    campaignCache = { data, fetchedAt: now }
  }
  return campaignCache.data
}

export const planetService = {
  async getPlanets(faction?: FactionId): Promise<Planet[]> {
    const now = Date.now()
    if (!cache || now - cache.fetchedAt > CACHE_TTL) {
      const data = await fetchFromApi()
      cache = { data, fetchedAt: now }
    }

    // Only show planets with an active campaign — those are the only ones playable
    let activePlanetNames: Set<string>
    try {
      const campaigns = await ensureCampaignCache()
      activePlanetNames = new Set(campaigns.keys())
    } catch {
      // If campaigns fetch fails, fall back to all enemy-owned planets
      activePlanetNames = new Set(cache.data.map(p => p.name))
    }

    let planets = cache.data.filter(p => activePlanetNames.has(p.name))
    if (faction) planets = planets.filter(p => p.faction === faction)
    return planets
  },

  async getPlanet(name: string): Promise<Planet | undefined> {
    const planets = await this.getPlanets()
    return planets.find(p => p.name === name)
  },

  async getCampaignType(planetName: string): Promise<CampaignMode | null> {
    const campaigns = await ensureCampaignCache()
    return campaigns.get(planetName) ?? null
  },

  prefetch(): void {
    this.getPlanets().catch(() => undefined)
  },
}
