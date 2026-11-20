# Memdory: Design (v1)

## 1. Vibe
Fun, alive, polished; never childish. Calm light surfaces, confident indigo, one warm orange for actions, and a wave motif tying together ocean, Wi-Fi and signal. Motion is springy and purposeful.

## 2. Mascot: Mnemo
- An original clownfish: round orange body, two white stripes with dark outlines, small "lucky" fin, big friendly eye, bubbles.
- **Side view** is the default (home, empty states, loading). **Front view** is a tall oval: thin orange rim, thick white head stripe, orange face with two eyes and a smile.
- Colours: orange `#FF8A1F`, light fin `#FFB066`, outline `#2A2140`, bubbles `#5AA9E6`, blush `#FF6F8E`.
- Final SVG files are supplied separately and live in `src/assets/mascot/` (side, front, and later mood variants: happy, sleepy, worried, cheering). Use placeholders until then; never hard-draw the mascot in code.
- Usage: Home greeting, empty states, session-complete celebration, loading. Keep it away from dense study screens. The front view should be used for flashcard session only. Use the different side views for different screens and actions (sleepy if streak is lost for 1-3 days, rotting if streak lost for more than that) you can use different SVGs creatively for animations and use the different layers in svg to make mnemo animate and move like a fish

## 3. Colour tokens (light is default)
```css
:root {
  --bg: #F6F7FD;          --surface: #FFFFFF;
  --ink: #141A4D;         --ink-soft: #5B6194;
  --navy: #1E2A78;        --indigo: #4547D6;   --indigo-tint: #E6E8FF;
  --orange: #FF8A1F;      --orange-pressed: #E86F00;  --orange-tint: #FFEBD6;
  --wave: #5CC8E0;        /* decoration only */
  --easy: #1FB58F;  --medium: #4A7BF7;  --hard: #F2B134;
  --partial: #9B7BEF; --blank: #8A93B8; --wrong: #EF5B6B;
}
/* dark theme (toggle in Profile) */
[data-theme="dark"] {
  --bg: #0B0F33;  --surface: #141A4A;  --ink: #EDEFFF;
  --indigo: #8C94FF;
}
```
**Rules:** orange is reserved for calls to action (Start session, Save, Import) and the streak. Never use orange for the rating buttons or decorative fills. Indigo and navy carry structure; cyan appears only inside wave decoration.

## 4. Typography and shape
- Text: **Nunito** (rounded, friendly). Formulas and code: **JetBrains Mono**.
- Scale: 12 / 14 / 16 / 20 / 28 px; weights 400, 600, 800 for headings.
- Radii: 12 (inputs), 20 (cards), 28 (sheets), full (pills).
- Shadows: soft and low, tinted with indigo (`rgba(69,71,214,0.12)`).
- Spacing unit 4 px; screen padding 16 px; minimum tap target 44 px.
- Bundle the fonts inside the app, since Google Fonts won’t load offline.

## 5. Wave motif (use sparingly)
- Header: a wave divider under the Home header.
- Progress: animated wave fill inside the daily-progress and mastery rings.
- Loading: a gently moving wave.
- Wi-Fi rating arcs (see section 7).
- Subtle slow-drifting waves in the Home background at very low opacity.
Everything else stays clean.

## 6. Screens
**Home:** top bar with Mnemo and greeting, streak flame (orange), progress ring. Big orange **Start session** button. Below: one card per area with mastery ring, then weakest-topic nudge and last session. Tree editing is reachable here (edit mode: add, rename, move, delete nodes).

**Notes:** tree browser on top, note list below. Note view: title, collapsible heading sections with animated expand/collapse, comfortable line height. Floating Edit button (switches to an editor with Save/Cancel). Import button in the header.

**Cards:** orange **Start session** button at the top, previous sessions list below, **Add cards** button (pick node, pick file, preview count, confirm).

**Session setup (bottom sheet):** scope tree picker, amount (cards or minutes slider), mode chips (About to forget / Due / Random), "include new cards" switch, orange Start button, front facing mnemo(draggable, changes expression based on response).

**Analysis:** card-based charts: rating donut, heatmap, cards per day, time per deck, accuracy trend, weakest topics, 7-day forecast, streak history.

**Profile:** theme toggle, daily goal, new-card cap, day start (3:30 AM), Export/Import backup, version.

**Bottom tab bar:** Home · Notes · Cards · Analysis · Profile. Active tab: indigo icon with a small wave underline.

## 7. Study screen
- Top: progress bar (wave-filled) and close button. Running timer near the card.
- Centre: large rounded card, front text. Tap to flip with a 3D rotate (about 600 ms, spring easing). Back text is slightly smaller; scrolls if long.
- **Wi-Fi rating control** pinned to the bottom, always visible:
  - Three concentric arcs plus a dot, centred horizontally like the Wi-Fi symbol.
  - **Outer arc:** Easy (left), Medium (centre), Hard (right). **Middle arc:** Partial (left), Blank (right). **Dot:** Wrong.
  - Colours from the rating tokens. Each button shows its label; every button has at least a 44 px hit area (enlarge the whole control as needed).
  - State: before the flip, arcs are dimmed and not tappable; on flip they light up in a quick staggered wave from the dot outward.
  - On tap: button scales and glows, light haptic (stronger for Wrong), card slides away, next card springs in.
- **Wrong:** brief coral flash and a small shake; card returns later in the session.
- **Session end:** Mnemo celebrates; show cards done, accuracy, time, streak update, orange "Done" button.

## 8. Motion principles
- Springs for entrances and presses (stiffness around 300, damping around 24).
- Durations: micro 150 ms, standard 250 ms, flip 600 ms.
- Animate only `transform` and `opacity`; keep waves slow (8 to 20 s loops).
- Respect `prefers-reduced-motion`: replace flips and waves with simple fades.
- Haptics via `navigator.vibrate` where available (10 ms normal, 30 ms for Wrong).

## 9. Notes reading style
Max line length about 65 characters, 1.6 line height, indigo headings, subtle left border on bullet groups, monospace for formulas, collapsible sections open by default for the first level.

## 10. Implementation note
All styling lives in `src/styles/` (tokens, themes, global, animations, per-component CSS). Components reference class names and tokens only; they contain no styling logic. See TRD.md section 3.

## 11. Icon
Use png icons inside public/icons. Extract only the ones required from the folders and rename them to put directly in public/icons the manifest.json can load it correctly
