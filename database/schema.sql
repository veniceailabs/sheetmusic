PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  composer TEXT,
  arranger TEXT,
  source_type TEXT NOT NULL,
  source_path TEXT NOT NULL,
  asset_hash TEXT,
  page_count INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  difficulty TEXT,
  key_signature TEXT,
  instrumentation TEXT,
  notes TEXT,
  extracted_text TEXT,
  import_status TEXT NOT NULL DEFAULT 'ready',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS score_versions (
  id TEXT PRIMARY KEY,
  score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  source_path TEXT NOT NULL,
  asset_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'tag'
);

CREATE TABLE IF NOT EXISTS score_tags (
  score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (score_id, tag_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'manual',
  query_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_scores (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, score_id)
);

CREATE TABLE IF NOT EXISTS setlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setlist_items (
  id TEXT PRIMARY KEY,
  setlist_id TEXT NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  score_id TEXT REFERENCES scores(id) ON DELETE SET NULL,
  bookmark_id TEXT REFERENCES bookmarks(id) ON DELETE SET NULL,
  position INTEGER NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'page',
  start_page INTEGER NOT NULL,
  end_page INTEGER,
  jump_target_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS annotation_layers (
  id TEXT PRIMARY KEY,
  score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'visible',
  lock_state TEXT NOT NULL DEFAULT 'unlocked',
  privacy_scope TEXT NOT NULL DEFAULT 'private',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL REFERENCES annotation_layers(id) ON DELETE CASCADE,
  score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  annotation_type TEXT NOT NULL,
  geometry_json TEXT NOT NULL,
  style_json TEXT,
  content_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  score_id TEXT REFERENCES scores(id) ON DELETE CASCADE,
  bookmark_id TEXT REFERENCES bookmarks(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  asset_path TEXT NOT NULL,
  title TEXT,
  duration_seconds INTEGER,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS page_view_preferences (
  id TEXT PRIMARY KEY,
  score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  page_number INTEGER,
  display_mode TEXT,
  half_page_enabled INTEGER NOT NULL DEFAULT 0,
  half_page_split REAL,
  zoom_level REAL,
  crop_rect_json TEXT,
  rotation_degrees INTEGER DEFAULT 0,
  visual_theme TEXT,
  performance_mode INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  role_model_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  invited_at TEXT,
  joined_at TEXT
);

CREATE TABLE IF NOT EXISTS backup_archives (
  id TEXT PRIMARY KEY,
  archive_path TEXT NOT NULL,
  format_version TEXT NOT NULL,
  encryption_mode TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_events (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  actor_id TEXT,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  revision INTEGER NOT NULL,
  event_payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  synced_at TEXT,
  conflict_state TEXT NOT NULL DEFAULT 'none'
);

CREATE INDEX IF NOT EXISTS idx_scores_title ON scores(title);
CREATE INDEX IF NOT EXISTS idx_scores_composer ON scores(composer);
CREATE INDEX IF NOT EXISTS idx_bookmarks_score ON bookmarks(score_id);
CREATE INDEX IF NOT EXISTS idx_annotations_score_page ON annotations(score_id, page_number);
CREATE INDEX IF NOT EXISTS idx_media_assets_score ON media_assets(score_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_object ON sync_events(object_type, object_id, revision);
