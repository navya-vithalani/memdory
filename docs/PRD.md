# Remembry: Product Requirements (v1)

## 1. Summary
Remembry is a personal, offline-first flashcard and notes app for exam prep (JEE/BITSAT first, any subject later). It runs as an installable PWA on Android. The mascot is **Mnemo**, a clownfish. The theme is **waves**: ocean, Wi-Fi arcs, signal.

**Vibe:** fun, alive and polished, never childish. Calm surfaces, playful motion, one warm accent.

## 2. User
One user (the owner), studying daily on a phone, often in short sessions. Data lives on the device.

## 3. Priorities
| Priority | Scope |
|---|---|
| **P1 (must work)** | Custom tree, notes (import, read, edit), flashcards (import, sessions, 5-way rating), correct card selection by the scheduler |
| **P2** | Saved session history |
| **P3** | Analysis (charts, trends, streak views) |

Everything below is v1. Nothing else should be built.

## 4. Navigation
Bottom tab bar: **Home · Notes · Cards · Analysis · Profile**. Mnemo appears on Home, empty states, session end and loading.

## 5. Features

### 5.1 Tree (managed on Home)
- User creates, renames, reorders, moves and deletes nodes. Depth is unlimited (e.g. JEE → Chemistry → P-Block → Group 15 → Deck).
- Root nodes are "areas" (JEE, Languages…). Nothing is hard-coded; the app starts empty with a friendly first-run prompt.
- Notes and cards both attach to any node. The tree is shared by the Notes and Cards tabs.
- Deleting a node asks for confirmation and states how many notes/cards will be deleted.

### 5.2 Home
- Mnemo greeting (mood reflects streak; mood variants come later).
- Primary orange button: **Start session**, labelled with the number of "about to forget" cards.
- Streak flame, today's progress ring (reviews vs daily goal).
- Area cards with mastery rings; tap to open the tree.
- Weakest-topic nudge and last session summary.

### 5.3 Notes tab
- Browse by tree. Notes are formatted text only (Markdown-style headings, bullets, bold; no images).
- **Import** a `.txt` or `.md` file into a chosen node (one note per file; title from first heading or filename).
- **Edit in place**: Edit button toggles a text editor; Save writes immediately.
- Reading view: headings become collapsible sections with smooth expand/collapse and fade/slide transitions.

### 5.4 Cards tab
- Top: **Start session** button, then the list of previous sessions (P2).
- **Add cards**: choose a target node, choose a `.txt` file, preview the parsed count, confirm. Import never creates nodes.
- Single card type: front text and back text. Fill-in-the-blank is just dashes on the front.
- Re-importing the same file must not create duplicates (match on node + normalised front text).

### 5.5 Session setup
1. **Scope**: any node (includes all descendants).
2. **Amount**: number of cards, or minutes (converted using the user's average seconds per card; default 20 s).
3. **Mode**: *About to forget* (default once enough history exists), *Due*, *Random*.
4. **Include new cards**: on by default, limited by the daily new-card cap.

### 5.6 Study screen
- Card centred, running timer visible.
- Tap to flip (3D flip). Before the flip the rating control is dimmed and disabled; after the flip it lights up.
- **Wi-Fi rating control** pinned to the bottom (see DESIGN.md):
  - Outer arc: **Easy · Medium · Hard** (remembered)
  - Middle arc: **Partial · Blank**
  - Dot: **Wrong** (confidently wrong)
- Rating advances to the next card. Progress bar at the top; an exit button asks to confirm.
- End screen: summary, Mnemo celebration, accuracy, time.

### 5.7 Scheduling (behaviour)
- Every card has its own memory state (FSRS). The scheduler does not depend on which decks were studied on which day.
- Rating effects:
  | Rating | Effect |
  |---|---|
  | Easy / Medium / Hard | Remembered; longer to shorter interval |
  | Partial | Soft pass; comes back sooner than Hard |
  | Blank | Forgotten |
  | Wrong | Forgotten, card flagged as a "trap", re-queued within the same session, and given higher priority |
- **About to forget** ranks all reviewed cards in scope by lowest current recall probability; trap cards are boosted.
- Until enough history exists (under ~50 reviews), About to forget falls back to Due plus new cards.
- **Daily new cards** = the maximum number of never-seen cards introduced per day across the whole app (default 20, adjustable in Profile). It protects against a review pile-up.

### 5.8 Streak and day boundary
- Every review is stored with a timestamp. A "study day" runs from **3:30 AM to 3:30 AM** local time.
- Streak = consecutive study days with at least one review. Today counts once a review is done; a missed full day resets it. Show current and longest streak.

### 5.9 Analysis (P3)
Rating distribution (donut), study heatmap, cards per day, average seconds per card by deck, accuracy trend, weakest topics, 7-day due forecast, "confidently wrong" list, streak history.

### 5.10 Profile
Name, theme toggle (light default, dark optional), daily goal, daily new-card cap, day-start time (3:30 AM), **Export backup / Import backup**, backup-age reminder (after 7 days), app version.

### 5.11 Data safety and updates
- All data stored locally; the app requests persistent storage.
- Backup = one JSON file of everything. Import offers merge or replace, with confirmation.
- App updates ship via Vercel and apply without reinstalling or losing data; show a non-blocking "Update ready, tap to refresh" message.

## 6. Import formats
**Cards (`.txt`)**: blocks separated by a blank line:
```
Q: Which is the first member of Group 13?
A: Boron

Q: Why is BF3 a weaker Lewis acid than BCl3?
A: Back-donation from F lone pairs fills boron's empty p orbital.
```
Multi-line answers continue until the next `Q:` or blank-line break. Tab-separated lines (`front<TAB>back`) are also accepted.

**Notes (`.txt` / `.md`)**: plain text with optional `#` headings, `-` bullets and `**bold**`.

## 7. Quality bar
- Fully offline after first load.
- 60 fps animations on a mid-range Android phone.
- All tap targets at least 44 px.
- **Code must be clean, readable and modular**: see TRD.md section 3 (strict separation of styles, logic and UI).
