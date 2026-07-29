# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RosettaTone** — a browser-based music theory companion that translates between guitar tabs, sheet music, fretboard, and piano views. Localhost-first MVP.

## Tech Stack

- **Frontend:** React (Vite) + Tailwind CSS + Zustand + Axios + VexFlow 5.x + @tonejs/midi + fflate
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

Notes are colored **by fretting finger** (1=index red, 2=middle blue, 3=ring green, 4=pinky yellow, T=thumb purple, 0=open neutral) consistently across ALL views (fretboard dots, piano keys, VexFlow noteheads, tab numerals). Source of truth: `frontend/src/utils/noteColors.js` (`getFingerColor()`). Scale views instead use ROYGBIV octave-run colors from `frontend/src/utils/scaleColors.js`. Never hard-code note colors in components.

### Design System ("Studio Instrument")

Warm charcoal chassis with a single gold accent; the note colors are the loudest thing on screen. Defined in `frontend/tailwind.config.js`: `ink-*` (backgrounds/borders), `chrome-*` (text), `gold-*` (accent). Fonts (Google Fonts, loaded in `index.html`): **Instrument Serif** italic for the wordmark/chords, **Instrument Sans** for UI, **JetBrains Mono** for tab numerals and transport digits. Shared CSS primitives (`.panel-label`, `.anim-fade-up`, `.note-transition`, `pop-in` keyframes) live in `src/index.css`.

### Core Data Flow — the canonical Score model

Every input format is parsed **once at ingest** into a canonical Score (`frontend/src/utils/score.js`), which is stored in `songs.parsed_json` and is the only thing views consume:

```
ASCII tab ──tabToScore()────────┐   tab knows string/fret → infers durations
MusicXML ──musicXmlToScore()────┤   sheet knows durations → infers string/fret
MIDI ──────midiToScore()────────┘   (utils/importers/*, utils/fretInference.js)
              ↓
Score { meta: {bpm, timeSignature, keyRoot…}, events: [{start, duration, midi,
        note, octave, string, fret, lyric, chordSymbol}] }   (start/duration in quarter beats)
              ↓ POSTed as parsed_json at ingest; loadSong() prefers it, falls
              ↓ back to re-parsing raw_content for legacy rows
scoreToBeats() → beats [{beatIndex, start, duration, notes[]}] in Zustand store
              ↓
Fretboard / Piano / NotationView / TabView / TransportBar (all subscribe)
```

- **Fret inference** (`utils/fretInference.js`): beam search assigning string/fret to pitch-only sources; events outside guitar range keep `string/fret = null` and render only on the piano (views must guard for null).
- **Tab timing inference** (`utils/tabParser.js`): bar lines make each measure one bar of the time signature, event starts proportional to column position (sixteenth-quantized); barline-free staves fall back to uniform eighths.
- Playback (`App.jsx`) schedules every beat against an absolute clock anchor (`performance.now`), so timer overhead never accumulates — 140 BPM plays at 140. Respects the active section range and the `loop` toggle.
- **Key shift** (`transpose` in store, − K + stepper in transport): capo-style — frets slide with the shift, notes falling off the neck re-map to the nearest position (`utils/transpose.js`). Beats re-derive from the untouched canonical score.
- **Sections**: tab sources with `[Intro]`/`[Verse]`-style label lines get `score.meta.sections` `[{name, startBeat}]`; the store maps them to beat ranges, SongView shows pills to isolate one, the transport scrubber shows boundary ticks, and playback bounds/loops to the active section.

### String Numbering

Throughout the codebase: **string 1 = high E, string 6 = low E**. `STANDARD_TUNING` in `frontend/src/utils/musicTheory.js` is indexed accordingly. `fretToNote(stringNumber, fret)` is the canonical fret-to-pitch utility — use it everywhere instead of recomputing.

### Layout

```
┌─ Header (wordmark · song/scale · sound voice toggle) ─┐
│┌─Library─┬─ Piano (88-key, always visible) ──────────┐│
││ Music   ├────────────────────────────────────────────┤│
││ Scales  │  Context area: SongView (staff+tab+playhead)│
││ Chords  │  or ScaleView or ChordView or EmptyState   ││
││         ├────────────────────────────────────────────┤│
││         │  Fretboard (24-fret, always visible)       ││
│└─────────┴────────────────────────────────────────────┘│
├─ TransportBar (play · loop · beats · scrubber · BPM · key) ┤
└────────────────────────────────────────────────────────┘
```

Keyboard: **Space** play/pause (song or scale, context-aware), **←/→** step beat, **Home** rewind. Shortcuts are ignored while typing in inputs.

Panels are resizable (piano height, guitar height, library width) via `useResizable.jsx` drag handles; sizes persist in localStorage. Both instrument SVGs scale to fill their panel (`viewBox` + meet). Panel labels sit top-right; the finger legend sits top-left of the guitar panel in song mode. The bottom transport drives **both** song playback and scale playback (in scale view the play button, counter, and progress reflect the pattern sequence).

**Cross-highlight**: hovering any note on the fretboard or piano sets `hoverMidi` in the store; the other instrument shows dashed gold rings on every matching position.

### API

All routes mounted under `/api`. See `backend/src/routes/`:
- `songs.js` — GET /, POST /, GET /:id, DELETE /:id
- `scales.js` — GET /, GET /:name/:root (computes scale notes from intervals)
- `chords.js` — GET /, GET /:name (returns parsed `fingering` JSON)

### Database

- File: `backend/data/gearboard.db` (gitignored, auto-created on startup)
- Schema in `backend/src/schema.sql` — three tables: `songs`, `scales`, `chords`
- `songs.source_type` ∈ `tab | musicxml | midi | url`; `db.js` contains a one-time table rebuild migration for DB files created before `'midi'` was in the CHECK constraint
- `songs.raw_content` stores the original input (tab text, MusicXML text, or base64 for .mid/.mxl); `songs.parsed_json` stores the canonical Score
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
- Four view modes: **Full** (all notes), **Vertical** (CAGED box positions), **Diagonal** (3-notes-per-string patterns), **Pitch Map** (`PitchMap.jsx`: each string drawn as a row in true pitch space over a mini piano strip, so every fret dot — labeled with its fret number — sits directly above the key it sounds; same pitch stacks into vertical columns. Octave colors, filters, playback halo, and a vertical hover/playhead guide line all apply)
- **CAGED position filter**: numbered buttons to isolate individual box patterns (vertical/diagonal modes)
- **Octave run filter**: ROYGBIV-colored buttons to filter by octave pass
- Boundary notes (where two octave runs meet) render with a 45° diagonal split on both fretboard and piano
- Scale data computed in `frontend/src/utils/scalePositions.js` (CAGED + diagonal), colors in `frontend/src/utils/scaleColors.js`
- **Scale playback**: Play/loop from the Scales sidebar *or the bottom transport* (Space also works). Plays *whatever is currently visible* — the selected CAGED box, the diagonal run, or the full/octave-filtered scale — as eighth notes at the transport BPM, ascending then descending. Sequence built in `frontend/src/utils/scaleSequence.js`; a traveling gold halo highlights the active note on both fretboard and piano (`scalePlayhead` in the store). Changing filters mid-playback restarts on the new pattern; filters are sticky across view-mode switches.
- **Octave-run semantics** (`scaleColors.js`): a boundary root STARTS run N and ENDS run N−1 (`runIndex`/`prevRunIndex`). Octave filter buttons are labeled with real octaves (C2, C3…), and ScaleStaff renders the selected run's true pitches on a treble-8vb staff (guitar notation convention, also used by ChordStaff).
- **Chords in Key** groups alternate voicings under one chord-name header with neck-position labels (Open / 5fr / …) — same pitch classes, different physical spellings.

## Piano

Full 88-key piano (A0–C8), inline sticky by default. Labels shown only on C keys for compactness.

## Audio

`utils/audio.js` plays real FluidR3 soundfont samples (acoustic grand piano / steel guitar) fetched lazily from jsDelivr and cached as decoded buffers; the oscillator synth remains as an instant fallback while a note's sample loads or when offline (one failed fetch disables further attempts for the session). `prefetchNotes()` warms the cache for everything on screen (wired via an App effect on beats/scale/instrument).

## Song Ingestion

The Add Song modal (`frontend/src/components/AddSongModal.jsx`) has two modes:
- **Paste Tab** — ASCII tab textarea (bar lines give the parser real timing)
- **MusicXML / MIDI File** — drag-drop or browse for `.musicxml/.xml/.mxl/.mid/.midi`; shows a parse preview (notes/beats/bars/BPM/key/fretboard coverage) before saving

Both build the canonical Score client-side and POST it as `parsed_json`. The Claude-Code-as-scraper flow (`prompts/process-tab-url.md`) still POSTs raw tab only; `loadSong()` falls back to client-side parsing for those rows.

## What's Deferred (Not Yet Built)

- Chord Encyclopedia panel (chords list exists but no fingering diagrams/fretboard previews)
- Bass clef / grand staff on the notation view (treble only currently)
- Tab technique semantics (h/p/b/s are tolerated by the parser but not rendered or sounded)
- A/B loop region for songs (scales have loop; songs don't yet)
- Web MIDI input, metronome/count-in
- Lyrics/chord-symbol display in SongView (the Score model already carries `lyric`/`chordSymbol` from MusicXML)
- GCP / Cloud SQL deployment
- Settings panel for display preferences
