-- Run once before deploying the updated backend. Existing links remain single-file links.
ALTER TABLE contact_file_share_tokens
  ADD COLUMN delivery_group_id CHAR(36) NULL,
  ADD INDEX idx_share_delivery_group (contact_id, delivery_group_id);

-- File edits use a new immutable encrypted S3 key; the pointer changes atomically
-- with the file metadata. Track every staged key so account deletion cleans it.
ALTER TABLE files ADD COLUMN storage_key VARCHAR(512) NULL;
CREATE TABLE IF NOT EXISTS file_storage_objects (
  object_key VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  file_id VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_file_storage_objects_file_id (file_id)
) ENGINE=InnoDB;
