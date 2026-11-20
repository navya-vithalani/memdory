# memdory: Change Specification (v1.1)

> **Agent: read this entire file before writing any code.** All decisions below are final. Do not ask questions; do not substitute your own design. Work phase by phase, in order.

App name everywhere (UI, manifest, README, `<title>`, file names): **memdory**. 

---

## 0. Rules for working (non-negotiable)

1. **Before coding:** read `docs/DESIGN.md`, `docs/TRD.md`, `src/styles/tokens.css`, `src/styles/themes.css`. Every new UI element must follow them. A previous attempt ignored styling; that is not acceptable again.
2. **Styling contract** (applies to every phase):
   - Use only CSS variables from `tokens.css` (`--bg --surface --ink --ink-soft --navy --indigo --indigo-tint --orange --orange-pressed --orange-tint --wave --easy --medium --hard --partial --blank --wrong --shadow-soft --shadow-card --line --radius-card --radius-large --screen-padding --safe-bottom --motion-*`). Add new tokens to `tokens.css` (and dark values in `themes.css`) instead of hard-coding hex values in components.
   - **Orange is only for primary calls to action (Start session, Import/Save confirm) and the streak flame/drops.** Never use orange for ratings, tags or decoration.
   - Rating colours are only for ratings (and the analysis charts of ratings).
   - Cards: `--radius-card` (20px). Sheets/drawers: `--radius-large` (28px). Pills: 999px. Soft indigo-tinted shadows (`--shadow-card`).
   - Font: Nunito (bundle with `@fontsource/nunito`, weights 400/600/800, if not already bundled). Formulas/code: JetBrains Mono (`@fontsource/jetbrains-mono`).
   - All tap targets ≥ 44px. Animate only `transform` and `opacity` (plus `filter: blur` where stated). Respect `prefers-reduced-motion` (replace motion with 150ms fades).
   - Light theme is default; dark theme must still work for every new component.
3. **Code structure:** follow `docs/TRD.md` section 3 exactly (core / data / hooks / ui / styles). New CSS goes in **new files** under `src/styles/components/` (one per component/screen, e.g. `tab-bar.css`, `app-menu.css`, `wifi-rating.css`) imported from `src/styles/index.css`. Do **not** add to the 1,700-line `components.css`; when you touch an old rule, move it to the right new file. No inline styles except CSS-variable values (`style={{'--x': v}}`). No `any`. Components under ~150 lines.
4. **Database:** every schema change = a new `db.version(n)` with an `.upgrade()` migration. Never edit old versions. Existing user data must survive.
5. **Done means:** `npm test` and `npm run build` pass, new logic has unit tests, and a **Style checklist** at the end of each phase is ticked. If you can run a browser, screenshot each changed screen at 390×844 and compare with DESIGN.md before moving on.

---

## Phase 1: App shell and screen layout (UI overhaul)

### 1.1 Fix header and nav bar not sticking to the screen edges (do this first)
Cause: the layout uses `min-height: 100vh/100dvh` and a scrolling document, so the mobile URL bar collapsing pushes the bottom bar off-screen.
Required structure:
```
html, body, #root { height: 100%; margin: 0; }
.app-shell  { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
.app-header { flex: 0 0 auto; padding-top: env(safe-area-inset-top, 0px); }
.app-main   { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; }
.tab-bar    { flex: 0 0 auto; padding-bottom: env(safe-area-inset-bottom, 0px); }
```
- Only `.app-main` scrolls. The window/body must never scroll.
- Remove every other `min-height: 100vh/100dvh` and `height: min(900px, calc(100dvh - …))` that fights this. On screens ≥ 600px wide, centre the shell at `max-width: 480px` (keep the desktop "phone frame" look) with `height: 100dvh`.
- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">`.
- The study session is full-screen and **hides the header and tab bar**.
- Test by scrolling down and up with the Android Chrome URL bar collapsing and in installed (standalone) mode: header and tab bar must never move or leave the edge.

### 1.2 Header
- **Left:** hamburger button (3 bars, 44px target) opening the menu (1.4).
- **Centre:** the text "memdory" (Nunito 800, `--navy`). **No logo or "R" mark.**
- **Right:** small Mnemo side view (`happy`, ~36px) with a slow swim bob. Tapping it opens Profile (`/profile`).
- Transparent over `--bg`, subtle bottom shadow only when `.app-main` is scrolled.

### 1.3 Bottom tab bar: 3 tabs
Order left to right: **Notes · Home · Cards**. Remove the Analysis tab (see 1.6).
- Bar: `--surface`, height 64px + safe area, top corners `--radius-large`, shadow `0 -6px 24px var(--shadow-soft)`.
- **Home is a raised circular button in the centre:** 68px diameter, solid `--indigo` fill, white home glyph, raised 22px above the bar, 4px `--bg` ring around it, and a concave circular notch cut into the bar behind it (draw the bar background as an SVG path with the notch). Idle: gentle 3s vertical bob (±2px). When Home is the active route: an expanding `--wave` ripple ring every 3s. Pressed: scale 0.94 spring.
- Notes and Cards: 24px icon + 12px label, `--ink-soft`; active = `--indigo` with a small wave-shaped underline (8px wide) beneath the label.

### 1.4 Menu (drawer from the left)
Slides in from the left (width 84%, max 340px), scrim `rgba(20,26,77,0.4)`, closes on scrim tap, item tap, Escape, or back. Focus-trapped. Header area: Mnemo side-happy + "memdory", with a faint wave decoration. Items (icon + label, 52px rows):
1. **Import** → opens the Import flow (Phase 4 UI; until then the existing card import)
2. **Start session** → session setup
3. **Analysis** → `/analysis`
4. **Streak & activity** → `/profile`
5. **Export backup** / **Restore backup**
6. **Settings** → `/settings`
7. **About** (version, name, Mnemo credit)
8. **Connect** (disabled, "Soon" pill)
Bottom of drawer: tiny Mnemo `sleepy` and the app version.

### 1.5 Home screen
- Remove the "X of 20 cards done today" ring and every daily-goal UI (keep the settings field in the DB, unused and hidden).
- Layout top to bottom: Mnemo greeting card (mood from 7.2, one short line); primary orange **Start session** button ("N cards about to be forgotten"); **Resume session** card (only if an incomplete session exists; shows scope, progress, Resume / Discard); **Weekly streak** (Phase 2); area cards with mastery rings; tree management (existing TreeManager, unchanged); weakest-topic nudge.

### 1.6 Cards tab
Top action row (three round 48px buttons, labelled below with 12px captions):
- **▶ Start** (orange, bigger 56px, YouTube-style play triangle)
- **＋ Add** (opens sheet: "Add a card manually" / "Import from file")
- **Browse** (grid icon, opens `/cards/browse`, see 6.1)

Below, in order: **Nemo summary card** (6.2), **search field** ("Search past sessions"), **past sessions list** (newest first; each row: date, scope name, cards done/planned, accuracy, and a badge: `Completed` in `--easy`, `Incomplete` in `--hard`; incomplete rows show Resume). No toggles, tabs or charts on this screen. Footer link on the summary card: "See full analysis" → `/analysis`.

### 1.7 Relocated screens
- `/analysis` stays as a screen but is **not in the tab bar**; reachable from the menu and the summary card link. Heatmap and streak-history components move out of it into Profile.
- `/profile` (new route, replaces old Profile tab): streak summary (current, longest), **full-history activity heatmap**, streak history, backup status. Reached via header Mnemo and the menu.
- `/settings` (new): theme toggle, daily new cards, day-start time (default 03:30), backup export/restore, "Show tags on cards" switch, "Show Mnemo in sessions" switch. Move these out of the old Profile screen.

### Style checklist (Phase 1)
- [ ] Header/tab bar stay fixed in standalone and in Chrome with URL bar collapsing
- [ ] Home button: 68px, solid `--indigo`, raised with notch, bob + ripple
- [ ] No orange outside CTAs/streak; all colours via tokens; dark theme works
- [ ] Drawer slides, traps focus, closes on Escape/scrim
- [ ] Cards tab has only: 3 action buttons, summary card, search, sessions list

---

### Phase 1 review

#### What changed

Header and tab bar: I think the old problem was that the page itself could scroll when the mobile URL bar collapsed. The window is now locked and only the screen content scrolls, so the header and tab bar stay pinned. Please test this on your phone.
Header: a hamburger on the left, “memdory” in the middle and Mnemo on the right, which opens Profile. The “R” logo is gone.
Tabs: Notes, Home and Cards. Home is a raised 68px indigo circle with a notch cut into the bar, a gentle bob and a ripple when active.
Menu: a drawer from the left with Import, Start session, Analysis, Streak & activity, Backup, Settings, About and Connect (marked “Soon”).
Home: the “X of 20 cards” ring is removed.
Cards tab: a Start (▶) button, Add and Browse, then a Mnemo summary card, a search box and past sessions with Completed/Incomplete badges.
Profile and Settings: Profile now shows your streak and the heatmap. Settings has your preferences and backup. Analysis stays reachable from the menu.
Fonts: bundled so they also work offline.

#### Placeholders for later phases

Summary card: the message is a placeholder until Phase 6.
Browse cards: shows a “coming soon” page until Phase 6.
Completed/Incomplete badges: these are a rough guess for now. Real status and resuming come in Phase 2.
Heatmap: it still shows 35 days, not full history.
Manual card form: I moved it behind the Add button but didn’t restyle it

## Phase 2: Sessions and streak

### 2.1 Root causes found in the current code
- `WeeklyStreak.tsx` does not use real study days. It draws the last 7 days ending today/yesterday and fills the last `streak` drops, so it looks "stuck". Labels like "W18/T19" mix weekday letter and date.
- Streak is derived from **any review** (`db.reviews` keys) instead of finished sessions.
- A session row is created with `endedAt = startedAt` at creation, so completed and abandoned sessions cannot be told apart.
- Could not reproduce "stuck at 1 day" from the maths alone, so write the failing test first (2.5).

### 2.2 Session model
Add to `sessions`: `status: 'in-progress' | 'completed' | 'abandoned'`, `queueCardIds: string[]`, `position: number`, `completedAt: number | null`. Migration: old sessions with `completedCount >= plannedCount` → `completed`, others → `abandoned`.
- Rating a card advances `position` and saves it (so refresh/close keeps progress).
- Leaving mid-session shows: "Save and exit? You can continue this session later." (Exit / Keep studying). Status stays `in-progress`.
- Starting a new session while one is `in-progress` prompts: **Resume**, **Discard and start new**, Cancel.
- Reaching the end of the queue sets `completed` and `completedAt`.

### 2.3 Streak rules (pure functions in `core/streak`)
- A **study day** runs 03:30 to 03:30 local time (`dayStartMinutes` = 210).
- A day counts only if it has ≥ 1 session with `status = 'completed'` (use `completedAt`).
- Current streak = consecutive counted days ending today; if today has none, count back from yesterday (the streak is "at risk" but alive); if yesterday is also missing → **0**.
- Longest streak computed the same way over all days.
- Incomplete sessions never count.

### 2.4 Weekly streak widget (Home)
- Shows the **current week, Monday to Sunday**, 7 drops, labels `Mon Tue Wed Thu Fri Sat Sun` (3 letters, no dates).
- A drop is *filled* only if that study day has a completed session. Today has an indigo ring; future days are dimmed.
- Water animation: when it first appears, filled drops animate level 0 → full over 900ms (`ease-out`), then two offset wave paths drift horizontally in a 3s loop (`transform: translateX` only, clipped to the drop shape). Empty drops are plain outlines. Reduced motion: static fill.
- Full history lives in Profile (heatmap).

### 2.5 Completion celebration
When the **first completed session of a study day** finishes: full-screen overlay with Mnemo `excited`, big streak number counting up from the old value to the new one (600ms), the day's drop filling, confetti pieces in `--orange --indigo --wave --partial` (~24 pieces, 1.6s), haptic `[20,40,20]`, and an orange **Continue** button. Further sessions the same day show the normal summary without the streak overlay.

### 2.6 Tests (write first)
- Completed session on Sunday, now Thursday → streak 0.
- Sessions on Mon, Tue, Wed completed, now Wed → 3; now Thu with none → 3 (at risk); now Fri → 0.
- Abandoned/in-progress sessions never count.
- 03:29 counts for the previous day; 03:30 for the new day.
- Add a temporary "Study days" debug list in Settings → About showing counted day keys.

### Style checklist (Phase 2)
- [x] Drops: blue outline for today and future days, grey outline for missed days, filled blue drop for completed days (changed from the original indigo ring and `--orange` water on request), 3-letter day labels, Monday first
- [x] Celebration uses only token colours; Mnemo mood `excited`

### Phase 2 review

#### What changed

Sessions: every session now has a real status (in progress, completed or discarded), a saved queue and a position, so closing the app or leaving mid-session keeps your place. Starting a new session while one is open asks Resume or Discard.
Streak: it is counted from completed sessions only, using the 03:30 study day. The old 365-day cap is gone, so long streaks count correctly.
Weekly widget: shows the real Monday to Sunday week. Each day is just a drop: filled blue if you completed a session, a blue outline for today and days still to come, and a grey outline for days you missed. The extra ring around today is removed.
Celebration: it was never appearing. The session list was loaded before the session was marked completed, so the check always said no. It now runs after completion, over all completed sessions, and shows the old and new streak.
Past sessions: every row opens a detail sheet listing each card with the rating you gave it, how long it took, and a count per rating. Unfinished sessions show how many cards are still waiting and a **Continue session** button (also on the row itself).
Resuming: the "% remembered" figure used to restart at 0 after resuming. It is now rebuilt from the saved reviews, and a card already marked wrong will not be re-queued a second time.
Settings are now loaded once and shared by every screen (before, each screen had its own copy, so Mnemo's position and the theme could disagree).
Two layout bugs that broke overlays: screens kept a leftover animation transform that trapped every pop-up inside the screen, and a generic `.app-frame > *` rule forced the menu drawer and the celebration into normal page flow. The drawer now covers the screen and has its own close button.
Housekeeping: compiled copies of the Vite config and the TypeScript build files are no longer committed (a stale `vite.config.js` was silently overriding `vite.config.ts`). Rating-to-scheduler mapping now lives only in `ratingMap.ts`.

#### Placeholders and known gaps

Discarded sessions can be viewed but not continued. Discarding is deliberate, so I left it that way.
The celebration drop is still orange while the weekly drops are blue.
Session history shows the 20 most recent sessions.
The "Update ready" message from the PRD is not built yet (Phase 7, PWA).

---

## Phase 3: Study screen

Full-screen, no header/tab bar. Only three things on screen: the card, the rating control, and Mnemo. (Plus a thin top bar: close ✕, wave-filled progress bar, timer.) **No extra buttons or toggles.**

### 3.1 Layout
- Card at the top, centred, up to ~55dvh, flips on tap (3D, 600ms spring). Text scrolls inside if long.
- Rating control pinned bottom centre with `padding-bottom: calc(var(--safe-bottom) + 12px)`.
- Remaining space is Mnemo's playground.
- Tags (if any and the setting is on): max 2 small tags hanging from the card's top edge on a thin string, swaying ±3° over 4s, "+N" if more. Subtle; never overlapping text.

### 3.2 Wi-Fi rating control (rebuild from scratch; delete the line-based version)
Each **button is itself a curved arc-shaped segment**; there are **no background arc lines**.
- Component `WifiRating`, a single SVG, `viewBox="0 0 360 210"`, centre point `(180,172)`.
- **Dot (Wrong):** circle r=30 at the centre.
- **Middle band:** radii 36 to 82, spans **130°** (from −155° to −25°, measured from +x, y down), split into **2** segments: Partial (left), Blank (right).
- **Outer band:** radii 88 to 138, same 130° span, split into **3** segments: Easy (left), Medium (centre), Hard (right).
- The wide span makes the arc ends reach down beside the dot so Wrong sits inside the fan, not under it.
- Gaps: 6px radially between bands and dot; ≈5px along the arc between segments (angle = 5/radius).
- **Rounded corners:** build each segment as an annular sector inset by 4px, then paint with an 8px stroke of the same colour and `stroke-linejoin: round`.
- **Curved labels:** `<textPath>` on each segment's centre-line arc, `startOffset="50%" text-anchor="middle"`, 13px (outer) / 12px (middle) weight 700, letter-spacing 0.3px. Dot label "Wrong" 12px, straight.
- Colours: `--easy --medium --hard` (outer), `--partial --blank` (middle), `--wrong` (dot). Label colours: dark `#0B2A22` on Easy, dark `#3A2A00` on Hard, white elsewhere.
- Width `min(100%, 360px)`, compact, centred. Each segment must be ≥ 44px tall/wide at the smallest phone width (320px); scale the SVG, never wrap.
- **States:** before flip: `opacity .35`, `scale .96`, `pointer-events: none`. On flip: lights up in a stagger from the dot outward (dot 0ms, middle 80ms, outer 160ms, 200ms each, spring). Tap: scale to 1.07 then 0.96, haptic 10ms (30ms for Wrong), then the next card slides in.
- Mapping to scheduler is unchanged (`ratingMap.ts`).

### 3.3 Mnemo companion (draggable, pinch-resizable, reactive)
- Uses the **front-view** SVGs, inlined so layers can animate.
- **Drag:** anywhere inside the study area (Framer Motion `drag`, `dragMomentum: false`, constraints = the study container). While dragging: cursor grab, slight tilt, scale 1.05. He stays where dropped.
- **Resize:** two-finger pinch on Mnemo only (pointer events, scale 0.6× to 1.8× of 96px). Desktop: Ctrl+wheel over Mnemo. No visible controls.
- Position and size persist (settings table) and are clamped back into view on resize/orientation change.
- He renders **below** the rating control (z-index) and never blocks its taps.
- **Reactions** (reset to `neutral` 1.2s after the next card appears): Easy/Medium → `happy` + hop; Hard/Partial → `neutral` + small wiggle; Blank → `sad`; Wrong → `shocked` + shake and a brief coral flash on the card edge. Idle: blink every 4 to 6s, slow bob.
- Respect Settings → "Show Mnemo in sessions".

### Style checklist (Phase 3)
- [x] Rating control is shaped buttons only, curved text, rounded corners, no lines
- [x] Wrong dot sits inside the arc ends
- [x] Study screen contains card, control, Mnemo, thin top bar, nothing else
- [x] Mnemo drag + pinch work on a phone; rating buttons remain tappable (checked with simulated touch and mouse in a headless browser, please confirm with real fingers)

### Phase 3 review

#### What changed

Study screen: full screen, with no header or tab bar. It has a thin top bar (close ✕, a wave-filled progress bar and a timer showing how long this sitting has lasted), the card, the rating control and Mnemo. The end-of-session and celebration screens are full screen too.
Card: sits at the top, up to 55% of the screen height, and flips in 3D with a spring. Long text scrolls inside the card. Line breaks in answers are kept. After you have seen the answer once, flipping back to the question does not lock the rating control again. When a new card arrives it slides in from the right. With reduced motion the flip becomes a quick fade.
Rating control: the old line-based version is deleted. It is now one SVG (`WifiRating`) with five curved segments and the Wrong dot, built from the geometry in the spec (`core/rating/wifiGeometry.ts`, unit tested). Labels are curved, corners are rounded, and the control lights up from the dot outwards after the flip. Tapping a segment gives a small press animation and a short vibration (longer for Wrong). Wrong also flashes the card edge and shakes it.
Mnemo: drag him anywhere, pinch with two fingers (or Ctrl + wheel on desktop) to resize from 0.6x to 1.8x. His position and size are saved in settings and always clamped inside the screen. He sits under the rating control, so he never blocks it. He reacts to each rating: happy and a hop, a wiggle, sad, or shocked and a shake. Settings > "Show Mnemo in sessions" turns him off.
Code structure: the session logic moved out of the component into `useStudySession`, and the screen is split into `StudyTopBar`, `StudyCard`, `WifiRating` and `MnemoCompanion`. Study and rating styles now live in their own files and the old rules are removed from `components.css`.

#### Placeholders for later phases

Tags on the card: no tags exist in the data yet, so nothing is shown. They arrive with the Phase 4 schema and the Phase 7 tag UI.
Dragging uses pointer events instead of Framer Motion's `drag`, because the pinch gesture needs to share the same touch handling.
The middle band's segments are about 41px thick at a 320px-wide screen (the spec asks for 44px). They are wider than 44px along the arc, and on a 390px phone they are 46px thick.
Mnemo's reaction settles back to neutral 1.4s after you rate, rather than 1.2s after the next card appears.
Mnemo's front artwork is the existing asset; the blink and bob are the existing idle animations.

---

## Phase 4: Database v3, import/export, card upgrades


### 4.0 Hygiene rules (apply to everything in Phases 4 to 7)
- Every schema change is a new `db.version(n)` with an `.upgrade()`; never edit old versions. All multi-table writes run in **one transaction**.
- Store only primary data. Never store derived values (counts, table of contents, streaks, families, layout).
- IndexedDB cannot index booleans: do not put boolean fields in index strings; filter them in memory.
- Set `updatedAt` on every edit. Unknown note `type` values and unknown keys in `data`/`style` must be **preserved and rendered safely** (fallback to a plain note), so new types never need a migration.
- Handle `db.on('versionchange')` (close the connection and reload) so a second open tab cannot block an upgrade.
- Catch `QuotaExceededError` and show a friendly message; keep `navigator.storage.persist()` on first run.
- Colours are stored as **palette names**, never hex, so dark mode keeps working.
- Dependencies allowed: `katex`, `remark-math`, `rehype-katex` (plus mhchem from KaTeX), and dev-only `fake-indexeddb` for migration tests.

### 4.1 Schema (version 3)
```
nodes       id, parentId, order, createdAt                    (+ updatedAt field)
cards       id, nodeId, *tagIds, sourceKey, importId, createdAt, updatedAt
reviewItems id, cardId, due, [cardId+direction]
reviews     id, reviewItemId, cardId, sessionId, timestamp, dayKey
sessions    id, startedAt, endedAt, dayKey, status
notes       id, nodeId, [nodeId+order], *tagIds, sourceKey, importId, updatedAt
tags        id, &name
imports     id, timestamp
settings    id
```
**cards** (content only): `id, nodeId, front, back, explanation: string|null, tagIds: string[] (first tag = the card's label), kind: 'basic', direction: 'one-way'|'both', starred: boolean, paused: boolean, sourceKey: string|null, importId: string|null, createdAt, updatedAt`.
**reviewItems** (one per direction; all scheduling lives here): `id, cardId, direction: 'forward'|'reverse', due, stability, difficulty, state, reps, lapses, lastReview, trap: boolean, createdAt`.
**reviews** (append-only log, never edited): `id, reviewItemId, cardId, sessionId, rating: ReviewRating (raw six-way), fsrsRating: 'again'|'hard'|'good'|'easy', fsrsLog: object|null (the ts-fsrs log entry: state, due, stability, difficulty, elapsed_days, scheduled_days), durationMs, timestamp, dayKey: string, studyMode: 'single'|'family'`.
**sessions**: existing fields plus `dayKey`, `scopeName: string`, `tagFilter: string[]`, `viewMode: 'cards'|'families'`, and `queueItemIds` (reviewItem ids; replaces `queueCardIds`).
**tags**: `id, name (normalised key: trimmed, lower-case, single spaces; unique index), label (display text, casing of first use), createdAt`.
**notes**: `id, nodeId, type: string, title: string|null (optional), body: string (Markdown + LaTeX), data: object|null (type-specific, e.g. mnemonic {cue, meaning, story}), tagIds, color: string|null (palette name), style: {bold?, size?: 'sm'|'md'|'lg', font?: 'sans'|'mono'|'serif'}|null, starred, order: number, sourceKey, importId, createdAt, updatedAt`. **No width or layout fields**; layout is decided by the UI per type.
**imports**: `id, fileName, timestamp, mode: 'paths'|'into-node', counts: {nodes, cards, notes, tags, updated, skipped}, status: 'applied'|'undone'`.
**settings**: add `desiredRetention` (default 0.9, passed to ts-fsrs as `request_retention`).
`dayKey` is the study day string (`YYYY-MM-DD`) computed **at write time** with the day-start setting in effect then (default 03:30), so changing the setting or time zone never rewrites past streaks.

### 4.2 Migration v2 → v3
Write `.upgrade()` so that, for every existing record:
- **cards:** keep the same `id` (so old reviews stay valid). Create content fields with `tagIds: []`, `kind: 'basic'`, `direction: 'one-way'`, `explanation: null`, `starred: false`, `paused: false`, `sourceKey: null`, `importId: null`, `updatedAt = createdAt`. Create one `reviewItems` row (`direction: 'forward'`) holding the old FSRS fields and `trap`. Then remove those scheduling fields from the card.
- **reviews:** set `reviewItemId` to that card's item, `fsrsRating` from the existing rating map, `fsrsLog: null`, `studyMode: 'single'`, `dayKey` from `timestamp`.
- **sessions:** `dayKey` from `endedAt` (or `startedAt` if in progress), `scopeName` from the node (or "All topics"), `tagFilter: []`, `viewMode: 'cards'`, convert `queueCardIds` → `queueItemIds`.
- **notes:** `type: 'normal'`, `data: null`, `tagIds: []`, `color: null`, `style: null`, `starred: false`, `sourceKey/importId: null`, `order` = position by `createdAt` within each node; keep `title`.
- **nodes:** add `updatedAt = createdAt`.
Test with `fake-indexeddb`: seed a v2 database with sample data, open v3, assert nothing is lost and every field above is set.

### 4.3 Pre-upgrade safety export
Before the v3 database is opened, if `Dexie.exists('remembree-db')` and the existing version is below 3, open it dynamically (`new Dexie('remembree-db').open()`), export every table to JSON, trigger a download named `remembree-pre-upgrade-YYYY-MM-DD.json`, close it, then continue. Show a one-time banner: "We saved a safety copy of your data."

### 4.4 Behaviour rules
- **Two-way cards** (`direction: 'both'`): one `cards` record plus two `reviewItems` (forward and reverse). The reverse item shows the back as the prompt. Editing the card edits both views. Changing `both` → `one-way` removes the reverse item but keeps its reviews.
- **Session selection** operates on `reviewItems` joined with `cards`; exclude `paused` cards; cards keep their reviews if deleted (hard delete the card and its items; analysis must ignore reviews whose card no longer exists). The daily new-card cap counts reviewItems first reviewed today.
- **Tags:** the **first tag is the card's label**. Tag names are normalised (4.1). Renaming a tag changes `label`. Deleting a tag removes it from all cards/notes; if it was a card's first tag, the next tag becomes the label. Tag counts per scope are queries on the `*tagIds` index.
- **Families are derived, not stored:** cards in the same node with the same normalised `front` form a family (`familyKey = nodeId + '|' + normalise(front)`). No group id exists.
- **Dedupe key** for cards without an `ID:`: `nodeId + normalise(front) + firstTag`; for notes: `nodeId + normalise(title or first line of body)`.
- **Star and pause** apply to cards (and star to notes). Add a "Starred only" switch to the session setup.

### 4.5 Import file format (`.txt` or `.md`)
Line-oriented; **labels** start a field (case-insensitive); text continues on following lines until the next label or a blank line (note bodies continue until `---` or the next starter). Block starters: `@`, `Q:`, `NOTE:`.

**Path line** (creates or selects the node; first segment = area, deeper segments = children; existing nodes matched by trimmed, case-insensitive name under the same parent):
```
@ JEE > Chemistry > P-Block > Group 15
```
**Card:**
```
Q: XeF4
A: sp3d2, square planar
WHY: Two lone pairs sit opposite each other.   (optional explanation)
TAGS: hybridisation, vsepr                      (first = label; optional)
TWO-WAY: yes                                    (optional, default no)
STAR: yes                                       (optional)
ID: vsepr-xef4-hyb                              (optional stable id)
```
Questions should be very short (a few words) and put the type of question in the first tag. Multi-line answers keep their line breaks.
**Note:**
```
NOTE: Ideal gas equation                        (title; may be left empty)
TYPE: formula   (normal | concept | formula | mnemonic | trick | table; default normal)
COLOR: sky      (palette name; optional)
STAR: yes
TAGS: gas laws
ID: gas-ideal
BODY: $$PV = nRT$$
```
Mnemonic notes use `CUE:`, `MEANS:` and optional `STORY:` instead of `BODY:`. Tables use a Markdown table in `BODY:`.
**Updates:** an item whose `ID:` matches an existing item's `sourceKey` **updates its content** and keeps scheduling and history. Items without a matching ID use the dedupe keys above and are skipped if they exist. The preview shows New / Update / Skipped counts.
**Modes (chosen in the UI):** (1) *Use the paths in the file*; (2) *Put everything inside the selected node* (paths become relative sub-paths; a file with no paths puts everything in that node). Legacy tab-separated card files are accepted in mode 2 only.
**Implementation:** pure parser in `core/importers/importParser.ts` returning `{nodesToCreate, cards, notes, tags, updates, skipped, errors: [{line, message}]}`; applying it happens in a repository function inside **one transaction**. Size guard: warn above 5,000 items or 5 MB.

### 4.6 Import UI (one flow for menu, Cards ＋ and Notes)
Bottom sheet in 3 steps: choose file; choose mode (and target node for mode 2); **preview** (counts, collapsible error list with line numbers, "Update items with matching ID" switch, default on). Orange **Import** button disabled while there are blocking errors. Success: toast + Mnemo `excited`; failure: Mnemo `shocked`.

### 4.7 Import batches and undo
Every applied import creates an `imports` row and stamps `importId` on the nodes, cards and notes it created. **Settings → Imports** lists them; **Undo** deletes what that batch created (cards with their reviewItems; notes; empty nodes; tags that become unused) and sets `status: 'undone'`. Updates made by a batch are not reverted. Warn when any created card already has review history.

### 4.8 Export (two kinds, both in Settings and the menu)
1. **Full backup (`.json`)**: export **every table** by iterating `db.tables` (never a hard-coded list), plus `schemaVersion: 3`, `appVersion` and `exportedAt`. Importing accepts schema versions 1, 2 and 3 and upgrades older payloads to the current shape (same transformations as 4.2). Restore offers **merge** or **replace** with confirmation and shows record counts afterwards. File name `remembree-backup-YYYY-MM-DD.json`; use the Web Share API on mobile when available, else download. Update `lastBackupAt`.
2. **Content export (`.txt`)**: writes the tree (as `@` paths), cards, notes and tags in the import format of 4.5, **including `ID:` lines** (generate and save a `sourceKey` for any item that lacks one), colours, stars, types and order, but no scheduling or history. Round-trip test: export content, import it into an empty database, and assert nodes, cards, notes, tags and order match.

### 4.9 Study screen additions
- Above the question show a small line with the card's **topic** (its node name, `--ink-soft`, 12px) and, if the card has tags, its **label chip** (first tag). Keep the question itself short and large.
- Card fronts, backs and explanations render through a shared `RichText` component supporting line breaks and **LaTeX** (`$…$` inline, `$$…$$` display, `\ce{…}` chemistry) via KaTeX, lazy-loaded, fonts self-hosted and precached (extend the workbox glob if needed). If LaTeX fails to parse, show the raw text instead of crashing.
- The optional explanation appears under the answer after the flip, smaller and in `--ink-soft`.

### 4.10 Tests (write first where possible)
Migration (4.2) with `fake-indexeddb`; importer: paths, relative mode, tags with first-tag label, two-way, `ID:` updates versus duplicates, errors with line numbers, rollback on failure; undo of an import; families derived from same node + front; tag rename/delete behaviour; backup round trip including old-version payloads; content export round trip.

### Style checklist (Phase 4)
- [x] Import sheet, preview and Settings → Imports use tokens only; orange only on the Import button
- [x] Label chip and topic line are small and do not crowd the question
- [x] No schema change breaks existing data (safety export appears once)

---

### Phase 4 review

#### What changed

1. **Rebranding to `momdory`**:
   - Updated the app name across UI components, `index.html`, `src/constants.ts`, `package.json`, `vite.config.ts`, `README.md`, and PWA manifests.

2. **Database v4 Schema & Migration (`src/data/db.ts`)**:
   - Added `version(4)` with automatic migration preserving previous v1/v2/v3 data.
   - Cleanly separated pure content into `cards` and all scheduling state (FSRS due, stability, difficulty, reps, lapses, lastReview, trap) into `reviewItems`.
   - Added dedicated tables for `tags`, `imports`, and enhanced `notes` and `sessions`.
   - Implemented automatic pre-upgrade safety backup (`src/data/backup/preUpgrade.ts`) to download a JSON snapshot before upgrading legacy databases.

3. **Unified Importer & Parser (`src/core/importers/importParser.ts`)**:
   - Robust line-oriented parser supporting `@ Path`, `Q:`, `A:`, `WHY:`, `TAGS:`, `TWO-WAY:`, `STAR:`, `ID:`, and `NOTE:` blocks (`TYPE:`, `COLOR:`, `CUE:`, `MEANS:`, `STORY:`, `BODY:`).
   - Supports two import modes: (1) hierarchy defined by file `@` paths, or (2) relative scoping into the selected node.
   - Preserves line breaks in multi-line answers and stories, and handles DOS/Windows CRLF and Unix LF.

4. **Import Transactions & Undo (`src/data/repositories/importRepository.ts`)**:
   - Executes all additions, tag mappings, and ID-based updates within a single Dexie transaction.
   - Implemented `undoImport(importId)` in Settings to safely roll back imported cards, review items, notes, empty nodes, and orphaned tags.

5. **Backups & Content Export (`src/data/backup/backup.ts`)**:
   - **Full JSON Backup**: Dynamically exports and imports all Dexie tables with automatic schema compatibility across versions 1, 2, 3, and 4.
   - **Content Export (`.txt`)**: Round-trips nodes, cards, notes, and tags formatted cleanly according to the import spec with stable ID generation.

6. **RichText Component with LaTeX Support (`src/ui/components/RichText.tsx`)**:
   - Integrated `katex`, `remark-math`, and `rehype-katex` for inline `$..$` and display `$$..$$` equations, complete with self-hosted KaTeX fonts and graceful fallback if syntax errors occur.

7. **Study Screen Additions (`StudyCard.tsx`, `StudySession.tsx`)**:
   - Display topic name and first-tag label chip above question prompts.
   - Reverse prompt display for two-way reverse review items with a distinct direction chip.
   - Full LaTeX rendering and post-flip explanation display.

8. **User-Requested UI/UX Refinements**:
   - **App Drawer Menu with Ocean Wave Art (`AppMenu.tsx`, `app-menu.css`)**: Replaced the big text header with an animated ocean-wave header where Mnemo swims gently across layered blue waves.
   - **3D Tactile Wi-Fi Rating Button (`WifiRating.tsx`, `wifi-rating.css`)**: Widened to 390px with tactile mechanical push caps, shaded bevels, and realistic button depression.
   - **Home Screen Remodel (`HomeScreen.tsx`, `home-screen.css`)**: Replaced the redundant blue hero start-session button with a mascot speech bubble showing ranked analysis insights, and added a quick Import button.
   - **Header Screen Titles (`AppHeader.tsx`, `app-header.css`)**: Thickened header to host centered screen titles (Home, Notes, Cards, Analysis, Profile, Settings) and tiny `momdory` branding under Mnemo; eliminated duplicate screen taglines.
   - **Full-Fill Streak Droplets (`WeeklyStreak.tsx`, `weekly-streak.css`)**: Replaced circular droplet clip with a full teardrop path so that streak droplets fill completely to the tip.

9. **Verification & Tests**:
   - 44/44 unit tests passing across 6 test suites covering migrations, import parser, import repository, backup round-trips, and core scheduler logic.
   - `npm run build` succeeds with zero errors.

---

## Phase 5: Notes

### 5.1 Note types and their looks
Each type has its own look; `type` is a free string so new types only need UI. Titles are **optional** for every type except `concept` (empty shows "Untitled").
| Type | Look and behaviour |
|---|---|
| `normal` | Markdown text with LaTeX; headings can collapse |
| `concept` | **Toggle block**: title row with a chevron, tap to open/close with a smooth height animation; body inside |
| `formula` | Highlighted box, display LaTeX centred, optional title as a small caption |
| `mnemonic` | **Memory box**: shows the cue; morphs in place to the meaning (right swipe, double-tap or "Show meaning") and to the story (left swipe); see 5.8. Thin tile when collapsed |
| `trick` | Callout with an accent bar and a small lightning glyph |
| `table` | Markdown table in a horizontally scrollable container with sticky first column; tap a column header to collapse/expand that column; tap a row to highlight it. (Focus-on-one-row mode is deferred.) |
Unknown types fall back to the `normal` look.

### 5.2 Colour (no icons)
Fixed palette of names: `indigo, sky, mint, sun, rose, violet, slate`. Add tokens for each (`--note-<name>-bg`, `--note-<name>-accent`, `--note-<name>-ink`) in `tokens.css` with dark-theme values. Default colour by type: concept indigo, formula sky, mnemonic violet, trick sun, table mint, normal none. Orange is never used.

### 5.3 Long-press menu on a note
Colour swatches; Bold; Text size (S/M/L); Font (Sans/Mono/Serif); Star/Unstar; Edit; Move up; Move down; Delete (confirm). Colour is saved in `color`, text options in `style`.

### 5.4 Layout (UI only; nothing stored)
- A topic shows its notes as a two-column grid that **preserves note order** (no `grid-auto-flow: dense`).
- Default widths by type: `mnemonic`, `trick`, `formula` = half width; `normal`, `concept`, `table` = full width. Consecutive half-width notes sit side by side; a full-width note ends the row. An expanded mnemonic spans the full width and the following notes reflow below it (animate with Framer Motion `layout`).
- Later enhancement (not now): stacking two small tiles beside one tall tile.

### 5.5 Table of contents (calculated, not stored)
A chip bar at the top of each topic listing its notes by title (untitled notes use "Formula 1", "Trick 2", …). Tap to scroll to the note with a brief highlight. Filters: type chips, starred, tag.

### 5.6 Order
`order` is stored per note within its node. Move up/down reorders and reindexes. Imported notes are appended after existing ones in file order.

### 5.7 Search, filters and editor
- Search field covers title, body, cue, meaning, story and tags within the selected scope; combine (AND) with type, tag and starred filters.
- Editor fields depend on type (all: optional title, colour, tags; mnemonic: cue, meaning, story; others: body with LaTeX preview). Type is switchable. Editing happens in place, with Save and Cancel.
- Notes render through the same `RichText`/Markdown pipeline (`react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, mhchem).

### 5.8 Memory box morph recipe
One highlighted box with up to three faces: **Cue**, **Meaning**, **Story** (only if present). A three-dot indicator with tiny labels shows the current face.
- The **box does not slide**. During a swipe it moves at most 8px with an elastic hint, then springs back.
- Framer Motion `AnimatePresence` with `layout` on the box so its height animates (450 to 700ms). Split text into word tokens. Outgoing words: `opacity 1→0`, `blur 0→6px`, `y 0→-6px`, stagger 15ms. Incoming words: `opacity 0→1`, `blur 6→0`, `y 6→0`, stagger 15ms, starting after ~35% of the outgoing animation. Total stagger capped at 400ms.
- Reduced motion: 200ms cross-fade. A small label ("Meaning", "Story") fades in above the text in `--indigo`.

### Style checklist (Phase 5)
- [ ] Each type is visibly different; colours come from palette tokens; works in dark mode
- [ ] Long-press menu works on touch and does not scroll the page
- [ ] Table scrolls horizontally with sticky first column; LaTeX renders offline
- [ ] Morph feels like text transforming in place, not a card sliding

---

## Phase 6: Browse cards, tags in analysis, Nemo summary

### 6.1 Browse cards (`/cards/browse`)
- Top stat strip: **Total · Due · Fading · Traps**. *Due* = `due ≤ now`; *Fading* = reviewed and recall < 0.8; *Traps* = flagged by Wrong.
- Tree list: each node row shows name, counts (total/due/fading), a mastery bar. Tap to expand children; tap a node's "View cards" to open its card list.
- Card list: search field and tag filter chips (with counts per tag in the current scope); each card collapsed shows the front, tap expands to show the back, explanation, tags (first = label) and a ↔ badge for two-way. Inline **Edit** (front, back, explanation, tags, two-way, star, paused) and **Delete** (confirm). Cards sharing a front show a small family count. **Add card** button creates a card in the current node.
- Page size 50 with "Load more".

### 6.2 Nemo summary card (top of Cards tab, also top of Analysis)
Rule-based, **not AI**. A pure function `buildInsights(stats)` in `core/stats/insights.ts` returns ranked insights; show the top 2 in a speech bubble (max 220 characters) beside Mnemo (front view; mood chosen by the top insight). Text fades in word by word (same technique as 5.3, 250ms).
- Accuracy = (easy + medium + hard + 0.5 × partial) ÷ total reviews. Window: last 14 days unless stated.
- Candidate insights (priority high → low):
  1. Incomplete session exists → "You have an unfinished session. Want to pick it up?"
  2. Streak milestone (7, 14, 30, 50, 100) → celebratory; Mnemo `excited`
  3. Streak at risk (streak ≥ 3 and no completed session today) → nudge
  4. Struggling tag: lowest accuracy among tags with ≥ 10 reviews and accuracy < 60% → "{tag} is giving you trouble: {x}% right over {n} reviews." Mnemo `sad`
  5. Confidently wrong: ≥ 5 Wrong ratings in 7 days → names the topic with most
  6. Strongest tag: ≥ 10 reviews and accuracy ≥ 90%
  7. Weakest topic by current recall
  8. Volume change vs previous 7 days (±30%)
  9. Speed change in average seconds per card (±15%)
  10. Fewer than 20 total reviews → "Finish a few sessions and I'll start spotting patterns."
- Unit-test every rule with fixed data.

### 6.3 Tags in analysis (`/analysis`)
Add: **Tag performance** list (accuracy bar, review count, avg seconds), grouped into **Struggling** (< 60%) and **Strong** (≥ 90%), minimum 10 reviews, plus a tag filter for the existing charts. Keep all existing charts; the heatmap and streak history are now in Profile.

### 6.4 Family study mode and session spacing
- Session setup gets a small two-option chip, **Single cards | Families** (default Single), and a **Starred only** switch.
- **Single mode spacing:** cards of the same family (4.4) are kept at least 5 positions apart in the queue when possible (`core/session/spreadFamilies.ts`, with tests).
- **Family mode screen:** the shared front (e.g. "XeF₄") and topic line at the top; below it **thin rows, one per due card in the family**, each showing its label tag. Tap a row to reveal that answer; then grade that row with three buttons: **Got it**, **Blank**, **Wrong**. No Wi-Fi control here. Show only the family members that are due.
- Mapping: Got it → `medium` (fsrs `good`); Blank → `blank` (fsrs `again`); Wrong → `wrong` (fsrs `again` and `trap = true`). Each row is saved as its own review with `studyMode: 'family'`. The family summary shows "3 of 4".
- Mnemo companion and reactions work as in 3.3, reacting to each row.

---

## Phase 7: Mnemo everywhere, tags UI, polish

### 7.1 Mnemo component
Support every mood file already in `src/assets/mascot/`: side `happy, excited, sad, sleepy, rotten`; front `neutral, happy, sad, shocked`. Keep them **inlined** (`?raw`) so layers can be animated with CSS on the named groups: `#tail` (wag ±8° about its left-centre, `transform-box: fill-box`), `#eye`/`#eye-left`/`#eye-right` (blink via `scaleY`), whole-fish bob (±4px, 4s) and bubbles float up on a loop. Pause all when `prefers-reduced-motion`.

### 7.2 Where each mood appears
- **Home greeting** by days since the last completed session `d`: 0 to 1 → `happy`; 2 → `sleepy`; 3 to 4 → `sad`; ≥ 5 → `rotten`. After completing a session the fish switches to `happy` with a short revive animation (rotate from belly-up with bubbles).
- Session complete, milestones, successful import → `excited`. Import error → front `shocked`. Empty states → `sleepy`. Loading → `happy` swimming.
- Header right: `happy` always.

### 7.3 Tags UI
The first tag (the card's label) shows as a chip above the question (4.9); other tags are small rounded pills with a pointed left end (like a luggage tag) connected by a thin string to the item (Browse cards, note rows; and 3.1 on the study card). Colours from the hashed indigo/cyan family. Sway ±3° over 4s, staggered per tag, disabled by Settings or reduced motion.

### 7.4 PWA and housekeeping
- Add `remembry-icon-peek.svg` (supplied) to `public/`, generate icons from it with `@vite-pwa/assets-generator` (192, 512, **separate maskable 512** with the artwork inside the 80% safe zone, Apple 180). Manifest: `name`/`short_name` = Remembree; separate `purpose: 'any'` and `purpose: 'maskable'` entries pointing at different files.
- README: update the screen list, import format, and the Phase notes.

### Final acceptance (whole app)
- [ ] Tabs: Notes · Home · Cards; Analysis only via menu; Profile via header Mnemo/menu
- [ ] Header and tab bar never leave the screen edges
- [ ] One completed session counts for the day; incomplete sessions can be resumed
- [ ] Study screen has only the card, Wi-Fi control and Mnemo
- [ ] One import file can build areas, nodes, notes, cards and tags; the same file can be imported into a single node; imports can be undone
- [ ] Full backup restores everything into a clean install; content export round-trips
- [ ] Families study mode works with Got it / Blank / Wrong
- [ ] Two-way cards schedule each direction separately
- [ ] Tags appear in sessions, browse, notes and analysis
- [ ] Mnemo moods wired as in 7.2
- [ ] `npm test` and `npm run build` pass; style checklists ticked