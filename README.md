# Remembery

Remembery is a mobile-first flashcard and notes app for daily study. The project is built with Vite, React, TypeScript, Dexie, and a pure core logic layer for scheduler, streak, and importer behaviour.

## Run and verify

- `npm install` installs the project dependencies.
- `npm run dev` starts the local app.
- `npm test` runs the core unit tests.
- `npm run build` type-checks the projects and builds the installable app.

Create a study area on Home before importing content. Notes accept `.txt` and `.md` files; cards accept Q:/A: blocks or tab-separated `.txt` lines. Imported content and reviews are stored in the browser's IndexedDB. Sessions support Due, Random, and About to forget selection, with the daily new-card limit configured in Profile.

## Folder rules

- `src/core` is pure TypeScript logic with no React, DOM, or database access.
- `src/data` contains Dexie schema and persistence helpers.
- `src/hooks` can bridge data + core logic for UI usage.
- `src/ui` is presentation-only and consumes hooks and typed data.
- `src/styles` contains all CSS tokens and component styling.

## Adding a screen or component

1. Add the new screen under `src/ui/screens`.
2. Add any reusable UI under `src/ui/components`.
3. Keep styling in `src/styles/components.css` or a new file under `src/styles`.
4. Import the new component from the router or parent screen.

## Local data note

The app uses IndexedDB and is intended to run from a stable production origin. Keep the deployment domain consistent to avoid losing browser-stored state.
