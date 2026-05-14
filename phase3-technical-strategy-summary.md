# Phase 3: Technical Strategy — Complete Summary

**Status:** Complete — all Phase 3 topics resolved.

---

## Platform Approach

**Decision:** Progressive Web App (PWA).

A single codebase deployed as a web application. Users access it via browser on any device. On mobile, they can install it to their home screen for an app-like experience — full screen, no browser chrome, launches like a native app.

**Rationale:** The app is a form-to-results flow with no native device capabilities required (no camera, Bluetooth, push notifications, or complex gestures). The interaction patterns specced in Phase 2 — chips, segmented controls, accordions, bottom sheets — all translate cleanly to web components. Local storage for saved loadouts uses standard browser APIs. One codebase, one deployment pipeline, zero app store friction.

The target audience (HD2 players) discovers tools through Discord pins, Reddit posts, and community links — not App Store searches. A URL they can tap and immediately use reduces friction for the primary use case: "I'm at the hellpod screen on my phone, I need a loadout now."

**Distribution:** Direct links, community sharing (Reddit, Discord, HD2 community hubs), and SEO. The PWA "install to home screen" option gives power users an app-like experience without app store listings.

**Future flexibility:** Nothing about starting with a PWA prevents wrapping it in a native shell (Capacitor, TWA) or rebuilding specific platforms if demand emerges.

**PWA setup notes:** The PWA requires a manifest file (app name, icon, splash screen, display mode) and a service worker (caching for offline/fast-load behavior). Both should be set up early in development so the installed experience is tested throughout, not bolted on at the end.

---

## Hosting & Deployment

**Decision:** Vercel or Netlify (choose based on personal preference).

Both serve static sites via global CDN, offer free tiers more than adequate for this app's traffic, and support automatic deployments from a Git repository. Push code, site updates automatically.

Both handle PWA service worker registration and caching headers correctly out of the box.

**Cost:** Free tier. This app is a static site with no server-side processing — hosting costs are effectively zero at any realistic traffic level.

---

## Data Architecture

The app's data falls into three categories based on how it behaves, where it lives, and how it updates.

### 1. Static Game Data — Equipment Catalog

Every weapon, stratagem, armor piece, and booster in the game. Names, traits/tags, categories, cooldown tiers, icon references, scoring weights — everything the recommendation engine and UI need.

**Where it lives:** Bundled with the app as a JSON file. Ships as part of the deployed code.

**How it updates:** Redeployed when the game patches. The service worker cache ensures users get the updated data on their next visit.

**Rationale for bundling:** The catalog is small (maybe 100–150 items across all categories — kilobytes of JSON). Bundling means zero server dependencies for the app's core function. No API to build, no hosting to manage, no latency on data fetches. The app works with zero network connectivity for everything except live planet data. Redeployment cadence (every few weeks when HD2 patches) is manageable for a solo creator.

**Migration path:** If update frequency ever becomes a bottleneck, moving the catalog to a hosted JSON file or simple API is a small lift. Nothing about bundling creates lock-in.

### 2. Dynamic Live Data — Galactic War State

Planets, faction control, active modifiers, environmental hazards. Changes constantly as the community plays — sometimes hourly.

**Where it lives:** Fetched at runtime from the community API (`api.helldivers2.dev`).

**How it updates:** Fetched per session with local caching (see Caching Strategy below).

**Fallback:** If the API is unreachable, the app degrades to the 5-step manual modifier input flow specced in Phase 2. The app is never broken by API unavailability.

### 3. User Data — Saved Loadouts & Preferences

Saved loadouts (up to 50), theme preference, safety toggle state.

**Where it lives:** Browser IndexedDB on the user's device. Local only — no sync, no server, no accounts.

**How it updates:** User actions (save, delete). Reads on app load and saved loadout list render.

**Rationale for IndexedDB over localStorage:** IndexedDB provides structured storage with more capacity and better performance for the 50-loadout ceiling. localStorage is limited to string key-value pairs and has a 5–10MB cap across all keys.

### Data Architecture Summary

| Data Category | Storage Location | Update Mechanism | Network Required |
|---|---|---|---|
| Equipment catalog | Bundled JSON (deployed with app) | Redeployed on game patches | No |
| Galactic war state | Community API → local cache | Fetched per session, cached 10–15 min | Yes (degrades gracefully) |
| User data | Browser IndexedDB | User actions, local only | No |

---

## Third-Party Services & APIs

### Community API — Live Galactic War Data

**Primary source:** `api.helldivers2.dev` — the community-driven API for Helldivers 2.

- Provides planet status, faction control, active modifiers, campaigns, and environmental data in JSON format
- No authentication required for default rate limits
- OpenAPI specification and SwaggerUI documentation available
- Requests should include `X-Super-Client` header identifying the app (will become mandatory in a future API version)
- Multiple companion projects (Diveharder API, Helldivers Training Manual API) provide similar data as alternative sources if needed

**Integration points:**
- **Faction → Planet list:** Called when the user selects a faction (or prefetched on app load — see Performance section). Returns planets filtered by controlling faction.
- **Planet → Modifiers & Hazards:** Called when the user selects a planet. Returns active modifiers and environmental conditions, enabling the 4-step happy path (skipping manual modifier input).

**Caching strategy:** Cache planet/faction data locally for 10–15 minutes. Galactic war state changes over hours, not seconds. Caching reduces API load (good community citizenship) and improves app responsiveness for returning users within a session.

**Fallback behavior:** Three-tier degradation:
1. Serve from local cache if fresh
2. Fetch from API on demand if cache is stale
3. Fall back to manual modifier input (5-step flow) if API is unreachable

### Hosting — Vercel or Netlify

See Hosting & Deployment section above.

### Analytics (Optional, Post-Launch)

**Recommendation:** Plausible or Umami — privacy-focused, cookie-free analytics.

Provides basic usage data (page views, flow usage, drop-off points) without invasive tracking or GDPR/privacy overhead. Can be added after launch with no architectural changes.

### Error Monitoring (Optional, Post-Launch)

**Recommendation:** Sentry (free tier).

Captures JavaScript errors with stack traces and browser context. Alerts when something breaks in production before users report it. Can be added after launch with no architectural changes.

### Services Explicitly Not Needed for v1

| Service | Why Not |
|---|---|
| Backend server | No server-side logic. Equipment data is bundled, live data comes from community API, user data is local. |
| Database | IndexedDB handles saved loadouts. Equipment catalog is a JSON file. |
| Authentication service | No user accounts in v1. |
| Payment processing | No monetization in v1. |
| Push notification service | Not a PWA capability on iOS, not needed for the use case. |

---

## Recommendation Engine

### Architecture: Weighted Scoring with Hard Constraints

The engine runs entirely client-side in the browser. No server, no API call, no latency. Execution time is sub-millisecond — the equipment catalog is small and the scoring logic is simple arithmetic.

### Three Layers

**Layer 1 — Hard Constraints (Binary Filters)**

Rules that remove items from consideration entirely before scoring begins. These map to the "hard constraint" modifier type defined in the Phase 2 content model.

Examples:
- AA Defenses modifier → exclude all Eagle stratagems
- Grenade slot → only consider items tagged as grenades
- Stratagem slot already filled with an Orbital → remaining slots can still select Orbitals (no exclusion), but role coverage scoring in Layer 2 deprioritizes redundancy

This layer is small, explicit, and easy to maintain. It handles cases where scoring nuance would be wrong — you don't deprioritize Eagle stratagems when AA Defenses is active, you exclude them.

**Layer 2 — Weighted Scoring**

Every item that survives the constraint filter gets scored against the mission context. Scoring factors include:

- **Faction match** — Does this item's trait profile align with the faction's enemy composition? (e.g., anti-armor weapons score higher against Automatons)
- **Difficulty scaling** — Does this item become more or less valuable at higher difficulties? (e.g., anti-tank stratagems score higher at difficulty 7+)
- **Modifier adjustments** — Soft modifiers shift weights without excluding items (e.g., Fog deprioritizes long-range weapons, Tremors deprioritizes stationary turrets)
- **Environmental fit** — Extreme cold or heat favoring certain armor passives
- **Role coverage** — The engine checks what roles are already filled in the loadout-in-progress and boosts scores for unfilled roles, ensuring balanced coverage (anti-armor, crowd control, support/resupply, etc.) rather than stacking one role
- **Cooldown balance** — Avoids recommending four long-cooldown stratagems by scoring cooldown diversity

**Layer 3 — Controlled Randomness**

Instead of always selecting the single highest-scored item per slot, the engine picks from a weighted random selection of the top N candidates. Higher-scored items are more likely to be selected, but lower-scored alternatives still have a chance. This produces variety across re-rolls — same inputs yield genuinely different loadouts because the randomness resolves differently each time.

### How Engine Features Map to the UX

| Feature | Engine Behavior |
|---|---|
| **Auto-generate** | Run full pipeline (constraints → scoring → weighted random) after final input |
| **Re-roll** | Re-run weighted random selection with same scores. Some items stay (dominated their slot), some change. Changed items get the "new" pill indicator. |
| **Swap alternatives** | Display the next 2–3 highest-scored items for that slot in the bottom sheet. Rationale text generated from dominant scoring factors. |
| **Constrained random (Randomizer)** | Skip Layer 2 scoring. Keep Layer 1 constraints + role coverage checks. Random selection from the filtered pool. |
| **Full random (Randomizer, Safety Off)** | Skip all layers. Pure random from the complete item list. No constraints, no logic. |
| **Rationale text (Info accordion)** | Human-readable translation of dominant scoring factors: "Recommended for anti-armor capability against Automatons at high difficulty." |

### Weight Sourcing & Calibration

**V1 source:** Hand-tuned weights based on game knowledge and community meta consensus. Weights are numbers stored in the bundled equipment catalog JSON alongside item traits.

**Calibration reference:** helldive.live tracks weapon and stratagem pick rates from actual player loadouts. This data serves as a sanity check during weight tuning — not as a live input to the engine. If the engine never recommends an item that has significant community pick rate, the weights may be too narrow. If it frequently recommends items with near-zero pick rate, the weights may be miscalibrated.

**Update cadence:** Weights are reviewed and adjusted alongside equipment catalog updates when the game patches.

**V2 potential:** If community data sources (helldive.live or similar) expose pick rates broken down by mission context (faction + difficulty + mission type), that data could inform semi-automated weight adjustments — the "app gets smarter over time" principle from Phase 1.

### Competitive Context

Democracy Hub (democracy-hub.net) is the most feature-rich existing tool in this space — loadout builder with randomization, slot locking, warbond filters, auto-optimization, weapon stats, enemy data, and a galactic war map. Our differentiation is mission-context-aware recommendation (their builder is a manual tool with optimization layered on) and speed-first design (input four things, get a loadout, done — no builder interaction required).

---

## Performance Strategy

### The 60-Second Constraint

The Phase 1 design constraint states the app must deliver value in under 60 seconds from open to recommendation. The architecture naturally supports this — most work happens locally.

**Realistic time breakdown:**
- App load: ~1 second (service worker cache for returning users; sub-second even for first-time visitors given the small bundle size)
- User input time: ~5–15 seconds (four taps through cascading selectors)
- API fetch for planet data: 0 seconds if prefetched, <1 second if not
- Engine scoring: <1 millisecond (client-side arithmetic on a small dataset)
- Results render: negligible

**Total:** Well under 60 seconds. The bottleneck is user decision-making time, not app performance.

### App Load Performance

The service worker caches the entire app shell (HTML, JS, CSS) and the bundled equipment catalog. Returning users load from cache with zero network dependency — near-instant startup. First-time visitors download a bundle measured in hundreds of kilobytes (no heavy media, no complex libraries), loading in under a second on any modern connection.

### API Call Optimization — Prefetch

On app load, fire off the planet data API call in the background before the user has selected a faction. By the time they tap a faction, the data is likely already cached locally. Faction selection then filters the already-loaded list — zero perceived latency.

If the prefetch fails silently, the app falls back to fetching on faction selection (with skeleton loading state), then to the manual fallback flow if that also fails.

### Caching Layers

| What | Cache Duration | Mechanism |
|---|---|---|
| App shell (HTML, JS, CSS) | Until next deployment | Service worker |
| Bundled equipment catalog | Until next deployment | Service worker (part of app bundle) |
| Live planet/faction data | 10–15 minutes | In-memory or sessionStorage |

### What Doesn't Need Optimization

- **Rendering performance** — Vertical list of 9 items with text and icons. Trivial UI complexity.
- **Animation performance** — CSS-only transitions (per Phase 2 design system decisions) are GPU-accelerated.
- **Storage performance** — 50 loadouts in IndexedDB is negligible. Single-digit millisecond read/write.
- **Bundle size** — At this app's scale, aggressive code splitting or lazy loading is over-engineering.

---

## Offline Behavior

The app is not an offline-first application. The primary use case assumes an internet connection ("at the hellpod screen, phone in hand"). Building robust offline infrastructure adds complexity for a rare scenario.

However, the PWA architecture provides useful offline behavior almost for free:

| Capability | Works Offline | Notes |
|---|---|---|
| App loads and renders | Yes | Service worker serves cached app shell |
| Equipment catalog available | Yes | Bundled with the app, cached by service worker |
| Saved loadouts accessible | Yes | Stored in IndexedDB on device |
| Recommendation engine runs | Yes | Client-side logic on bundled data |
| Live planet data (4-step flow) | No | Requires API call — degrades to manual input |
| Manual modifier input (5-step fallback) | Yes | All data needed is bundled |

**Net result:** An offline user can still get a recommendation — they just provide modifiers manually instead of having them auto-inferred from a planet selection. Acceptable degradation for v1.

---

## Scalability & Future-Proofing

### What "Scalability" Means for This App

Traditional backend scalability (database sharding, load balancing, horizontal scaling) does not apply — there is no backend server. The PWA is a static site served from a CDN, which scales inherently. Ten users or ten thousand, hosting cost and performance are identical.

The real scalability question is: **what architectural choices now avoid painful rewrites when the app grows in features?**

### Growth Scenario Analysis

**The app gets popular.** Static sites on CDNs scale infinitely. The one pressure point — community API load — is mitigated by local caching (one API call per session, cached 10–15 minutes). No architectural change needed.

**The equipment catalog grows.** Even tripling the item count keeps the JSON in kilobyte territory. Scoring 200+ items is still sub-millisecond client-side computation. No architectural change needed.

**A fourth faction is added.** The data model already handles it (Assumption A-4 from Phase 2). Add a faction entry, update the segmented control layout, add an enemy composition profile. No architectural change needed.

**The engine needs to get smarter.** The weighted scoring architecture supports progressive improvement: v1 hand-tuned weights → v2 community-data-calibrated weights → v3 potentially more sophisticated models. Each step changes what produces the weights, not how the engine uses them.

**A backend is needed (v2).** Several v2 features require server-side infrastructure: loadout sync, user accounts, squad coordination. The key architectural choice that makes this transition clean:

### Service Layer Abstraction

Three structural patterns to follow during v1 development:

1. **Data access behind a clean interface.** UI components never touch IndexedDB directly. A service layer provides functions like `saveLoadout()`, `getLoadouts()`, `deleteLoadout()`. When v2 swaps local storage for a server API, only the service internals change — nothing else in the app needs to know.

2. **Equipment catalog behind a data service.** The app doesn't import the JSON file directly in multiple places. A service provides `getWeapons()`, `getStratagems()`, etc. If v2 moves the catalog to a server, the service changes internally but the interface stays the same.

3. **Recommendation engine as a standalone module.** The engine takes mission parameters in and returns a scored loadout out. It knows nothing about UI components, screen state, or user interactions. This makes it testable in isolation (crucial for weight tuning) and portable — it could run server-side if needed for features like shareable recommendation links.

**Consistent data shape.** The loadout object defined in the Phase 2 content model — references to equipment items, mission context, metadata — is the single canonical format everywhere: saved to storage, returned by the engine, displayed by the UI, and eventually returned by a server API. No translation layers needed.

### The Real Scalability Constraint

As a solo creator, **your time** is the scalability bottleneck, not infrastructure. The equipment catalog needs manual updates per patch. Weights need manual tuning. The community API needs monitoring. The mitigation is keeping the data layer simple enough that updates take minutes, not hours — which the bundled JSON approach achieves.

---

## Authentication

**Decision:** No authentication in v1. No user accounts, no login, no identity.

All user data (saved loadouts, preferences) is local to the device. There is no cross-device sync, no shared data, and no personalization that requires knowing who the user is.

**V2 implications:** When features like loadout sync, squad coordination, or build sharing require user identity, authentication becomes necessary. The service layer abstraction (see Scalability section) ensures this can be added without restructuring the app. The local data layer swaps to a server-backed layer behind the same interface.

---

## Open Questions Resolved

| ID | Original Question | Resolution |
|----|-------------------|------------|
| OQ-1 | Is the community Helldivers 2 API reliable enough for live galactic map state? | Yes. The `api.helldivers2.dev` ecosystem is mature, well-documented, and actively maintained. Multiple companion projects depend on it. Our three-tier fallback (cache → fetch → manual input) handles downtime gracefully. |
| OQ-3 | What does the recommendation engine logic look like? | Weighted scoring with a hard constraint layer and controlled randomness. Fully client-side. See Recommendation Engine section. |

**Still open (deferred to development phase):**

| ID | Question | Impact |
|----|----------|--------|
| OQ-2 | Where do item images/icons come from beyond stratagem SVGs? | Determines visual richness of results screen. Generic silhouette icons are the v1 plan. Community asset sources to be evaluated during development. |

---

## Assumptions

| ID | Assumption | Risk if Wrong |
|----|-----------|---------------|
| A-6 | The community API (`api.helldivers2.dev`) will remain available and free for the foreseeable future. | If the API shuts down or restricts access, the app permanently falls back to the 5-step manual flow until an alternative source is found. The app never breaks — it just loses the convenience of auto-inferred modifiers. |
| A-7 | The bundled equipment catalog is small enough that redeployment on game patches is a manageable update cadence for a solo creator. | If patches become very frequent or the catalog grows dramatically, migrating to a hosted data file is a small lift. |
| A-8 | Hand-tuned weights based on game knowledge and community meta produce recommendations good enough to deliver value in v1. | If recommendations feel consistently off, the weight tuning process may need a more systematic approach — potentially incorporating community pick rate data more directly. |
| A-9 | Helldive.live pick rate data is a sufficient calibration reference for validating engine weights. | If helldive.live goes offline or changes its data, alternative community data sources (tier lists, patch analyses) can serve as rougher calibration references. |
| A-10 | Free-tier hosting (Vercel/Netlify) is sufficient for v1 traffic. | If the app experiences unexpected viral growth, paid tiers are inexpensive and require no migration — just a plan upgrade. |

---

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| PWA over native or cross-platform framework | No native device capabilities needed. One codebase, zero app store overhead. URL-based distribution matches how the HD2 community discovers tools. |
| Vercel/Netlify for hosting | Free-tier static hosting with CDN, automatic Git deployments. No server to manage. |
| Bundle equipment catalog as JSON | Small dataset (kilobytes). Eliminates server dependency for core function. App works offline. Redeployment cadence matches game patch frequency. |
| Community API for live galactic war data | Mature, documented, no-auth ecosystem. Multiple fallback sources available. Three-tier degradation protects the user experience. |
| IndexedDB for user data | Structured storage with ample capacity for 50 loadouts. Better suited than localStorage for structured data. |
| No backend server for v1 | No server-side logic exists in v1. Equipment data is bundled, live data comes from a third-party API, user data is local. Adding a server would be complexity without purpose. |
| Weighted scoring over rule-based or ML engine | More nuanced than binary rules (supports variety in re-rolls), far simpler than ML (no training data, no backend, no black box). Produces transparent rationale text. Runs client-side in sub-millisecond time. |
| Hard constraint layer on top of scoring | Some modifiers (AA Defenses) require binary exclusion, not weight adjustment. A thin rule layer handles these cleanly without complicating the scoring system. |
| Controlled randomness in item selection | Picking from weighted top-N candidates instead of always the single highest score makes re-roll meaningful and prevents staleness. |
| Hand-tuned weights for v1 | Simplest approach that delivers value. Community pick rate data (helldive.live) provides calibration reference without requiring integration. |
| Prefetch planet data on app load | Eliminates perceived latency on faction selection. Falls back gracefully if prefetch fails. |
| 10–15 minute local cache for API data | Galactic war state changes hourly, not per-second. Caching reduces API load and improves responsiveness. |
| Service layer abstraction for data access | No visible impact in v1, but ensures clean migration path when v2 adds server-backed storage, auth, or sync. |
| Engine as standalone decoupled module | Testable in isolation for weight tuning. Portable to server-side if future features require it. |
| No authentication in v1 | No user identity needed. All data is local. Auth adds complexity for zero v1 value. |
| Analytics and error monitoring as post-launch additions | Both are low-effort additions that don't require architectural forethought. Ship the app first, instrument it after. |

---

## v2+ Backlog (Captured During Phase 3)

- Semi-automated weight tuning from community pick rate data (helldive.live or similar)
- Backend server for loadout sync, user accounts, squad coordination
- Authentication (required for any cross-device or multi-user feature)
- Shareable recommendation links (may require server-side engine execution)
- Alternative community API sources as additional fallbacks
- Advanced analytics for understanding usage patterns and flow completion rates

---

## What's Next

**Phase 3 is complete.** All technical strategy topics resolved — platform approach, data architecture, third-party services, recommendation engine, performance, offline behavior, scalability, and authentication.

Moving to **Phase 4: PRD Assembly** — compiling Phases 1–3 into a single, implementation-ready Product Requirements Document.
