# Component Specification

## Delivery target

The first shippable build is constrained to Phase 1 and Phase 2 from the white paper:

- Windows shell
- Local library and metadata
- PDF-first viewer
- Setlists and bookmarks
- Basic annotations
- Backups
- Pedal turning
- Performance features such as half-page turns, split-screen, scanner ingest, crop/rearrange tools, audio association, and metronome

## Components

### 1. Windows shell

Target implementation:

- WinUI 3 application shell on .NET 8
- Windows App SDK packaging for MSIX
- Touch, pen, keyboard, Bluetooth, file picker, and external-display integration

Acceptance criteria:

- Cold start launches into the last active library context
- Navigation contains only implemented Phase 1-2 surfaces
- The shell can open scores, setlists, and settings without placeholder routes

### 2. Library engine

Responsibilities:

- Persist score records, collections, tags, composers, instruments, versions, favorites, recents, and extracted text references
- Manage ingest jobs for local files, folders, scanners, network paths, and cloud-import descriptors
- Expose fast search indices and setlist ordering

Storage:

- SQLite metadata store
- Asset root for source documents, thumbnails, media, and derived artifacts

Acceptance criteria:

- 500-score library remains responsive for search and open workflows
- Metadata survives application restart
- Replacing a source PDF does not destroy annotations or setlist membership

### 3. Viewer engine

Responsibilities:

- PDF rendering, thumbnails, page rasterization, text extraction, zoom, pan, crop, margin trim, rotation, display effects
- Viewing modes: single page, continuous scroll, two-page landscape, split-screen, external display
- Half-page turns with per-page settings
- Performance mode to reduce accidental touches

Acceptance criteria:

- Near-instant page turn under the team's approved threshold
- Half-page turns support tap and pedal workflows without ghost navigation
- External display can mirror or show the active score page reliably

### 4. Annotation engine

Responsibilities:

- Freehand ink, highlighter, eraser, lasso, text boxes, shapes, stamps, measure rectangles
- Stylus-aware palm rejection
- Layer storage and visibility controls
- Bookmark anchors and jump targets

Data model rules:

- Annotation data is stored outside the source document
- Layer ownership supports local-only, shared, and exported states
- Annotation history is event-addressable for future collaboration

Acceptance criteria:

- Pen latency feels natural on supported hardware
- Annotation save and reload preserves geometry and page anchoring
- Hidden or locked layers are enforced at render time

### 5. Media and rehearsal engine

Responsibilities:

- Score-linked audio, MIDI, video reference pointers
- Tempo and rehearsal markers
- Metronome and count-in utilities
- Bookmark-level media associations

Acceptance criteria:

- Media associations persist across backup and restore
- Metronome settings can be saved per score or bookmark

### 6. Sync and collaboration engine

Responsibilities:

- Local-first event queue
- Immutable change records
- Conflict detection and merge preview
- Shared project membership and permissions

Implementation note:

This component is designed now but ships later. Its contracts are represented in the database and JSON schema so collaboration is not retrofitted.

### 7. Backup and recovery engine

Responsibilities:

- Create encrypted single-file archives
- Support selective restore and full restore
- Preserve documents, metadata, annotation layers, setlists, settings, media mappings, and project references

Acceptance criteria:

- A clean restore rebuilds a working library on a new machine
- Backup manifests are versioned and schema-valid

## Non-negotiable engineering rule

No surface appears in navigation unless:

- It is marked `implemented`
- It has a real backing data path
- It has an acceptance criterion in the feature matrix
