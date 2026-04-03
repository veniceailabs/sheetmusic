# Release Plan

## Versioning rule

The first public milestone is `v0.1.0-alpha`, corresponding to a Phase 1-complete implementation target. Phase 2 is `v0.2.x-beta`.

## Delivery phases

### Phase 1: Foundation

Ship:

- Windows shell
- PDF viewer
- Local library
- Import
- Metadata
- Setlists
- Bookmarks
- Basic annotations
- Backups
- Foot pedal turning
- Installer

Exit criteria:

- Installs on Windows 11 Surface hardware
- Opens PDF scores reliably
- Saves annotations and setlists locally
- Produces and restores a backup package without data loss

### Phase 2: Performance

Ship:

- Half-page turns
- Performance mode
- External display
- Split-screen
- Audio association
- Metronome
- Scanner pipeline
- Crop, rearrange, rotate, split, merge tools

Exit criteria:

- Manual, pedal, and half-page navigation are stable
- Scanner import produces clean PDFs
- External display and split-screen are usable in rehearsal and performance scenarios

### Phase 3: Advanced editing

Defer but design now:

- Annotation layers
- Jumps
- Excerpt creation
- Page content copy/paste
- OCR search enrichment
- Fast global search
- Media sync

### Phase 4: Collaboration

Defer but model now:

- Accounts
- Projects
- Private/shared layers
- Sync queue
- Permissions
- Version history
- Cloud restore

## Ship policy

- `implemented`: feature can ship and appear in UI
- `partial_hidden`: feature may exist behind a flag but must not appear in standard navigation
- `deferred`: documented only
- `rejected`: removed from scope and absent from UI
