# Helldivers 2 Loadout Recommender — Product Requirements Document

**Version:** 1.0 (V1 Scope)
**Last Updated:** May 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [App Structure & Navigation](#2-app-structure--navigation)
3. [Recommend Flow](#3-recommend-flow)
4. [Randomizer Flow](#4-randomizer-flow)
5. [Saved Loadouts](#5-saved-loadouts)
6. [Settings](#6-settings)
7. [Content Model & Data Architecture](#7-content-model--data-architecture)
8. [Recommendation Engine](#8-recommendation-engine)
9. [Cross-Platform & Responsive Behavior](#9-cross-platform--responsive-behavior)
10. [Design System & Component Spec](#10-design-system--component-spec)
11. [Performance & Offline Behavior](#11-performance--offline-behavior)
12. [Infrastructure & Deployment](#12-infrastructure--deployment)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Open Questions & Assumptions](#14-open-questions--assumptions)
15. [V2+ Backlog](#15-v2-backlog)

---

## 1. Executive Summary

### Problem

Helldivers 2 players face a recurring decision bottleneck at mission select: assembling a loadout optimized for a specific combination of faction, difficulty, objectives, modifiers, and environment. Current alternatives — community tier lists, YouTube guides, Reddit threads — are generic, outdated between patches, and don't account for mission-specific context.

### Solution

A Progressive Web App that takes mission parameters as input and returns an optimized loadout recommendation in under 60 seconds. The app accounts for faction, difficulty, planet conditions, modifiers, and mission type — variables that generic tier lists ignore. Players can swap individual items, re-roll for variety, randomize for exploration, and save loadouts for reuse.

### Target Users

**The Pragmatist (Primary):** 100–500 hours, mid-to-high skill. Knows the game, doesn't want to do the mental math every drop. Has go-to loadouts with known blind spots. Uses the app at the hellpod screen on their phone.

**The Learner (Secondary):** 20–100 hours, or returning after a break. Lacks the experience to optimize for specific scenarios. Overwhelmed by conflicting community advice. Wants a confident answer.

**The Experimenter (Tertiary):** 500+ hour veteran. Doesn't need help, wants inspiration. Uses the randomizer to break habits and try unexpected combinations.

**Squad Leader (V2):** Coordinates loadouts across a team of four to cover roles and fill gaps. Deferred — solo experience must be proven first.

### Design Principles

- **Speed is the feature.** If the app isn't faster than the player's gut instinct, it fails.
- **Progressive disclosure.** Surface confidence, offer depth. Don't front-load complexity.
- **The app should get smarter over time.** V1 achieves this through data freshness. V2+ explores user feedback as an additional signal.

### Success Criteria

- A user can go from app open to a complete loadout recommendation in under 60 seconds.
- The app is fully functional when the community API is unavailable (fallback flow).
- The app loads and renders for returning users with zero network dependency (service worker cache).
- Recommendations are meaningfully different across re-rolls for the same mission parameters.
- Quantitative metrics (retention, flow completion, drop-off) are deferred to post-launch once analytics are added.

### Value Proposition

Spend less time in the hellpod, more time in the field. Loadout recommendations that account for every mission variable, not just the meta.

### Competitive Differentiation

Democracy Hub (democracy-hub.net) is the most feature-rich existing tool — a loadout builder with randomization, slot locking, warbond filters, auto-optimization, weapon stats, enemy data, and a galactic war map. This app differentiates on two fronts: mission-context-aware recommendation (Democracy Hub is a manual builder with optimization layered on) and speed-first design (input four things, get a loadout — no builder interaction required).

---

## 2. App Structure & Navigation

### Top-Level Destinations

The app has four destinations, each accessible from the persistent navigation bar:

| Destination | Purpose | Default? |
|---|---|---|
| **Recommend** | Cascading mission input → optimized loadout results | Yes (landing screen) |
| **Randomizer** | Mode toggle → random loadout generation | No |
| **Saved Loadouts** | Local list of previously saved builds with staleness detection | No |
| **Settings** | Minimal configuration and legal information | No |

### Navigation Pattern

Bottom tab bar on mobile. Top navigation bar or sidebar on desktop/wider screens. Structurally identical — same four destinations, same order — repositioned for the platform.

**Tab order (left to right):** Recommend · Randomizer · Saved Loadouts · Settings

Primary actions (Recommend, Randomizer) sit at thumb level on mobile. No deeply nested content creates back-stack complexity.

### Explicitly Excluded from V1

About screen, tutorial/onboarding flow, news/updates feed. If the input flow isn't self-evident, that's a design problem to solve in the flow — not with onboarding.

---

## 3. Recommend Flow

The app's core function. A cascading input flow that collects mission parameters and automatically generates an optimized loadout.

### 3.1 Input Screen

**Page title:** "Build Your Loadout"

#### Progress Stepper

A 4-step stepper (5 in fallback mode) displayed below the page title. Each step is a numbered circle (1, 2, 3, 4) that changes to a checkmark icon when completed. The current active step is visually highlighted. The stepper serves orientation and signals when auto-generate will trigger.

#### Input Sequence

Inputs are presented as cascading, inline selectors. No dropdowns — all options are visible and tappable. Selections cascade: each input filters the options available in the next. Changes to any step reset all selections below it — no exceptions.

**Step 1 — Faction:** Segmented control with 3 options: Terminids, Automatons, Illuminate. Selected first because it filters the planet list significantly.

**Step 2 — Difficulty:** Numbered row of ~10 levels (1–10). Placed second because it is faction-agnostic. When a user changes faction, difficulty persists naturally above the reset point while everything below it clears.

**Step 3 — Planet:** Chip/pill selector, filtered by the selected faction. When live galactic map data is available, selecting a planet auto-infers active modifiers and environmental hazards (enabling the 4-step flow).

**Step 4 — Mission Type:** Chip selector, filtered by the selected planet and difficulty.

#### Progressive Reveal

Only the faction selector is visible at the start. All other input groups are hidden — not disabled or dimmed, but completely absent until revealed. When a user makes a selection, the next input group animates in with a fade-in transition, appearing with enough visual emphasis to guide the eye downward.

No auto-scrolling on desktop. On mobile, when the next input is below the fold, a gentle scroll (not a snap) brings it into view while keeping the previous selection visible.

#### Auto-Generate

The recommendation generates automatically after the user selects a mission type (the final input). There is no explicit "generate" button. The stepper reaching completion combined with auto-generate creates a natural, expected transition.

#### Loading States

When async data is needed (e.g., planet list after faction selection), a skeleton state appears in the area where the selector will render. The skeleton resolves to the populated selector once data loads.

#### Error States — Input Data Failures

**First failure** (e.g., planet data fails to load): Inline error message where the selector would appear, plus a retry button. The skeleton transitions to this error state.

**Second consecutive failure:** Same error message plus a secondary option: "Or continue without planet data." This drops the user into the fallback flow with manual modifier input. The stepper adjusts to show 5 steps.

**API known to be down on app launch:** Skip straight to the fallback flow. Display a subtle banner: "Live planet data unavailable — using manual input."

#### Error State — Recommendation Engine Failure

If the engine fails after all inputs are provided: full-screen error state with a retry button. All user inputs are preserved so they don't need to re-enter selections. Copy: "Something went wrong generating your loadout. Try again."

#### Fallback Flow (No Live Data)

If the community API is unavailable, modifiers surface as an additional 5th input step using multi-select chips. The progress stepper adjusts to show 5 steps. The app remains fully functional — it just requires more manual input. A subtle banner communicates: "Live planet data unavailable — using manual input."

#### Transition to Results

Results animate in as a separate view — not rendered in-place on the input screen. A skeleton state displays while the engine generates, then resolves to the full loadout.

### 3.2 Results Screen

**Screen title:** "Recommended Loadout"

#### Header

- **Back arrow** (left): Returns to the input screen with all selections preserved.
- **Start over action** (right): Clears all inputs, returns to the initial faction-only state.
- **Mission parameter summary** below header: Displays the selected parameters as a condensed string, e.g., "Automatons · Malevelon Creek · Difficulty 7 · Blitz."

#### Loadout List

Vertical list, one item per row. Grouped by category with subtle section dividers.

**Weapons section:** Primary Weapon, Secondary Weapon, Grenade — 3 rows.

**Stratagems section:** 4 stratagem slots — 4 rows.

**Armor & Booster section:** Armor (with passive ability called out), Booster — 2 rows.

**Total: 9 rows.**

#### Loadout Row Contents

Each row contains:

- **Icon:** Actual stratagem SVG icons for stratagem slots (sourced from community GitHub SVG set). Generic silhouette category icons for weapons, grenade, armor, and booster.
- **Item name + key stat/tag:** Text label readable on its own. The icon enhances recognition but is not the sole identifier.
- **Info action:** Tapping triggers an accordion expand below the row with a brief role description — 1–2 sentences on what this item contributes to the loadout. Accordion keeps the user in context and supports opening multiple rationales simultaneously. Each accordion tracks its own open/closed state independently.
- **Swap action:** Tapping opens a bottom sheet (mobile) or modal/popover (desktop) with 2–3 alternative items. Each alternative includes a one-line rationale. The user taps their preferred alternative, the sheet closes, and the row updates.

#### Bottom Actions

- **Save Loadout:** Primary button, prominently displayed. Tapping triggers a toast notification confirming the save.
- **Re-roll:** Text link (secondary visual weight). Regenerates a new recommendation using the same mission parameters.

Save and Re-roll are visually distinct to prevent accidental taps — Save is the primary filled button, Re-roll is a text link only.

#### Re-Roll Behavior

When re-rolled, items that changed from the previous recommendation get a loading/transition animation and a "new" pill/flag for quick scanning. Items that remained the same stay static. The engine re-runs its weighted random selection with the same scores — some items stay (they dominated their slot), some change.

#### Partial Loadout Handling

If the engine returns a partial result (some slots empty): show populated slots normally. Empty slots display placeholder text ("Couldn't generate a recommendation") with the swap action still functional on that slot. Re-roll still works on the full loadout. The user is never stuck.

If the engine returns nothing (zero slots filled): full failure error state with a retry button.

#### Excluded Slots

Helmet and cape are cosmetic-only in Helldivers 2 — excluded from recommendations entirely. They do not appear in the loadout list.

---

## 4. Randomizer Flow

A separate flow serving exploration, habit-breaking, and content creation use cases.

### 4.1 Entry Screen

**Page title:** "Random Loadout"

- **Generate button:** Prominent primary action.
- **Safety toggle:** Standard on/off switch below the generate button. Default state: Safety On (constrained random).
- **Safety Off description:** Only visible when the toggle is in the off position. Punchy copy warning that the loadout will not be geared toward effectiveness.

### 4.2 Two Modes

**Constrained Random (Safety On, default):** Random selections with guardrails — no duplicate stratagem types, basic role coverage (anti-armor, crowd control), faction-appropriate weapons. Output is unexpected but playable.

**Full Random / Safety Off:** True anything-goes randomization. No rules, no logic. Can produce absurd or unplayable loadouts.

### 4.3 No Mission Inputs

The randomizer does not ask for mission parameters. Specifying mission details to get a random output is contradictory.

### 4.4 Randomizer Results Screen

Uses the same loadout list layout and row components as the Recommend results screen, with these differences:

- **Header title:** "Random Loadout"
- **No mission parameter summary** (none exists).
- **No rationale accordions** (there is no "why" for random selections).
- **Back arrow** returns to the randomizer entry screen with the toggle state preserved.
- **No "Start Over" action** (nothing to clear — the user just hits Generate again).
- **Swap behavior in constrained mode:** Works normally — alternatives are drawn from the same constrained pool.
- **Swap behavior in full random mode:** Re-randomizes that individual slot with no constraints.
- **Save and Re-roll:** Same placement and visual treatment as the Recommend results screen.

---

## 5. Saved Loadouts

Local-only persistence of previously generated loadouts with staleness detection.

### 5.1 List View

**Flat list** — no tabs, no sections separating recommended from randomized. Most recent at top. No sort controls in v1.

**Recommended loadout rows:** Faction icon + auto-generated label from mission parameters (e.g., "Automatons · Malevelon Creek · Difficulty 7 · Blitz").

**Randomized loadout rows:** No faction icon + label indicating the generation mode (e.g., "Randomized · Constrained" or "Randomized · Safety Off").

The visual difference between recommended (faction icon + mission params) and randomized (no icon + mode label) makes them immediately distinguishable without structural separation.

#### Staleness Reminder

A subtle informational line near the top of the list: "Loadouts may contain items affected by game updates. Open a loadout to check."

#### Delete

- **Swipe-to-reveal** on mobile + **visible delete action** on each row for discoverability and web compatibility.
- **Confirmation dialog** before deletion: "Delete this loadout?" with Cancel and Delete actions.

#### Empty State

- Message: "No loadouts have been saved yet"
- Two CTAs: "Generate a recommended loadout" and "Generate a random loadout" — functional nudges pointing to the two generation flows.

#### Loading State

Skeleton list items (2–3 placeholder rows) while local storage loads.

#### Storage Limit

Ceiling of 50 saved loadouts. Toast warning when approaching the limit (e.g., at 45 saved). Revisit with better management tools in v2.

### 5.2 Detail View

Tapping a saved loadout opens it in the results screen layout (a separate view, not inline expand).

- **Back arrow** labeled "Saved Loadouts" — returns to the list.
- **No "Start Over" action.**
- **Read-only in v1** — no editing, no swapping, no re-optimizing.

#### Staleness Flags

Visible on items that have changed or been removed since the loadout was saved. The staleness check happens on detail view load, not on the list screen (avoids checking every item in every loadout every time the list renders).

**Changed item** (buffed/nerfed): Subtle indicator + "Updated since saved — stats may have changed."

**Removed item:** Different indicator + "No longer available."

No auto-substitution. The user sees the flag and can generate a new recommendation if needed.

---

## 6. Settings

Minimal configuration screen for v1. Four items in a simple list:

- **Clear saved loadouts:** Destructive action with confirmation dialog: "Delete all saved loadouts? This can't be undone."
- **App version:** Static text display. Essential for bug reports.
- **Acknowledgments:** Link to a text screen crediting community API data, open-source SVG icon set, and any other third-party resources.
- **Non-affiliation disclaimer:** "Not affiliated with Arrowhead Game Studios or Sony Interactive Entertainment."

### Explicitly Excluded from V1

- **Theme toggle:** The app ships dark-only (see Design System section). No light mode, no toggle.
- **Language/localization:** Touches every string in the app. Ship English-only. Add localization in v2 based on actual user base geography.

---

## 7. Content Model & Data Architecture

### 7.1 Data Objects

#### Loadout

The core output. A container that *references* equipment items — it does not contain them. This referencing model enables staleness detection: when an item's data updates in the catalog, the loadout's reference stays the same, and the app can compare the saved reference against the current catalog to detect changes.

| Field | Type | Notes |
|---|---|---|
| id | string | Unique identifier |
| primaryWeapon | reference | → Weapon object |
| secondaryWeapon | reference | → Weapon object |
| grenade | reference | → Weapon object (grenade category) |
| stratagems | reference[] | → 4 Stratagem objects |
| armor | reference | → Armor object |
| booster | reference | → Booster object |
| faction | string | Faction name (for recommended loadouts) |
| planet | string | Planet name (for recommended loadouts) |
| difficulty | number | 1–10 (for recommended loadouts) |
| missionType | string | Mission type name (for recommended loadouts) |
| generationMode | enum | "recommended" / "constrained_random" / "full_random" |
| createdAt | timestamp | When the loadout was generated/saved |

#### Weapon

Covers primary, secondary, and grenade categories.

| Field | Type | Notes |
|---|---|---|
| id | string | Unique identifier |
| name | string | Display name |
| category | enum | "primary" / "secondary" / "grenade" |
| tags | string[] | Functional descriptors: anti-armor, explosive, crowd-control, etc. Used by the engine for matching. |
| source | string | Warbond, base game, superstore, etc. Not surfaced in v1 UI — captured for future ownership filter. |
| iconRef | string | Reference to icon asset |
| lastUpdated | timestamp | Powers staleness detection |

**Note:** Detailed stat blocks (damage, fire rate, etc.) are excluded from v1. The engine works off trait tags, not numerical stats.

#### Stratagem

| Field | Type | Notes |
|---|---|---|
| id | string | Unique identifier |
| name | string | Display name |
| category | enum | Offensive / Defensive / Support |
| subType | enum | Eagle / Orbital / Other |
| tags | string[] | anti-armor, area-denial, resupply, mobility, etc. |
| cooldownTier | enum | short / medium / long — rough indicator for loadout balance |
| callInType | enum | single-use / multi-use / persistent — affects sustainability reasoning |
| iconRef | string | Reference to community SVG icon |
| source | string | Warbond, base game, etc. |
| lastUpdated | timestamp | Powers staleness detection |

#### Armor

| Field | Type | Notes |
|---|---|---|
| id | string | Unique identifier |
| name | string | Display name |
| passive | string | Passive ability name/description |
| armorTier | enum | light / medium / heavy |
| iconRef | string | Reference to icon asset |
| source | string | Warbond, base game, etc. |
| lastUpdated | timestamp | Powers staleness detection |

#### Booster

| Field | Type | Notes |
|---|---|---|
| id | string | Unique identifier |
| name | string | Display name |
| effect | string | Effect description |
| tags | string[] | Functional descriptors |
| source | string | Warbond, base game, etc. |
| lastUpdated | timestamp | Powers staleness detection |

#### Faction

Three entries: Terminids, Automatons, Illuminate.

| Field | Type | Notes |
|---|---|---|
| id | string | Unique identifier |
| name | string | Display name |
| icon | string | Reference to faction icon |
| enemyProfile | object | High-level description of the faction's characteristic enemy mix. Tells the engine which weapon/stratagem traits to prioritize. Not a detailed enemy database — faction-level profiling is sufficient for v1. |

#### Planet (Live Data)

| Field | Type | Notes |
|---|---|---|
| name | string | Display name |
| faction | string | Which faction currently controls/contests it. Powers faction → planet filtering. |
| hazards | string[] | Environmental hazards: extreme cold, heat, acid storms, etc. Affects armor/gear choices. |
| modifiers | reference[] | Active mission modifiers currently in effect. Enables skipping manual modifier input. |

Planet data is live — faction control and modifiers shift with the galactic war. Fetched from the community API and cached locally.

#### Mission Type

| Field | Type | Notes |
|---|---|---|
| id | string | Unique identifier |
| name | string | Display name |
| tags | string[] | Objective characteristics: defend-objective, escort, time-pressure, etc. |
| availability | object | Which difficulty levels and planets this mission type appears on. Powers input cascade filtering. |

#### Modifier

| Field | Type | Notes |
|---|---|---|
| id | string | Unique identifier |
| name | string | Display name |
| effectTags | string[] | What the modifier does in recommendation-engine terms |
| severity | enum | low / medium / high — rough weight indicator |
| constraintType | enum | **hard** (e.g., AA Defenses = exclude all Eagle stratagems) or **soft** (e.g., Fog = deprioritize long-range weapons). The engine treats these differently. |

#### Difficulty

Just a number (1–10). No dedicated object. Relationships to enemy intensity and available mission types live in the recommendation engine logic.

### 7.2 Key Relationships

- **Loadout** references → Weapons (3), Stratagems (4), Armor (1), Booster (1), plus mission context.
- **Faction** → filters available Planets.
- **Planet** → carries Environmental Hazards and Active Modifiers, belongs to a Faction.
- **Mission Type** → filtered by Planet and Difficulty.
- **Modifiers** → either inferred from Planet (live data) or manually selected (fallback).
- **All equipment objects** carry traits/tags that the recommendation engine matches against mission context.

### 7.3 Data Storage Architecture

| Data Category | What | Storage | Update Mechanism | Network Required |
|---|---|---|---|---|
| Static game data | Equipment catalog (weapons, stratagems, armor, boosters, factions, mission types, modifiers) | Bundled JSON file, deployed with the app | Redeployed when the game patches | No |
| Live data | Galactic war state (planets, faction control, active modifiers, hazards) | Fetched from community API → cached locally 10–15 min | Prefetched on app load; fetched on demand if cache is stale | Yes (degrades gracefully to fallback flow) |
| User data | Saved loadouts (up to 50), safety toggle state | Browser IndexedDB on device | User actions (save, delete) | No |

**Why bundled JSON for the catalog:** The catalog is small (~100–150 items, kilobytes of data). Bundling eliminates server dependencies for the app's core function. The app works with zero network connectivity for everything except live planet data. Redeployment cadence (every few weeks when HD2 patches) is manageable for a solo creator.

**Why IndexedDB over localStorage:** IndexedDB provides structured storage with better capacity and performance for the 50-loadout ceiling. localStorage is limited to string key-value pairs with a 5–10MB cap.

### 7.4 Service Layer Abstraction

Three structural patterns to follow during development for clean v2 migration:

**Data access behind a clean interface.** UI components never touch IndexedDB directly. A service layer provides functions like `saveLoadout()`, `getLoadouts()`, `deleteLoadout()`. When v2 swaps local storage for a server API, only the service internals change.

**Equipment catalog behind a data service.** The app doesn't import the JSON file directly in multiple places. A service provides `getWeapons()`, `getStratagems()`, etc. If v2 moves the catalog to a server, the service changes internally but the interface stays the same.

**Recommendation engine as a standalone module.** The engine takes mission parameters in and returns a scored loadout out. It knows nothing about UI components, screen state, or user interactions. This makes it testable in isolation (crucial for weight tuning) and portable to server-side if needed.

**Consistent data shape.** The loadout object defined above is the single canonical format everywhere: saved to storage, returned by the engine, displayed by the UI, and eventually returned by a server API. No translation layers needed.

---

## 8. Recommendation Engine

The engine runs entirely client-side in the browser. No server, no API call, no latency. Execution time is sub-millisecond — the equipment catalog is small and the scoring logic is simple arithmetic.

### 8.1 Architecture: Three Layers

#### Layer 1 — Hard Constraints (Binary Filters)

Rules that remove items from consideration entirely before scoring begins. These map to the "hard" constraint type on Modifier objects.

Examples:
- AA Defenses modifier → exclude all Eagle stratagems.
- Grenade slot → only consider items tagged as grenades.
- Slot-level category filtering (primary weapons for the primary slot, etc.).

This layer is small, explicit, and easy to maintain. It handles cases where scoring nuance would be wrong — you don't deprioritize Eagle stratagems when AA Defenses is active, you exclude them.

#### Layer 2 — Weighted Scoring

Every item that survives the constraint filter gets scored against the mission context. Scoring factors:

- **Faction match:** Does this item's trait profile align with the faction's enemy composition? Anti-armor weapons score higher against Automatons.
- **Difficulty scaling:** Does this item become more or less valuable at higher difficulties? Anti-tank stratagems score higher at difficulty 7+.
- **Modifier adjustments:** Soft modifiers shift weights without excluding items. Fog deprioritizes long-range weapons. Tremors deprioritizes stationary turrets.
- **Environmental fit:** Extreme cold or heat favoring certain armor passives.
- **Role coverage:** The engine checks what roles are already filled in the loadout-in-progress and boosts scores for unfilled roles, ensuring balanced coverage (anti-armor, crowd control, support/resupply) rather than stacking one role.
- **Cooldown balance:** Avoids recommending four long-cooldown stratagems by scoring cooldown diversity.

#### Layer 3 — Controlled Randomness

Instead of always selecting the single highest-scored item per slot, the engine picks from a weighted random selection of the top N candidates. Higher-scored items are more likely to be selected, but lower-scored alternatives still have a chance. This produces variety across re-rolls — same inputs yield genuinely different loadouts because the randomness resolves differently each time.

### 8.2 Engine → UX Feature Mapping

| UX Feature | Engine Behavior |
|---|---|
| **Auto-generate** | Run full pipeline (constraints → scoring → weighted random) after the final input. |
| **Re-roll** | Re-run weighted random selection with the same scores. Some items stay (they dominated their slot), some change. Changed items get the "new" pill indicator in the UI. |
| **Swap alternatives** | Display the next 2–3 highest-scored items for that slot in the bottom sheet/modal. Rationale text generated from dominant scoring factors. |
| **Constrained random (Randomizer, Safety On)** | Skip Layer 2 scoring. Keep Layer 1 constraints + role coverage checks. Random selection from the filtered pool. |
| **Full random (Randomizer, Safety Off)** | Skip all layers. Pure random from the complete item list. No constraints, no logic. |
| **Rationale text (Info accordion)** | Human-readable translation of dominant scoring factors: "Recommended for anti-armor capability against Automatons at high difficulty." |

### 8.3 Weight Sourcing & Calibration

**V1 source:** Hand-tuned weights based on game knowledge and community meta consensus. Weights are numbers stored in the bundled equipment catalog JSON alongside item traits.

**Calibration reference:** helldive.live tracks weapon and stratagem pick rates from actual player loadouts. This data serves as a sanity check during weight tuning — not as a live input to the engine. If the engine never recommends an item that has significant community pick rate, the weights may be too narrow. If it frequently recommends items with near-zero pick rate, the weights may be miscalibrated.

**Update cadence:** Weights are reviewed and adjusted alongside equipment catalog updates when the game patches.

---

## 9. Cross-Platform & Responsive Behavior

### 9.1 Breakpoints

Two breakpoints: **mobile** (up to 768px) and **desktop** (768px+). No distinct tablet layout — tablet gets the desktop layout at comfortable width. The content doesn't benefit from multi-column grids or split-views.

### 9.2 Where the Experience Diverges

**Navigation chrome:** Bottom tab bar on mobile. Top nav bar or sidebar on desktop. Same four destinations, same order — repositioned.

**Bottom sheets → modals/popovers:** The swap bottom sheet is a mobile-native pattern. On desktop, a modal or anchored popover near the row. Same content, different container.

**Swipe-to-delete on saved loadouts:** Mobile-native gesture. On web, the visible delete action on each row handles it. Mobile gets both (swipe + visible); web gets visible only.

**Auto-scroll on progressive reveal:** Mobile gets a gentle scroll when the next input is below the fold. Desktop doesn't auto-scroll — viewports are tall enough that progressive reveal stays in-view.

### 9.3 Where It Stays the Same

Input flow, results layout, randomizer, saved loadouts structure, and settings are all identical across platforms. The vertical list layout, accordion expands, and stepper work the same everywhere.

---

## 10. Design System & Component Spec

### 10.1 Theme

**Dark-only.** The HD2 ecosystem is universally dark-themed — game UI, wiki, community tools all use dark backgrounds. A light mode adds real work (doubled color tokens, doubled QA surface) for zero user value in this audience. Ship dark-only. Define one set of color tokens. If user demand for light mode ever emerges, the token structure supports adding a second variant set later.

### 10.2 Color Tokens

The palette should evoke the Helldivers 2 aesthetic — militaristic, utilitarian, high-contrast for readability on dark backgrounds. These are foundational tokens; the developer should interpret them as a starting point within this design direction.

| Token | Purpose | Guidance |
|---|---|---|
| `--color-bg-primary` | Main app background | Near-black. Dark gray-blue or neutral dark, not pure #000. |
| `--color-bg-secondary` | Card/surface background | Slightly elevated from primary. Subtle lift, not dramatic contrast. |
| `--color-bg-tertiary` | Nested surfaces (accordion content, bottom sheet) | One more step up. Enough contrast to distinguish layers. |
| `--color-text-primary` | Primary text (item names, headings) | High contrast white or near-white. |
| `--color-text-secondary` | Supporting text (tags, rationale, summaries) | Muted but readable. ~70% opacity white equivalent. |
| `--color-text-disabled` | Placeholder text, inactive elements | Low but perceptible contrast. |
| `--color-accent` | Primary action buttons, active stepper step, selected chips | A bold accent. HD2-inspired yellow-gold is a strong candidate — it's iconic to the franchise without being a direct IP lift. Alternatively, a saturated blue or teal. Must pass contrast checks against dark backgrounds. |
| `--color-accent-muted` | Hover/pressed states on accent elements | Dimmed version of the accent. |
| `--color-border` | Dividers, section separators, card outlines | Subtle, low-contrast. Just enough to delineate, not to distract. |
| `--color-error` | Error messages, error states | Standard red, adjusted for dark background readability. |
| `--color-success` | Toast confirmations, checkmarks | Standard green, adjusted for dark background readability. |
| `--color-warning` | Staleness indicators, storage limit warnings | Amber/orange, adjusted for dark background readability. |
| `--color-new-indicator` | "New" pill on re-rolled items | Can match accent or use a distinct highlight color. |

#### Faction Colors (Optional Enhancement)

If desired, faction-specific accent tints can subtly color the mission parameter summary or faction icon on the results screen. These should be secondary to the main accent — a hint, not a theme change:
- Terminids: warm orange/amber
- Automatons: cold steel blue
- Illuminate: violet/purple

### 10.3 Typography

| Token | Size | Weight | Usage |
|---|---|---|---|
| `--type-heading-lg` | 24px | Bold | Screen titles ("Build Your Loadout", "Recommended Loadout") |
| `--type-heading-md` | 18px | Semibold | Section headers (Weapons, Stratagems, Armor & Booster) |
| `--type-body` | 16px | Regular | Item names, rationale text, general content |
| `--type-body-sm` | 14px | Regular | Tags, supporting text, mission parameter summary |
| `--type-caption` | 12px | Regular | Staleness messages, timestamps, fine print |

Use a system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) for performance and native feel. No custom web fonts needed for v1.

### 10.4 Spacing & Layout

Base unit: **4px**. All spacing should be multiples of 4px.

| Token | Value | Usage |
|---|---|---|
| `--space-xs` | 4px | Tight internal padding (icon-to-text gap within a row) |
| `--space-sm` | 8px | Standard internal padding |
| `--space-md` | 16px | Content gaps between elements in a section |
| `--space-lg` | 24px | Section spacing, card padding |
| `--space-xl` | 32px | Screen-level padding, major section separation |

**Border radius:** `--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 12px`. Chips, buttons, and cards use `--radius-md`. Toggle switches use `--radius-lg`. Sharp corners (`0px`) for section dividers and full-width elements.

### 10.5 Component Inventory

#### Shared / Reused Heavily

- **Segmented control** — Faction selector. 3 segments, equal width, clear selected state.
- **Chip/pill selector** — Planets, mission types, modifiers in fallback. Multi-row wrapping layout. Clear selected state, clear unselected state.
- **Numbered row selector** — Difficulty. 10 numbered circles in a row. Selected state clearly distinct.
- **Progress stepper** — 4-step (5 in fallback). Numbered circles → checkmark on completion. Active step highlighted.
- **Loadout row** — The workhorse component. Contains: icon slot, item name + tag text, info action trigger, swap action trigger. Handles accordion child (rationale expand) and empty/placeholder state. Used on Recommend results, Randomizer results, and Saved Loadout detail.
- **Accordion expand** — Nested inside loadout row. Each instance tracks its own open/closed state independently (not single-open). Contains 1–2 sentences of rationale text.
- **Bottom sheet (mobile) / Modal-popover (desktop)** — Swap alternatives container. Content-height with a max-height cap (~60% of viewport), scrollable internally if content exceeds. Contains 2–3 alternative item rows with rationale.
- **Section divider** — Subtle horizontal rule between loadout category groups.
- **Primary button** — Save Loadout, Generate (randomizer). Filled, uses accent color.
- **Text link / secondary action** — Re-roll, Start Over. Understated, no fill.
- **Toast notification** — Save confirmation, storage limit warning. Auto-dismissing.
- **Confirmation dialog** — Delete loadout, clear all saved loadouts. Cancel + destructive action.
- **Toggle switch** — Safety mode on the randomizer.
- **Skeleton loader** — Placeholder for list items and selector areas during loading.
- **Inline error + retry** — Error state for failed data fetches within the input flow.
- **Banner** — API fallback notification. Subtle, informational, non-blocking.
- **Empty state** — Saved loadouts empty list. Message + two CTA buttons.

#### Limited Use

- **Mission parameter summary bar** — Results header only.
- **"New" pill/flag** — Re-roll change indicator on loadout rows.
- **Staleness indicator** — Saved loadout detail view items only.
- **Saved loadout list row** — Faction icon + auto-label or "Randomized" label. Distinct from the full loadout row component (no actions, no accordion).

### 10.6 Key Component: Loadout Row

The most complex component in the app. It contains an icon slot, text content, two action triggers, an accordion child, and the accordion content itself. It also handles empty/placeholder state for partial loadouts. Getting this component right covers a huge percentage of the app's surface area.

**Implementation note on accordion behavior:** Multiple rationale accordions can be open simultaneously (per spec). Each accordion tracks its own open/closed state independently — not a single "which one is open" value. This must be called out explicitly so the developer doesn't default to single-open accordion behavior.

### 10.7 Animations & Transitions

All animations are CSS-only (opacity, transform). GPU-accelerated, performant on mobile. No JS-driven animation (spring physics, gesture-driven transitions) for v1.

| Animation | Type | Duration |
|---|---|---|
| Progressive reveal (input fade-in) | opacity + translateY | 200–300ms ease-out |
| Results screen transition | opacity or slide-in | 250–350ms ease |
| Re-roll item change | opacity fade-out/in | 200ms |
| Accordion open/close | max-height + opacity | 200ms ease |
| Skeleton pulse | opacity keyframe loop | Continuous, subtle |
| Toast appear/dismiss | translateY + opacity | 200ms in, auto-dismiss after 3s |

### 10.8 Icons

**Two tiers:**

- **Stratagem icons:** Actual SVGs from a community-maintained icon set (see Assumption A-2). These are the highest-fidelity icons in the app.
- **Everything else:** Generic silhouette category icons from an existing icon library (Lucide, Phosphor, or similar). Assault rifle silhouette for primary weapons, pistol for secondary, explosion for grenade, shield for armor, arrow-up for booster. Don't build custom icons — use a subset of an existing open-source icon library.

---

## 11. Performance & Offline Behavior

### 11.1 The 60-Second Constraint

The app must deliver value in under 60 seconds from open to recommendation. The architecture naturally supports this:

| Step | Time |
|---|---|
| App load (returning user) | ~0s (service worker cache) |
| App load (first-time visitor) | <1s (small bundle, no heavy assets) |
| User input (4 taps) | ~5–15s (user decision time) |
| API fetch for planet data | 0s if prefetched, <1s if not |
| Engine scoring | <1ms (client-side arithmetic) |
| Results render | Negligible |

The bottleneck is user decision-making time, not app performance.

### 11.2 Caching Strategy

| What | Duration | Mechanism |
|---|---|---|
| App shell (HTML, JS, CSS) | Until next deployment | Service worker |
| Bundled equipment catalog | Until next deployment | Service worker (part of app bundle) |
| Live planet/faction data | 10–15 minutes | In-memory or sessionStorage |

### 11.3 API Prefetch

On app load, fire off the planet data API call in the background before the user has selected a faction. By the time they tap a faction, the data is likely already cached locally. Faction selection then filters the already-loaded list — zero perceived latency.

If the prefetch fails silently, the app falls back to fetching on faction selection (with skeleton loading state), then to the manual fallback flow if that also fails.

### 11.4 Offline Behavior

The app is not offline-first. The primary use case assumes an internet connection. However, the PWA architecture provides useful offline behavior almost for free:

| Capability | Works Offline | Notes |
|---|---|---|
| App loads and renders | Yes | Service worker serves cached app shell |
| Equipment catalog available | Yes | Bundled with the app |
| Saved loadouts accessible | Yes | Stored in IndexedDB on device |
| Recommendation engine runs | Yes | Client-side logic on bundled data |
| Live planet data (4-step flow) | No | Requires API call — degrades to manual input |
| Manual modifier input (5-step fallback) | Yes | All data needed is bundled |

An offline user can still get a recommendation — they just provide modifiers manually instead of having them auto-inferred.

### 11.5 What Doesn't Need Optimization

- **Rendering performance:** Vertical list of 9 items with text and icons. Trivial UI complexity.
- **Animation performance:** CSS-only transitions are GPU-accelerated.
- **Storage performance:** 50 loadouts in IndexedDB is negligible.
- **Bundle size:** At this app's scale, aggressive code splitting or lazy loading is over-engineering.

---

## 12. Infrastructure & Deployment

### 12.1 Platform

Progressive Web App (PWA). Single codebase deployed as a web application. On mobile, users can install to home screen for an app-like experience (full screen, no browser chrome).

**PWA setup:** Requires a manifest file (app name, icon, splash screen, display mode) and a service worker (caching). Both should be set up early in development — not bolted on at the end.

### 12.2 Hosting

Vercel or Netlify (choose based on preference). Free-tier static hosting with global CDN, automatic deployments from a Git repository. Both handle PWA service worker registration and caching headers correctly.

**Cost:** Free tier. Static site with no server-side processing — hosting costs are effectively zero.

### 12.3 Distribution

Direct links, community sharing (Reddit, Discord, HD2 community hubs), and SEO. No app store listings needed.

### 12.4 Community API

**Primary source:** `api.helldivers2.dev`

- Provides planet status, faction control, active modifiers, campaigns, and environmental data in JSON format.
- No authentication required for default rate limits.
- Requests should include an `X-Super-Client` header identifying the app (will become mandatory in a future API version).
- Multiple companion projects (Diveharder API, Helldivers Training Manual API) provide similar data as alternative fallback sources.

**Integration points:**
- Faction → Planet list: Called on faction selection (or prefetched on app load).
- Planet → Modifiers & Hazards: Called on planet selection.

**Fallback behavior:** Three-tier degradation:
1. Serve from local cache if fresh (10–15 min window).
2. Fetch from API on demand if cache is stale.
3. Fall back to manual modifier input (5-step flow) if API is unreachable.

### 12.5 Services Not Needed for V1

| Service | Why Not |
|---|---|
| Backend server | No server-side logic. Equipment data is bundled, live data comes from community API, user data is local. |
| Database | IndexedDB handles saved loadouts. Equipment catalog is a JSON file. |
| Authentication | No user accounts in v1. |
| Payment processing | No monetization in v1. |
| Push notifications | Not needed for the use case. |

### 12.6 Optional Post-Launch Additions

**Analytics:** Plausible or Umami — privacy-focused, cookie-free. Provides basic usage data (page views, flow completion, drop-off) without GDPR overhead. Can be added with no architectural changes.

**Error monitoring:** Sentry (free tier). Captures JavaScript errors with stack traces and browser context. Can be added with no architectural changes.

---

## 13. Non-Functional Requirements

### 13.1 Accessibility

- All interactive elements must be keyboard-navigable.
- Color contrast ratios must meet WCAG AA for text on dark backgrounds.
- Interactive elements must have sufficient touch targets (minimum 44x44px on mobile).
- Icon-only actions (info, swap) must have accessible labels.
- Screen reader support for the progress stepper (current step, total steps).
- Focus management on view transitions (results screen, bottom sheet/modal open).

### 13.2 Error Handling Patterns

The app defines three tiers of error handling:

**Inline recoverable (input data failures):** Error message appears where the content would have rendered, plus a retry button. After a second failure, offer the fallback path. Never blocks the entire screen.

**Full-screen recoverable (engine failure):** Full-screen error with retry button. Preserves all user inputs. Clear copy explaining what went wrong.

**Graceful degradation (API unavailability):** App detects API status and adjusts the flow automatically. Banner communicates the state change. The user is never stuck — there is always a path to a recommendation.

### 13.3 Loading State Patterns

Skeleton loaders for all async content: selector areas waiting for data, list items loading from storage, results generating. No spinner wheels. Skeletons should approximate the shape of the content they replace for visual continuity.

### 13.4 Storage Limits

- Maximum 50 saved loadouts in IndexedDB.
- Toast warning at 45 saved loadouts approaching the limit.
- If the limit is reached, the user must delete existing loadouts before saving new ones.

### 13.5 Browser Support

Modern evergreen browsers: Chrome, Firefox, Safari, Edge (latest 2 versions). No IE11 support. PWA install-to-home-screen functionality depends on browser support (Chrome and Edge on Android, Safari on iOS with limitations).

### 13.6 Security

- No user authentication, no sensitive data handled.
- Community API calls are read-only GET requests, no credentials transmitted.
- IndexedDB data is local to the browser and domain — no cross-origin access.
- Include `X-Super-Client` header on API requests per community API guidelines.

---

## 14. Open Questions & Assumptions

### Open Questions

| ID | Question | Impact | Status |
|----|----------|--------|--------|
| OQ-2 | Where do item images/icons come from beyond stratagem SVGs? | Determines visual richness of results screen. Generic silhouette icons are the v1 plan. Community asset sources to be evaluated during development. | Open — resolve during development |
| OQ-4 | Should the saved loadouts list show a staleness indicator on list items without opening the detail view? | Would be more informative but adds complexity. | Deferred to v2 — revisit based on user feedback |

### Assumptions

| ID | Assumption | Risk if Wrong | Mitigation |
|----|-----------|---------------|------------|
| A-1 | The recommendation engine assumes the player has access to all items. | If too many recommendations include inaccessible items, the experience feels irrelevant. | Swap feature shows 2–3 alternatives. V2 ownership filter. |
| A-2 | A community-maintained SVG icon set for stratagems is available and sufficiently complete. | Stratagem slots fall back to generic icons or text-only. | Degrade gracefully; icons are enhancement, not sole identifier. |
| A-3 | The fallback flow (manual modifier input) is acceptable UX if live data is unreliable. | Most users experience the longer flow, weakening the speed value prop. | Three-tier API fallback minimizes frequency. |
| A-4 | Three factions is the current state of the game. | Data model handles it fine; segmented control UI needs a layout adjustment. | Segmented control can flex to 4 segments. |
| A-5 | The engine can work effectively off trait tags without numerical stats. | Engine requires stat blocks, adding data complexity. | Revisit during engine implementation and weight tuning. |
| A-6 | The community API (`api.helldivers2.dev`) will remain available and free. | App permanently falls back to 5-step manual flow until an alternative source is found. | App never breaks — just loses auto-inferred modifiers. |
| A-7 | Bundled equipment catalog is small enough that redeployment on patches is manageable. | Migrate to hosted data file — a small lift. | Bundled JSON approach is intentionally simple to migrate from. |
| A-8 | Hand-tuned weights produce good-enough recommendations for v1. | Weight tuning needs a more systematic approach. | helldive.live pick rates serve as calibration sanity check. |
| A-9 | helldive.live pick rate data is a sufficient calibration reference. | Alternative community data sources (tier lists, patch analyses) can serve as rougher references. | Not a hard dependency — manual tuning is always the fallback. |
| A-10 | Free-tier hosting is sufficient for v1 traffic. | Paid tiers are inexpensive and require no migration — just a plan upgrade. | No architectural risk. |

---

## 15. V2+ Backlog

Features explicitly deferred from v1, captured across all planning phases.

### UX & Features
- Edit/modify a saved loadout
- Sync saved loadouts across devices (requires auth + server storage)
- Name or tag saved loadouts
- Re-optimize a stale loadout with one tap
- Item ownership filter (settings or onboarding)
- Sort/filter controls on saved loadouts list
- Staleness indicators on saved loadouts list view (without opening detail)
- Squad-based loadout coordination (role-based recommendations across a team of four)
- Rate my loadout / synergy scoring
- Build sharing (links, social, export)
- Localization / multi-language support
- Onboarding flow (only if input flow proves non-obvious)
- News/updates feed
- Light mode / theme toggle (only if user demand emerges)
- Content creator-specific features

### Technical & Data
- Semi-automated weight tuning from community pick rate data
- Backend server for loadout sync, user accounts, squad coordination
- Authentication (required for any cross-device or multi-user feature)
- Shareable recommendation links (may require server-side engine execution)
- Alternative community API sources as additional fallbacks
- Advanced analytics for understanding usage patterns and flow completion rates
- User feedback loop to refine recommendations over time
