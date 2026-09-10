CREATE TABLE IF NOT EXISTS user_vault_keys (
  user_id BIGINT UNSIGNED NOT NULL,
  key_id CHAR(64) NOT NULL,
  bundle_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, key_id)
);
