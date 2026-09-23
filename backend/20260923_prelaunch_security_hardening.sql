-- Pre-launch security hardening.
-- Apply this migration before deploying the matching application code.

ALTER TABLE users
  ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN duress_locked_until DATETIME(3) NULL;

ALTER TABLE verification_reminder_emails
  ADD COLUMN sent_at DATETIME(3) NULL,
  ADD COLUMN attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN last_error VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS verification_emergency_contact_dispatches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  contact_id BIGINT UNSIGNED NOT NULL,
  due_at DATETIME(3) NOT NULL,
  file_ids_json JSON NOT NULL,
  status ENUM('pending','delivered','failed') NOT NULL DEFAULT 'pending',
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(255) NULL,
  delivered_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_emergency_contact_dispatch (user_id, contact_id, due_at),
  KEY idx_emergency_contact_dispatch_pending (status, updated_at),
  KEY idx_emergency_contact_dispatch_user_due (user_id, due_at)
);
