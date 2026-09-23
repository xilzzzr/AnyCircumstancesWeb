-- Pre-launch security hardening.
-- Apply before deploying the matching application revision.

ALTER TABLE users
  ADD COLUMN auth_version INT NOT NULL DEFAULT 1,
  ADD COLUMN duress_locked_until DATETIME(3) NULL;

ALTER TABLE file_key_escrows
  ADD COLUMN key_ref VARCHAR(512) NULL;

CREATE TABLE IF NOT EXISTS emergency_delivery_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  due_at DATETIME(3) NOT NULL,
  contact_id BIGINT NOT NULL,
  recipient_email VARCHAR(254) NOT NULL,
  recipient_name VARCHAR(255) NULL,
  file_ids_json JSON NOT NULL,
  delivery_kind VARCHAR(24) NOT NULL DEFAULT 'scheduled',
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  last_error VARCHAR(255) NULL,
  delivered_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_emergency_delivery (user_id, due_at, contact_id),
  KEY idx_emergency_delivery_retry (status, updated_at),
  KEY idx_emergency_delivery_user_due (user_id, due_at)
);

CREATE TABLE IF NOT EXISTS account_lifecycle_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  action VARCHAR(32) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  last_error VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_account_lifecycle_pending (status, updated_at),
  KEY idx_account_lifecycle_user (user_id, created_at)
);
