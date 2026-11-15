# Remembry: Technical Requirements (v1)

## 1. Stack
| Concern | Choice |
|---|---|
| Build | Vite + React + TypeScript (strict mode) |
| Styling | Plain CSS files with CSS variables (design tokens). No Tailwind, no inline styles |
| Animation | Framer Motion (springs, layout, flip) |
| Storage | IndexedDB via Dexie (+ `dexie-react-hooks`) |
| Scheduling | `ts-fsrs` |
| Notes rendering | `react-markdown` + `remark-gfm` |
| Charts | Recharts |
| PWA | `vite-plugin-pwa` (autoUpdate) |
| Routing | React Router (tab routes) |
| UI state | Zustand (ephemeral UI/session state only) |
| Tests | Vitest (unit tests for `core/`) |
| Hosting | Vercel (static) |

## 2. Non-negotiable engineering rule
**The code must stay clean, readable and modular.** Styles, logic and UI live in separate layers and separate folders. Components never contain business logic; logic never imports React.

## 3. Folder structure and layer rules
```
src/
  core/          Pure TypeScript logic. No React, no DB, no DOM.
    scheduler/     fsrs wrapper, rating map, recall probability
    session/       card selection for each mode, queue, re-queue of Wrong cards
    streak/        study-day calculation (3:30 AM boundary), streak maths
    importers/     card parser (Q:/A: + tab), note parser
    stats/         aggregations for charts
    tree/          tree helpers (descendants, path, move validation)
  data/          Persistence only.
    db.ts          Dexie schema + versioned migrations
    repositories/  trees, notes, cards, reviews, sessions, settings
    backup/        export / import JSON
  hooks/         Bridge: combine data + core for the UI (useTree, useSession, useStats, ...)
  ui/            Presentation only.
    components/    reusable, dumb components (Button, Sheet, TreePicker, WifiRating, Mascot, WaveDivider, StatCard, charts)
    screens/       Home, Notes, Cards, Analysis, Profile, StudySession, SessionSetup
    layout/        AppShell, TabBar
  styles/        All CSS lives here.
    tokens.css     colours, spacing, radii, shadows, motion durations
    themes.css     light (default) and dark variable sets
    global.css     reset and base elements
    animations.css shared keyframes (wave, float, pulse)
    components/    one CSS file per component or screen
  assets/mascot/ Mnemo SVG files / SVG components
  types/         shared TypeScript types
  app/           App.tsx, routes, providers, PWA registration
```

**Dependency rules (enforce with lint):**
- `core` imports only `types`.
- `data` imports `core` and `types`.
- `hooks` imports `data`, `core`, `types`.
- `ui` imports `hooks`, `types`, `styles`. **It must never import `data` or call Dexie.**
- `styles` contains no TypeScript.
- No inline `style={{}}` except for dynamic values (e.g. a progress width); static styling always goes through CSS classes.
- One component per file, under ~150 lines; split when larger.
- Magic numbers (colours, durations, limits) live in tokens or a `constants.ts`, never inline.

## 4. Data model (Dexie)
All ids are UUID strings; times are epoch milliseconds.

| Table | Fields |
|---|---|
| `nodes` | id, parentId (null for areas), name, order, createdAt |
| `notes` | id, nodeId, title, body, createdAt, updatedAt |
| `cards` | id, nodeId, front, back, trap (bool), createdAt, plus FSRS state: due, stability, difficulty, state, reps, lapses, lastReview |
| `reviews` | id, cardId, sessionId, rating (`easy`\|`medium`\|`hard`\|`partial`\|`blank`\|`wrong`), durationMs, timestamp |
| `sessions` | id, startedAt, endedAt, scopeNodeId, mode, plannedCount, completedCount |
| `settings` | single row: theme, dayStartMinutes (210 = 3:30 AM), newCardsPerDay (20), dailyGoal (20), avgSecondsPerCard (20), lastBackupAt |

- Indexes: `cards.nodeId`, `cards.due`, `reviews.cardId`, `reviews.timestamp`, `notes.nodeId`, `nodes.parentId`.
- Streaks and statistics are **derived from `reviews`**; they are never stored separately.
- Every schema change adds a new Dexie version with a migration, so existing user data is never lost.

## 5. Scheduling logic (`core/scheduler`, `core/session`)
- FSRS state is per card. Rating map lives in one file, `ratingMap.ts`, and is easy to tune:
  - Easy → FSRS Easy; Medium → Good; Hard → Hard
  - Partial → Hard, then shorten the next interval (about half, minimum 1 day)
  - Blank → Again
  - Wrong → Again, set `trap = true`, re-insert into the live session queue about 3 cards later
- **Recall probability** R(card, now) is computed from FSRS stability and elapsed time.
- Selection by mode, within the chosen scope (node + descendants):
  - **About to forget**: reviewed cards sorted by ascending R; trap cards get a priority boost; then new cards if enabled.
  - **Due**: `due <= now`, earliest first; then new cards.
  - **Random**: random sample of reviewed + new cards.
- New cards are capped by `newCardsPerDay` across the whole app (count cards first-reviewed since the current study-day start).
- If total reviews < 50, About to forget falls back to Due + new.
- Minutes → count conversion: `floor(minutes * 60 / avgSecondsPerCard)`. Update `avgSecondsPerCard` from review durations.
- All of this must be pure functions with unit tests.

## 6. Study day and streak (`core/streak`)
- `studyDayKey(timestamp, dayStartMinutes)` = local date of `timestamp - dayStartMinutes`.
- Streak = consecutive day keys containing at least one review, counting back from today (or yesterday if nothing reviewed yet today).
- Handle timezone and DST using local-time arithmetic; test the 3:30 AM boundary explicitly.

## 7. Importers (`core/importers`)
- **Cards:** split on blank lines into blocks; `Q:` starts the front, `A:` starts the back, continuation lines append. Also accept `front<TAB>back` lines. Trim whitespace; skip blocks missing a side and report them.
- Dedupe on `nodeId + normalised(front)`. Return `{added, skipped, invalid}` for the preview.
- **Notes:** read file text; title = first `# heading` or the filename.
- Parsers are pure functions; file reading happens in the UI/hook layer.

## 8. PWA, updates and data safety
- `vite-plugin-pwa` with `registerType: 'autoUpdate'`. Show a toast ("Update ready, tap to refresh") when a new service worker is waiting.
- Precache the app shell; the app is fully functional offline.
- Call `navigator.storage.persist()` on first run.
- Keep a stable production domain (IndexedDB is tied to the origin). Document this in the README.
- Backup export: JSON containing every table plus a schema version, downloaded via the browser/share sheet. Import validates the version and offers merge or replace. Track `lastBackupAt` and remind after 7 days.

## 9. Performance and quality
- Code-split by tab route; lazy-load charts.
- Animate only `transform` and `opacity`. Respect `prefers-reduced-motion`.
- Use `useLiveQuery` for reactive reads; avoid loading all reviews at once on Home (aggregate with indexed ranges).
- Lint (ESLint with import-boundary rules) and Prettier; strict TypeScript; no `any`.
- Unit tests required for: scheduler rating map, session selection per mode, streak boundary, both importers, minutes-to-count.
- README documents the folder rules and how to add a new screen or component.
- Add a one-line vercel.json so every route loads the app.

## 10. Build order
1. **Foundation:** project, tokens/themes, app shell, tab bar, Dexie schema and repositories.
2. **Tree and notes:** tree CRUD on Home, note import/read/edit.
3. **Cards and sessions:** card import, session setup, study screen with Wi-Fi rating, scheduler and selection, session saving.
4. **Home polish and Profile:** streak, progress ring, backup/restore, settings.
5. **Analysis:** charts from review data.
