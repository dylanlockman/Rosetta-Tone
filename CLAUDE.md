# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RosettaTone** — a browser-based music theory companion that translates between guitar tabs, sheet music, fretboard, and piano views. Localhost-first MVP.

## Tech Stack

- **Frontend:** React (Vite) + Tailwind CSS + Zustand + Axios + VexFlow 4.x
- **Backend:** Node.js + Express + sql.js (pure-JS SQLite, no native compilation needed)
- **Package manager:** npm

> **Why sql.js, not better-sqlite3?** This machine cannot compile native node addons (Xcode CLT issue). sql.js runs the SQLite engine entirely in JS and persists by writing the database file directly. The trade-off: every write triggers a full-file flush via `save()` in `backend/src/db.js`.

## Development Commands

```bash
# Backend (port 4000) — start first
cd backend && npm install   # one-time
cd backend && npm run dev   # nodemon

# Frontend (port 3000, falls back if taken)
cd frontend && npm install  # one-time
cd frontend && npm run dev
```

The Vite dev server proxies `/api` → `http://localhost:4000`, so the frontend never hits CORS during local development.

## Architecture

### Color System (Critical Design Constraint)

Every pitch class maps to a fixed color used consistently across ALL views (fretboard dots, piano keys, VexFlow noteheads). The single source of truth is `frontend/src/utils/noteColors.js`. Any component rendering notes must consume `getNoteColor()` from there — never hard-code note colors.

### Core Data Flow

```
ASCII Tab (raw_content in DB)
    ↓ parseTab()  [client-side, frontend/src/utils/tabParser.js]
[{note, octave, string, fret, duration, beatIndex}]
    ↓
Zustand store (noteEvents)
    ↓
Fretboard / Piano / NotationView (all subscribe)
```

The tab parser runs **client-side only** in the MVP. The `songs.parsed_json` column exists in the schema but is not yet populated; server-side parsing/caching can be added later without changing the API contract.

Notes that share the same `beatIndex` are simultaneous (a chord). Components group on this field — the notation view renders them as multi-key VexFlow `StaveNote`s, the fretboard/piano just light all positions.

### String Numbering

Throughout the codebase: **string 1 = high E, string 6 = low E**. `STANDARD_TUNING` in `frontend/src/utils/musicTheory.js` is indexed accordingly. `fretToNote(stringNumber, fret)` is the canonical fret-to-pitch utility — use it everywhere instead of recomputing.

### Layout

```
┌─ Header (Guitar/Piano toggle) ──────────┐
│┌─Library─┬─ NotationView (VexFlow) ─────┐│
││         ├──────────────────────────────┤│
││         │  InstrumentView              ││
││         │  (Fretboard or Piano)        ││
│└─────────┴──────────────────────────────┘│
└──────────────────────────────────────────┘
```

### API

All routes mounted under `/api`. See `backend/src/routes/`:
- `songs.js` — GET /, POST /, GET /:id, DELETE /:id
- `scales.js` — GET /, GET /:name/:root (computes scale notes from intervals)
- `chords.js` — GET /, GET /:name (returns parsed `fingering` JSON)

### Database

- File: `backend/data/gearboard.db` (gitignored, auto-created on startup)
- Schema in `backend/src/schema.sql` — three tables: `songs`, `scales`, `chords`
- Seed data in `backend/src/seed.js` runs every startup with `INSERT OR IGNORE`: 8 scales + 20 common chords
- The `db.js` module exports helpers `all()`, `get()`, `run()` that wrap the sql.js API and handle persistence on every write

## Tab URL Ingestion (Claude Code as Scraper)

Instead of a Cheerio scraper, the project uses Claude Code itself to process tab URLs. The instructions live in `prompts/process-tab-url.md`. Workflow:

1. User asks Claude Code: "process this tab URL: <url>"
2. Claude Code reads `prompts/process-tab-url.md` and follows the steps
3. Uses WebFetch to extract title, artist, raw ASCII tab
4. POSTs to `http://localhost:4000/api/songs`
5. User refreshes the library panel to see the new song

This is a deliberate design choice — it offloads the messy scraping logic to an LLM that can adapt to varying page structures, and keeps the codebase free of fragile selectors.

## Guitar Tuning

Standard EADGBE assumed everywhere. Open string pitches: `E2, A2, D3, G3, B3, E4`. Alternate tunings are not supported in the MVP.

## Scale Explorer

The Scale Explorer is available in the Library panel's Scales tab. Features:
- Root note selector (12 chromatic buttons) + scale type list
- Three view modes: **Full** (all notes), **Vertical** (CAGED box positions), **Diagonal** (3-notes-per-string patterns)
- **CAGED position filter**: numbered buttons to isolate individual box patterns (vertical/diagonal modes)
- **Octave run filter**: ROYGBIV-colored buttons to filter by octave pass
- Boundary notes (where two octave runs meet) render with a 45° diagonal split on both fretboard and piano
- Scale data computed in `frontend/src/utils/scalePositions.js` (CAGED + diagonal), colors in `frontend/src/utils/scaleColors.js`

## Piano

Full 88-key piano (A0–C8), inline sticky by default. Labels shown only on C keys for compactness.

## What's Deferred (Not Yet Built)

- Chord Encyclopedia panel (chords list exists but no fingering diagrams/fretboard previews)
- Bass clef on the notation view (treble only currently)
- Duration inference in the tab parser (everything is quarter notes, subdivision selector compensates)
- MusicXML import
- GCP / Cloud SQL deployment
- Settings panel for display preferences
