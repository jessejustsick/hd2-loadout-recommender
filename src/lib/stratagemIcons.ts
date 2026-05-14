const CDN_BASE = 'https://cdn.jsdelivr.net/gh/nvigneux/Helldivers-2-Stratagems-icons-svg@master'

const ICON_PATHS: Record<string, string> = {
  // General Stratagems
  'Call In Super Destroyer': 'General Stratagems/Call In Super Destroyer.svg',
  'Cargo Container': 'General Stratagems/Cargo Container.svg',
  'Dark Fluid Vessel': 'General Stratagems/Dark Fluid Vessel.svg',
  'Hellbomb': 'General Stratagems/Hellbomb.svg',
  'Hive Breaker Drill': 'General Stratagems/Hive Breaker Drill.svg',
  'Orbital Illumination Flare': 'General Stratagems/Orbital Illumination Flare.svg',
  'Prospecting Drill': 'General Stratagems/Prospecting Drill.svg',
  'Reinforce': 'General Stratagems/Reinforce.svg',
  'Resupply': 'General Stratagems/Resupply.svg',
  'SEAF Artillery': 'General Stratagems/SEAF Artillery.svg',
  'SOS Beacon': 'General Stratagems/SOS Beacon.svg',
  'Seismic Probe': 'General Stratagems/Seismic Probe.svg',
  'Super Earth Flag': 'General Stratagems/Super Earth Flag.svg',
  'Tectonic Drill': 'General Stratagems/Tectonic Drill.svg',
  'Upload Data': 'General Stratagems/Upload Data.svg',

  // Hangar
  'Eagle 110MM Rocket Pods': 'Hangar/Eagle 110MM Rocket Pods.svg',
  'Eagle 500KG Bomb': 'Hangar/Eagle 500KG Bomb.svg',
  'Eagle Airstrike': 'Hangar/Eagle Airstrike.svg',
  'Eagle Cluster Bomb': 'Hangar/Eagle Cluster Bomb.svg',
  'Eagle Napalm Airstrike': 'Hangar/Eagle Napalm Airstrike.svg',
  'Eagle Rearm': 'Hangar/Eagle Rearm.svg',
  'Eagle Smoke Strike': 'Hangar/Eagle Smoke Strike.svg',
  'Eagle Strafing Run': 'Hangar/Eagle Strafing Run.svg',
  'Fast Recon Vehicle': 'Hangar/Fast Recon Vehicle.svg',
  'Jump Pack': 'Hangar/Jump Pack.svg',

  // Orbital Cannons
  'Orbital 120MM HE Barrage': 'Orbital Cannons/Orbital 120MM HE Barrage.svg',
  'Orbital 380MM HE Barrage': 'Orbital Cannons/Orbital 380MM HE Barrage.svg',
  'Orbital Airburst Strike': 'Orbital Cannons/Orbital Airburst Strike.svg',
  'Orbital Gatling Barrage': 'Orbital Cannons/Orbital Gatling Barrage.svg',
  'Orbital Laser': 'Orbital Cannons/Orbital Laser.svg',
  'Orbital Napalm Barrage': 'Orbital Cannons/Orbital Napalm Barrage.svg',
  'Orbital Railcannon Strike': 'Orbital Cannons/Orbital Railcannon Strike.svg',
  'Orbital Walking Barrage': 'Orbital Cannons/Orbital Walking Barrage.svg',

  // Engineering Bay
  'Anti-Personnel Minefield': 'Engineering Bay/Anti-Personnel Minefield.svg',
  'Anti-Tank Mines': 'Engineering Bay/Anti-Tank Mines.svg',
  'Arc Thrower': 'Engineering Bay/Arc Thrower.svg',
  'Ballistic Shield Backpack': 'Engineering Bay/Ballistic Shield Backpack.svg',
  'Gas Mine': 'Engineering Bay/Gas Mine.svg',
  'Grenade Launcher': 'Engineering Bay/Grenade Launcher.svg',
  'Guard Dog Rover': 'Engineering Bay/Guard Dog Rover.svg',
  'Incendiary Mines': 'Engineering Bay/Incendiary Mines.svg',
  'Laser Cannon': 'Engineering Bay/Laser Cannon.svg',
  'Quasar Cannon': 'Engineering Bay/Quasar Cannon.svg',
  'Shield Generator Pack': 'Engineering Bay/Shield Generator Pack.svg',
  'Supply Pack': 'Engineering Bay/Supply Pack.svg',

  // Robotics Workshop
  'Autocannon Sentry': 'Robotics Workshop/Autocannon Sentry.svg',
  'EMS Mortar Sentry': 'Robotics Workshop/EMS Mortar Sentry.svg',
  'Emancipator Exosuit': 'Robotics Workshop/Emancipator Exosuit.svg',
  'Gatling Sentry': 'Robotics Workshop/Gatling Sentry.svg',
  'Guard Dog': 'Robotics Workshop/Guard Dog.svg',
  'Machine Gun Sentry': 'Robotics Workshop/Machine Gun Sentry.svg',
  'Mortar Sentry': 'Robotics Workshop/Mortar Sentry.svg',
  'Patriot Exosuit': 'Robotics Workshop/Patriot Exosuit.svg',
  'Rocket Sentry': 'Robotics Workshop/Rocket Sentry.svg',

  // Patriotic Administration Center
  'Airburst Rocket Launcher': 'Patriotic Administration Center/Airburst Rocket Launcher.svg',
  'Anti-Materiel Rifle': 'Patriotic Administration Center/Anti-Materiel Rifle.svg',
  'Autocannon': 'Patriotic Administration Center/Autocannon.svg',
  'Commando': 'Patriotic Administration Center/Commando.svg',
  'Expendable Anti-Tank': 'Patriotic Administration Center/Expendable Anti-Tank.svg',
  'Flamethrower': 'Patriotic Administration Center/Flamethrower.svg',
  'Heavy Machine Gun': 'Patriotic Administration Center/Heavy Machine Gun.svg',
  'Machine Gun': 'Patriotic Administration Center/Machine Gun.svg',
  'Railgun': 'Patriotic Administration Center/Railgun.svg',
  'Recoilless Rifle': 'Patriotic Administration Center/Recoilless Rifle.svg',
  'Spear': 'Patriotic Administration Center/Spear.svg',
  'StA-X3 W.A.S.P. Launcher': 'Patriotic Administration Center/StA-X3 W.A.S.P. Launcher.svg',
  'Stalwart': 'Patriotic Administration Center/Stalwart.svg',

  // Bridge
  'Grenadier Battlement': 'Bridge/Grenadier Battlement.svg',
  'HMG Emplacement': 'Bridge/HMG Emplacement.svg',
  'Orbital EMS Strike': 'Bridge/Orbital EMS Strike.svg',
  'Orbital Gas Strike': 'Bridge/Orbital Gas Strike.svg',
  'Orbital Precision Strike': 'Bridge/Orbital Precision Strike.svg',
  'Orbital Smoke Strike': 'Bridge/Orbital Smoke Strike.svg',
  'Shield Generator Relay': 'Bridge/Shield Generator Relay.svg',
  'Tesla Tower': 'Bridge/Tesla Tower.svg',

  // Chemical Agents
  'Guard Dog Breath': 'Chemical Agents/Guard Dog Breath.svg',
  'Sterilizer': 'Chemical Agents/Sterilizer.svg',

  // Borderline Justice
  'Hover Pack': 'Borderline Justice/Hover Pack.svg',

  // Control Group
  'Epoch': 'Control Group/Epoch.svg',
  'Laser Sentry': 'Control Group/Laser Sentry.svg',
  'Warp Pack': 'Control Group/Warp Pack.svg',

  // Dust Devils
  'Expendable Napalm': 'Dust Devils/Expendable Napalm.svg',
  'Solo Silo': 'Dust Devils/Solo Silo.svg',
  'Speargun': 'Dust Devils/Speargun.svg',

  // Entrenched Division
  'Cremator': 'Entrenched Division/Cremator.svg',
  'Gas Mortar Sentry': 'Entrenched Division/Gas Mortar Sentry.svg',

  // Exo Experts
  'Breakthrough Exosuit': 'Exo Experts/Breakthrough Exosuit.svg',
  'Bullet Storm': 'Exo Experts/Bullet Storm.svg',
  'Lumberer Exosuit': 'Exo Experts/Lumberer Exosuit.svg',

  // Force of Law
  'GL-52 De-Escalator': 'Force of Law/GL-52 De-Escalator.svg',
  'Guard Dog K-9': 'Force of Law/Guard Dog K-9.svg',

  // Masters of Ceremony
  'One True Flag': 'Masters of Ceremony/One True Flag.svg',

  // Python Commandos
  'Defoliation Tool': 'Python Commandos/Defoliation Tool.svg',
  'Guard Dog Hot Dog': 'Python Commandos/Guard Dog Hot Dog.svg',
  'Maxigun': 'Python Commandos/Maxigun.svg',

  // Redacted Regiment
  'C4 Pack': 'Redacted Regiment/C4 Pack.svg',

  // Servants of Freedom
  'Hellbomb Portable': 'Servants of Freedom/Hellbomb Portable.svg',

  // Siege Breakers
  'Bastion MK XVI': 'Siege Breakers/Bastion MK XVI.svg',
  'CQC-20': 'Siege Breakers/CQC-20.svg',
  'EAT-411': 'Siege Breakers/EAT-411.svg',
  'GL-28': 'Siege Breakers/GL-28.svg',

  // Urban Legends
  'Anti-Tank Emplacement': 'Urban Legends/Anti-Tank Emplacement.svg',
  'Directional Shield': 'Urban Legends/Directional Shield.svg',
  'Flame Sentry': 'Urban Legends/Flame Sentry.svg',
}

export function stratagemIconUrl(iconRef: string): string | null {
  const path = ICON_PATHS[iconRef]
  if (!path) return null
  return `${CDN_BASE}/${path.split('/').map(encodeURIComponent).join('/')}`
}
