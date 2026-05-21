/**
 * Loadout sim — runs the REAL engine (no logic duplication) many times and
 * reports what actually gets recommended, so weight tweaks can be validated
 * scientifically instead of by clicking re-roll.
 *
 * Usage (via `npm run sim -- ...`):
 *   npm run sim -- --faction illuminate --sub appropriators
 *   npm run sim -- --faction terminids  --sub predator-strain --diff 9 --n 5000
 *   npm run sim -- --faction automatons --sub jet-brigade --top 8
 *
 * Flags:
 *   --faction   terminids | automatons | illuminate   (default illuminate)
 *   --sub       operation-modifier id (sub-faction)    (optional)
 *   --diff      difficulty 1-10                         (default 7)
 *   --n         rolls per scenario                      (default 2000)
 *   --mission   mission-type id                         (optional)
 *   --mods      extra modifier ids, comma-separated     (optional)
 *   --top       how many top items to list per slot     (default 5)
 *
 * When --sub is given, output is a BASE vs +SUB comparison so you can see
 * exactly what the sub-faction modifier shifts.
 */
import { generateRecommendation } from '@/engine'
import { catalogService } from '@/services/catalog'
import type { FactionId, MissionParams } from '@/types'

type Tagged = { name: string; tags?: string[] }

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const next = argv[i + 1]
    out[a.slice(2)] = next && !next.startsWith('--') ? argv[++i] : 'true'
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const faction = (args.faction ?? 'illuminate') as FactionId
const sub = args.sub
const difficulty = Number(args.diff ?? args.difficulty ?? 7)
const n = Number(args.n ?? 2000)
const missionType = args.mission ?? ''
const extraMods = (args.mods ?? '').split(',').filter(Boolean)
const top = Number(args.top ?? 5)

const SLOTS = ['primary', 'secondary', 'grenade', 'stratagem', 'armor', 'booster'] as const
type Slot = (typeof SLOTS)[number]

if (sub && !catalogService.getModifiers().some((m) => m.id === sub)) {
  console.error(`Unknown modifier id: "${sub}"\nOperation modifiers for ${faction}:`)
  catalogService.getOperationModifiers(faction).forEach((m) => console.error(`  ${m.id}  (${m.name})`))
  process.exit(1)
}

interface Result {
  tagPct: Record<string, number>
  slotTop: Record<Slot, [string, number][]>
}

function run(modifiers: string[]): Result {
  const params: MissionParams = { faction, difficulty, planet: '', missionType, modifiers }
  const tagCount: Record<string, number> = {}
  const slotCount: Record<Slot, Record<string, number>> = {
    primary: {}, secondary: {}, grenade: {}, stratagem: {}, armor: {}, booster: {},
  }
  const bump = (slot: Slot, it: Tagged | null) => {
    if (it) slotCount[slot][it.name] = (slotCount[slot][it.name] ?? 0) + 1
  }

  for (let i = 0; i < n; i++) {
    const lo = generateRecommendation(params)
    const items: (Tagged | null)[] = [
      lo.primaryWeapon, lo.secondaryWeapon, lo.grenade, ...lo.stratagems, lo.armor, lo.booster,
    ]
    const seen = new Set<string>()
    for (const it of items) for (const t of it?.tags ?? []) seen.add(t)
    for (const t of seen) tagCount[t] = (tagCount[t] ?? 0) + 1

    bump('primary', lo.primaryWeapon)
    bump('secondary', lo.secondaryWeapon)
    bump('grenade', lo.grenade)
    lo.stratagems.forEach((s) => bump('stratagem', s))
    bump('armor', lo.armor)
    bump('booster', lo.booster)
  }

  const tagPct: Record<string, number> = {}
  for (const [t, c] of Object.entries(tagCount)) tagPct[t] = (c / n) * 100
  const slotTop = {} as Record<Slot, [string, number][]>
  for (const slot of SLOTS) {
    slotTop[slot] = Object.entries(slotCount[slot])
      .map(([name, c]) => [name, (c / n) * 100] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
  }
  return { tagPct, slotTop }
}

const pct = (x: number) => `${x.toFixed(0)}%`.padStart(4)

console.log(`\n=== Loadout Sim ===`)
console.log(`faction: ${faction} | difficulty: ${difficulty} | rolls: ${n}${missionType ? ` | mission: ${missionType}` : ''}${extraMods.length ? ` | mods: ${extraMods.join(',')}` : ''}`)

const base = run(extraMods)
const withSub = sub ? run([...extraMods, sub]) : null

console.log(`\nTAG PRESENCE  (% of loadouts containing >=1 item with that tag)`)
if (withSub) {
  console.log(`scenario: base  vs  +${sub}\n`)
  const tags = [...new Set([...Object.keys(base.tagPct), ...Object.keys(withSub.tagPct)])]
  const rows = tags
    .map((t) => ({ t, b: base.tagPct[t] ?? 0, s: withSub.tagPct[t] ?? 0 }))
    .map((r) => ({ ...r, d: r.s - r.b }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
  console.log(`  ${'tag'.padEnd(16)}${'base'.padStart(5)}${('+' + sub).padStart(9)}${'Δ'.padStart(7)}`)
  for (const r of rows) {
    const d = `${r.d >= 0 ? '+' : ''}${r.d.toFixed(0)}`
    console.log(`  ${r.t.padEnd(16)}${pct(r.b)}${pct(r.s).padStart(9)}${d.padStart(7)}`)
  }
} else {
  const rows = Object.entries(base.tagPct).sort((a, b) => b[1] - a[1])
  for (const [t, p] of rows) console.log(`  ${t.padEnd(16)}${pct(p)}`)
}

const view = withSub ?? base
console.log(`\nTOP ITEMS  (% of loadouts)${sub ? `  — under +${sub}` : ''}`)
for (const slot of SLOTS) {
  const list = view.slotTop[slot].map(([name, p]) => `${name} ${pct(p).trim()}`).join('  •  ')
  console.log(`  ${slot.padEnd(10)} ${list}`)
}
console.log()
