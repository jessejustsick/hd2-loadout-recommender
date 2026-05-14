# Phase 2: UX & Information Architecture — Complete Summary

**Status:** Complete — all Phase 2 topics resolved.

---

## App Structure

The app has four top-level destinations:

- **Recommend** (default landing screen) — Cascading mission input → loadout results. The app's core function.
- **Randomizer** — Mode toggle → random loadout results. Serves exploration and content creation use cases.
- **Saved Loadouts** — Local list of previously saved builds with staleness detection.
- **Settings** — Minimal configuration and legal information.

**Explicitly excluded from v1:** About screen, tutorial/onboarding flow, news/updates feed. If the input flow isn't self-evident, that's a design problem to solve in the flow — not with onboarding.

---

## Navigation Model

**Pattern:** Bottom tab bar.

**Tab order (left to right):** Recommend · Randomizer · Saved Loadouts · Settings

**Rationale:** Four destinations is the sweet spot for tabs. Primary actions (Recommend, Randomizer) sit at thumb level on mobile. The pattern translates to top nav or sidebar on web with no structural changes. No deeply nested content creates back-stack complexity.

---

## Core Recommendation Flow

### Input Model

Single screen with cascading, inline selectors. No dropdowns — all options are visible and tappable (segmented controls, chip/pill selectors, numbered rows). Selections cascade: each input filters the options available in the next. Changes to any step reset all selections below it — no exceptions.

### Input Sequence

1. **Faction** — Segmented control (3 options: Terminids, Automatons, Illuminate). Selected first because it filters planets significantly.
2. **Difficulty** — Numbered row (~10 levels). Placed second because it is faction-agnostic. This avoids visual inconsistency during resets — if a user changes faction, difficulty persists naturally above the reset point while everything below it clears.
3. **Planet** — Chip/pill selector, filtered by faction. When live galactic map data is available, selecting a planet auto-infers active modifiers and environmental hazards.
4. **Mission Type** — Chip selector, filtered by planet and difficulty.

### Fallback Flow (No Live Data)

If the community API is unavailable, modifiers surface as an additional 5th step (multi-select chips). Progress stepper adjusts to show 5 steps. The app remains fully functional — just requires more manual input. A subtle banner communicates: "Live planet data unavailable — using manual input."

### Progress Stepper

A 4-step stepper (5 in fallback) displayed at the top of the screen below the page title. Each step is a numbered circle (1, 2, 3, 4) that changes to a checkmark when completed. The current active step is highlighted. Serves orientation and signals when auto-generate will trigger.

### Progressive Reveal

Only the faction selector is visible at the start. When a user makes a selection, the next input group animates in (fade-in transition) from a disabled/dimmed state to active with enough visual emphasis to guide the eye downward. No auto-scrolling except on mobile when the next input is below the fold — in that case, a gentle scroll (not a snap) brings it into view while keeping the previous selection visible.

### Auto-Generate

The recommendation generates automatically after the final input (mission type). No explicit "generate" button. The stepper reaching completion + auto-generate creates a natural, expected transition.

---

## Recommend Screen — Input State Spec

### Header
- **Page title:** "Build Your Loadout"
- **Progress stepper** below the title

### Initial State
- Only the faction selector is visible
- All other input groups are hidden (not disabled/dimmed — completely absent until revealed)

### Loading States
- When async data is needed (e.g., planet list after faction selection), show a skeleton state in the area where the selector will appear
- Skeleton resolves to the populated selector once data loads

### Error States — Input Data Failures

1. **First failure** (e.g., planet data fails to load) — Inline error message where the selector would appear + retry button. Skeleton transitions to error state.
2. **Second consecutive failure** — Same message + secondary option: "Or continue without planet data." Drops user into fallback flow with manual modifier input. Stepper adjusts to 5 steps.
3. **API known to be down on launch** — Skip straight to fallback flow. Subtle banner: "Live planet data unavailable — using manual input."

### Error State — Recommendation Engine Failure

If the engine fails after all inputs are provided: full-screen error state with retry button. Inputs are preserved so the user doesn't re-enter everything. "Something went wrong generating your loadout. Try again."

### Transition to Results
Results animate in as a separate view (not in-place on the input screen). Skeleton state displays while the engine generates, then resolves to the full loadout.

---

## Recommend Screen — Results State Spec

### Header
- **Back arrow** (left) — Returns to input screen with all selections preserved
- **Start over action** (right) — Clears all inputs, returns to initial faction-only state
- **Mission parameter summary** below header — e.g., "Automatons · Malevelon Creek · Difficulty 7 · Blitz"
- **Screen title:** "Recommended Loadout"

### Loadout List
Vertical list, one item per row. Grouped by category with subtle section dividers:

- **Weapons** — Primary, Secondary, Grenade
- **Stratagems** — 4 slots
- **Armor & Booster** — Armor (with passive called out), Booster

**Each row contains:**
- **Icon** — Actual stratagem SVG icons for stratagem slots (sourced from community GitHub SVG set). Generic silhouette category icons for weapons, grenade, armor, and booster.
- **Item name + key stat/tag** — Text label readable on its own; icon is enhancement, not sole identifier.
- **Info action** — Tapping triggers an accordion expand below the row with a brief role description (1–2 sentences on what this item contributes to the loadout). Accordion keeps user in context and supports opening multiple rationales simultaneously.
- **Swap action** — Tapping opens a bottom sheet with 2–3 alternative items. Each alternative includes a one-line rationale. User taps preferred alternative, sheet closes, row updates.

### Bottom Actions
- **Save Loadout** — Primary button, prominently displayed. Triggers a toast notification confirming the save.
- **Re-roll** — Text link (secondary visual weight). Regenerates a new recommendation using the same mission parameters.

**Save and Re-roll are visually distinct** to prevent accidental taps — save is the primary filled button, re-roll is a text link only.

### Re-Roll Behavior
Items that changed from the previous recommendation get a loading/transition animation and a "new" pill/flag for quick scanning. Items that remained the same stay static.

### Partial Loadout Handling
If the engine returns a partial result (some slots empty): show populated slots normally, empty slots display placeholder text ("Couldn't generate a recommendation") with the swap action still functional on that slot. Re-roll still works on the full loadout. User is never stuck.

If the engine returns nothing (zero slots filled): full failure error state with retry button.

### Decorative Slots
Helmet and cape are cosmetic-only in Helldivers 2 — excluded from recommendations.

---

## Randomizer Screen Spec

### Entry State
- **Page title:** "Random Loadout"
- **Generate button** — Prominent primary action
- **Safety toggle** — Standard on/off switch below the generate button. Default: Safety On (constrained random).
- **Safety Off description** — Only visible when toggle is in the off position. Punchy copy warning that the loadout is not geared toward effectiveness.

### Two Modes

- **Constrained Random (Safety On, default):** Random selections with guardrails — no duplicate stratagem types, basic role coverage, faction-appropriate weapons. Output is unexpected but playable.
- **Full Random / Safety Off:** True anything-goes randomization. No rules, no logic. Can produce absurd or unplayable loadouts.

### No Mission Inputs
The randomizer does not ask for mission parameters. Specifying mission details to get a random output is contradictory.

### Results Screen
Follows the same layout and patterns as the Recommend results screen with these differences:

- **Header title:** "Random Loadout"
- **No mission parameter summary** (none exist)
- **No rationale accordions** (no "why" for random)
- **Back arrow** returns to randomizer screen with toggle state preserved
- **No "Start Over" action** (nothing to clear — the user just hits Generate again)
- **Swap in constrained mode** works normally (alternatives from same pool)
- **Swap in full random mode** re-randomizes that individual slot
- **Save and Re-roll** same placement and visual treatment as Recommend results

---

## Saved Loadouts Screen Spec

### List View
- **Flat list** — no tabs, no sections separating recommended from randomized
- **Most recent at top** — no sort controls in v1
- **Recommended loadout rows:** Faction icon + auto-label from mission parameters (e.g., "Automatons · Malevelon Creek · Difficulty 7 · Blitz")
- **Randomized loadout rows:** No faction icon + label indicating mode (e.g., "Randomized · Constrained" or "Randomized · Safety Off")
- The visual difference between recommended (faction icon + mission params) and randomized (no icon + mode label) makes them immediately distinguishable without structural separation

### Staleness Reminder
A subtle informational line near the top of the list: "Loadouts may contain items affected by game updates. Open a loadout to check." Sets expectations without adding technical complexity.

### Detail View
Tapping a saved loadout opens it in the results screen layout (separate view, not inline expand).

- **Back arrow** labeled "Saved Loadouts" — returns to list
- **No "Start Over" action**
- **Read-only in v1** — no editing, no swapping, no re-optimizing
- **Staleness flags** visible on items that have changed or been removed since save:
  - **Changed item** (buffed/nerfed): Subtle indicator + "Updated since saved — stats may have changed."
  - **Removed item**: Different indicator + "No longer available."
  - No auto-substitution. User sees the flag and can generate a new recommendation if needed.
- **Staleness check happens on detail view load**, not on the list screen. Avoids checking every item in every loadout every time the list renders.

### Delete
- **Swipe-to-reveal** on mobile + **visible delete action** on each row for discoverability and web compatibility
- **Confirmation dialog** before deletion: "Delete this loadout?" with Cancel and Delete actions

### Empty State
- Message: "No loadouts have been saved yet"
- Two CTAs: "Generate a recommended loadout" and "Generate a random loadout" — functional nudges pointing to the two generation flows

### Loading State
Skeleton list items (2–3 placeholder rows) while local storage loads. Consistent with skeleton pattern used elsewhere.

### Storage Limit
Generous ceiling of 50 saved loadouts. Toast warning when approaching the limit (e.g., at 45). Not a concern for v1 usage patterns — revisit with better management tools in v2.

---

## Settings Screen Spec

Minimal configuration screen for v1. Three items:

- **Clear saved loadouts** — Destructive action with confirmation dialog: "Delete all saved loadouts? This can't be undone."
- **App version** — Static display. Essential for bug reports.
- **Acknowledgments** — Link to a text screen crediting community API data, open-source SVG icon set, and any other third-party resources. Exact content determined in Phase 3 based on licenses.
- **Non-affiliation disclaimer** — "Not affiliated with Arrowhead Game Studios or Sony Interactive Entertainment." Standard fan-made tool disclaimer.

**Explicitly excluded from v1:** Language/localization (massive surface area, ship English-only and add localization in v2 based on actual user base geography). Theme toggle (dark-only — see Design System Foundations).

---

## Content Model

### Data Objects

**Loadout** — The core output. A container referencing equipment selections + generation context.
- References: Primary Weapon, Secondary Weapon, Grenade, 4 Stratagems, Armor, Booster
- Context: Faction, Planet, Difficulty, Mission Type (for recommended); Generation mode (Recommended / Constrained Random / Full Random)
- Metadata: Timestamp of creation
- The loadout *references* items, it does not contain them. This enables staleness detection — when an item's data updates, the loadout's reference stays the same, and the app can compare.

**Weapon** — Covers primary, secondary, and grenade categories.
- Name, Category (Primary / Secondary / Grenade)
- Traits/Tags — functional descriptors (anti-armor, explosive, crowd-control, etc.) used by the recommendation engine for matching
- Source/Unlock — Warbond, base game, superstore, etc. (not surfaced in v1 UI, captured for future ownership filter)
- Icon reference
- Last Updated timestamp (powers staleness detection)
- **[ASSUMPTION]:** Detailed stat blocks (damage, fire rate, etc.) excluded from v1. Engine works off trait tags, not numerical stats. Revisit if Phase 3 engine design requires stats for weighted scoring.

**Stratagem** — Player selects 4 from a large pool.
- Name
- Category — Offensive, Defensive, Support, Eagle/Orbital sub-types (engine needs this for role coverage)
- Traits/Tags — same concept as weapons (anti-armor, area denial, resupply, mobility, etc.)
- Cooldown tier — rough indicator for loadout balance (avoid recommending four long-cooldown stratagems)
- Call-in type — single use / multi-use / persistent (affects loadout sustainability reasoning)
- Icon reference — community SVG set
- Source/Unlock
- Last Updated timestamp

**Armor**
- Name, Passive ability, Armor rating tier, Icon reference, Source/Unlock, Last Updated timestamp

**Booster**
- Name, Effect description, Tags, Source/Unlock, Last Updated timestamp

**Faction** — Three entries (Terminids, Automatons, Illuminate).
- Name, Icon
- Enemy composition profile — high-level description of the faction's characteristic enemy mix. Tells the engine which weapon/stratagem traits to prioritize. Not a detailed enemy database — faction-level profiling is sufficient for v1.

**Planet** — Dynamic/live data object.
- Name
- Faction — which faction currently controls/contests it (powers faction → planet filtering)
- Environmental Hazards — extreme cold, heat, acid storms, etc. (affects armor/gear choices)
- Active Modifiers — mission modifiers currently in effect (enables skipping manual modifier input)
- **Planet data is live** — faction control and modifiers shift with the galactic war. Requires regular refresh from an external source. Refresh frequency and sourcing strategy to be determined in Phase 3.

**Mission Type**
- Name
- Objective characteristics — tags describing mission demands (defend-objective, escort, time-pressure, etc.)
- Availability — which difficulty levels and planets this mission type appears on (powers input cascade filtering)

**Modifier**
- Name
- Effect tags — what the modifier does to gameplay in recommendation-engine terms
- Severity — rough weight indicator
- Constraint type — **hard constraint** (e.g., AA Defenses = no Eagle stratagems, filtered out entirely) vs. **soft modifier** (e.g., Fog = deprioritize long-range, weight adjustment). Engine treats these differently.

**Difficulty** — Just a number (1–10). No dedicated object. Relationships to enemy intensity and available mission types live in the recommendation logic.

### Key Relationships
- **Loadout** references → Weapons (3), Stratagems (4), Armor (1), Booster (1), plus mission context
- **Faction** → filters available Planets
- **Planet** → carries Environmental Hazards and Active Modifiers, belongs to a Faction
- **Mission Type** → filtered by Planet and Difficulty
- **Modifiers** → either inferred from Planet (live data) or manually selected (fallback)
- **All equipment objects** carry traits/tags that the recommendation engine matches against mission context

---

## Open Questions

| ID | Question | Impact | Phase to Resolve |
|----|----------|--------|-----------------|
| OQ-1 | Is the community Helldivers 2 API (Diveharder or equivalent) reliable and complete enough to be the primary data source for live galactic map state? | Determines whether the 4-step happy path or 5-step fallback is the default experience. | Phase 3 |
| OQ-2 | Where do item images/icons come from? Stratagem SVGs exist on GitHub. What about weapon, armor, and booster assets? | Determines how visual vs. text-heavy the results screen can be. | Phase 3 |
| OQ-3 | What does the recommendation engine logic actually look like? Rule-based? Weighted scoring? ML? | Affects what re-roll and constrained random can realistically produce, and how swap alternatives are ranked. | Phase 3 |
| OQ-4 | Should the saved loadouts list show a staleness indicator on list items without opening the detail view? | Would be more informative but adds complexity. Recommendation: no for v1, revisit based on user feedback. | v2 |

## Assumptions

| ID | Assumption | Risk if Wrong |
|----|-----------|---------------|
| A-1 | The recommendation engine in v1 assumes the player has access to all items. The swap feature is the manual workaround. | If too many recommendations include inaccessible items, the experience feels irrelevant. Mitigated by bottom sheet showing multiple alternatives. |
| A-2 | A community-maintained SVG icon set for stratagems is available and sufficiently complete/current. | If unavailable or incomplete, stratagem slots fall back to generic icons or text-only. |
| A-3 | The fallback flow (manual modifier input) is acceptable UX for v1 if live data is unreliable. | If the API is down frequently, most users experience the longer flow, weakening the speed value prop. |
| A-4 | Three factions is the current state of the game. | If a fourth is added, the data model handles it fine but the segmented control UI needs a layout adjustment. |
| A-5 | The recommendation engine can work effectively off trait tags without needing numerical stats. | If the engine requires stats for weighted scoring, weapon and stratagem objects need stat block attributes added. |

---

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| Faction first in input hierarchy | Filtering by faction (3 options) dramatically reduces planet list. |
| Difficulty second in input sequence (moved from third) | Difficulty is faction-agnostic. Placing it second avoids visual inconsistency when faction changes reset downstream selections. Two independent inputs first, two dependent inputs follow. |
| Inline selectors over dropdowns | Eliminates open-scroll-tap-close cycle. Everything visible, one-tap. Finite option sets make this feasible. |
| Progressive reveal over showing all inputs disabled | Keeps initial screen clean and focused. Only faction visible at start. |
| Fade-in animation for progressive reveal | Guides eye without being jarring. More intentional than instant appearance. |
| Auto-generate over explicit button | Removes one tap. Stepper + final step framing makes auto-generate feel expected. |
| Results animate in as separate view (not in-place) | Keeps results focused. Input screen is a separate context from results. |
| Accordion expand for rationale | Keeps user in context of full loadout. Supports opening multiple simultaneously. |
| Bottom sheet for swap | Users may not own sequential alternatives — need to see and choose from a list. Surfaces rationale for alternatives. |
| Separate entry point for randomizer | Different user intent (exploration vs. optimization). Mixing mission inputs with randomization is contradictory. |
| Two randomizer modes (constrained + full random) | Constrained serves habit-breaking. Full random serves chaotic play and content creators. |
| Safety On as default randomizer mode | Majority of users want something playable. Full random is opt-in chaos. |
| Exclude helmet and cape from recommendations | Cosmetic-only items — no gameplay impact, no recommendation value. |
| Saved Loadouts in v1 (local-only) | Adds stickiness and retention value. No auth or sync required. Low complexity. |
| Auto-label loadouts by mission parameters | Most meaningful identifier without user effort. Faction icon as visual signifier for scannability. |
| No tabs in saved loadouts list | Randomized loadouts are visually distinct (no faction icon, different label format) without structural separation. |
| Detail view for saved loadouts (not inline expand) | Inline expand creates nested interaction complexity. Detail view reuses existing results layout. |
| Read-only saved loadouts in v1 | Edit flow requires partial modification, re-save, overwrite-vs-save-as decisions. Deferred to v2. |
| Staleness check on detail view only (not list) | Checking every item in every loadout on list render is expensive. Surface flags when user opens a specific loadout. |
| Most recent first, no sort controls in v1 | Default expectation for saved content. Sort controls add UI complexity — add in v2 backed by usage data. |
| Save button as primary, Re-roll as text link | Visual hierarchy matches intent priority. Prevents accidental wrong-action taps. |
| System theme by default, settings toggle as override | Most users never need to touch theme settings. |
| Dark-only theme, no light mode | HD2 ecosystem is universally dark-themed. Light mode is real work (doubled color tokens, doubled QA) for zero user value. Revisit only if actual demand emerges. |
| Two responsive breakpoints (mobile ≤768px, desktop 768px+) | No meaningfully different tablet layout exists for this content. Tablet gets the desktop layout at comfortable width. |
| Bottom sheets on mobile, modals/popovers on desktop | Same swap content, platform-appropriate container. Thumb-reach rationale doesn't apply on desktop. |
| Lean on framework component defaults, don't build a custom library | Every component maps to standard UI framework primitives. Custom component work is a v2 concern once framework limitations are known. |
| CSS-only animations for v1 | GPU-accelerated, performant on mobile, covers every transition we've specced. JS-driven animation jumps implementation cost for no v1 benefit. |
| No language/localization in v1 | Touches every string in the app. Ship English, add localization in v2 based on actual user geography. |
| Non-affiliation disclaimer included | No cost to include, protects against IP concerns. |
| Graceful degradation for API failures | App is never fully broken. Fallback flow ensures a path to a recommendation always exists. |
| Partial loadout handling: show what you got, flag what's missing | Empty slots show placeholder + functional swap. User is never stuck. |

---

## v2+ Backlog (Captured During Phase 2)

- Edit/modify a saved loadout
- Sync saved loadouts across devices (requires auth + server storage)
- Name or tag saved loadouts
- Re-optimize a stale loadout with one tap
- Item ownership filter (settings or onboarding)
- Sort/filter controls on saved loadouts list
- Staleness indicators on saved loadouts list view
- Localization / multi-language support
- Onboarding flow (only if input flow proves non-obvious)
- News/updates feed
- Light mode / theme toggle (only if user demand emerges)

---

## Cross-Platform Considerations

### Overall Assessment

The app's tight scope means web and mobile experiences are largely identical. Four tabs, no deeply nested navigation, no complex data entry. The interaction patterns chosen (chip selectors, accordions, bottom sheets, segmented controls) all have well-established cross-platform equivalents.

### Where the Experience Diverges

**Navigation chrome.** Bottom tab bar on mobile. Top nav bar or sidebar on wider screens (tablet/desktop web). Structurally identical — same four destinations, same order — just repositioned.

**Bottom sheets → modals or popovers on desktop.** The swap bottom sheet is a mobile-native pattern. On desktop web, a modal or anchored popover near the row makes more sense spatially — more screen real estate, no thumb-reach rationale. Same content, different container.

**Swipe-to-delete on saved loadouts.** Mobile-native gesture. On web, the visible delete action on each row handles it. Mobile gets both (swipe + visible), web gets visible only.

**Auto-scroll on progressive reveal.** Mobile gets a gentle scroll when the next input is below the fold. Desktop doesn't auto-scroll — viewports are tall enough that progressive reveal stays in-view naturally.

### Where It Stays the Same

Input flow, results layout, randomizer, saved loadouts structure, settings — all identical across platforms. The vertical list layout, accordion expands, and stepper work the same everywhere.

### Responsive Breakpoints

Two breakpoints, not three: **mobile** (up to ~768px) and **desktop** (768px+). No meaningfully different tablet layout — the content doesn't benefit from multi-column grids or split-views. Tablet gets the desktop layout at a comfortable width.

---

## Design System Foundations

### Component Inventory

**Shared / reused heavily:**
- Segmented control (faction selector)
- Chip/pill selector (planets, mission types, modifiers in fallback)
- Numbered row selector (difficulty)
- Progress stepper (4-step, 5-step fallback)
- Loadout row (icon + name + stat/tag + info action + swap action) — the workhorse component, used on Recommend results, Randomizer results, and Saved Loadout detail
- Accordion expand (rationale, nested under loadout row)
- Bottom sheet / modal (swap alternatives — platform-dependent container)
- Section divider (loadout category groupings)
- Primary button (Save, Generate)
- Text link / secondary action (Re-roll, Start Over)
- Toast notification (save confirmation, storage limit warning)
- Confirmation dialog (delete loadout, clear all)
- Toggle switch (safety mode)
- Skeleton loader (list items, selector areas)
- Inline error + retry
- Banner (API fallback notification)
- Empty state (saved loadouts)

**One-off or limited use:**
- Mission parameter summary bar (results header)
- "New" pill/flag (re-roll change indicator)
- Staleness indicator (saved loadout detail)
- Saved loadout list row (faction icon + auto-label, no actions — distinct from the loadout row component)

### Key Component: Loadout Row

The loadout row is the most complex component in the app. It contains an icon slot, text content, two action triggers, an accordion child, and the accordion content itself. It also handles empty/placeholder state for partial loadouts. Nailing this one component covers a huge percentage of the app's surface area.

### Technical Implications

**Accordion state management.** Multiple rationale accordions can be open simultaneously (per spec). Each accordion tracks its own open/closed state independently — not a single "which one is open" value. Must be called out explicitly so the developer doesn't default to single-open accordion behavior.

**Animations and transitions.** Progressive reveal fade-in, results screen transition, re-roll item change animation, skeleton-to-content resolution. All achievable with CSS-only transitions (opacity/transform). CSS transitions are GPU-accelerated and performant on mobile. No JS-driven animation (spring physics, gesture-driven transitions) needed for v1 — that's where implementation cost jumps.

**Icons — two tiers.** Stratagem icons are actual SVGs from a community set (assumption A-2). Everything else uses generic category silhouettes. For the generic tier, use a subset of an existing icon library (Lucide, Phosphor, etc.) rather than custom icons.

**Dark-only theme.** The HD2 ecosystem is universally dark-themed — game UI, wiki, community tools all use dark backgrounds. A light mode adds real work (doubled color tokens, doubled QA surface, theme toggle, system-preference detection) for zero user value in this audience. Ship dark-only. Define one set of color tokens. If user demand for light mode ever emerges, the token structure supports adding a second variant set later.

**Bottom sheet height.** Content-height bottom sheet with a max-height cap (~60% of viewport), scrollable internally if content exceeds it. Don't over-specify heights — let swap alternative content drive it.

**No custom component library needed.** Every component maps to standard primitives in major UI frameworks. The v1 design system should be a thin layer of tokens and overrides on top of a framework's existing component set. Custom component work is a v2 concern.

---

## What's Next

**Phase 2 is complete.** All topics resolved — app structure, navigation, core flows, screen specifications, content model, cross-platform considerations, and design system foundations.

Moving to **Phase 3: Technical Strategy** — platform approach, data architecture, authentication, third-party services, performance, and scalability.
