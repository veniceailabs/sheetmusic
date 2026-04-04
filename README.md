# Sheet Music

Sheet Music is a Windows-first digital sheet music platform designed around the April 3, 2026 white paper in `/Users/DRA/Downloads/windows_sheet_music_white_paper.pdf`.

This repository currently establishes the delivery foundation for Phase 1 and Phase 2:

- Product scope and architecture documents tied to the white paper
- A normalized feature inventory with explicit ship phases and acceptance criteria
- A local-first SQLite schema for library, annotations, setlists, bookmarks, media, backups, and sync events
- Backup/archive and sync-event schemas
- A validation script that enforces the white paper's anti-placeholder rule at the planning layer

## Current scope

The local environment does not have `.NET` installed, so this repo does not yet contain a WinUI 3 application shell. It does contain the implementation contracts needed to start that build cleanly:

- [docs/component-spec.md](/Users/DRA/apps/Sheet%20Music/docs/component-spec.md)
- [docs/release-plan.md](/Users/DRA/apps/Sheet%20Music/docs/release-plan.md)
- [config/feature-matrix.json](/Users/DRA/apps/Sheet%20Music/config/feature-matrix.json)
- [database/schema.sql](/Users/DRA/apps/Sheet%20Music/database/schema.sql)
- [schemas/backup-archive.schema.json](/Users/DRA/apps/Sheet%20Music/schemas/backup-archive.schema.json)
- [schemas/change-event.schema.json](/Users/DRA/apps/Sheet%20Music/schemas/change-event.schema.json)

## Validation

Run:

```bash
node scripts/validate-spec.mjs
sqlite3 :memory: ".read database/schema.sql"
```

## Recommended next implementation step

Install the Windows toolchain and create a WinUI 3 / .NET 8 solution that consumes this repository's contracts:

1. App shell and navigation
2. PDF viewer integration
3. Annotation engine and asset store
4. Import pipeline
5. Backup package writer/reader
