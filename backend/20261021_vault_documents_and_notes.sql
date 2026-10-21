-- Run once before deploying the updated backend. Existing links remain single-file links.
ALTER TABLE contact_file_share_tokens
  ADD COLUMN delivery_group_id CHAR(36) NULL,
  ADD INDEX idx_share_delivery_group (contact_id, delivery_group_id);
