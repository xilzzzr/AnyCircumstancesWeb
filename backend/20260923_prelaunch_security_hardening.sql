-- Pre-launch security hardening.
-- Apply this migration before deploying the matching application code.

ALTER TABLE users
  ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN duress_locked_until DATETIME(3) NULL;

ALTER TABLE file_key_escrows
  ADD COLUMN escrow_key_id VARCHAR(255) NULL;

ALTER TABLE verification_reminder_emails
  ADD COLUMN sent_at DATETIME(3) NULL,
  ADD COLUMN sending_at DATETIME(3) NULL,
  ADD COLUMN attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN last_error VARCHAR(255) NULL;

-- Existing rows were created by the old dispatcher only when it attempted delivery.
-- Mark them complete so deploying this migration cannot resend historical reminders.
UPDATE verification_reminder_emails
SET sent_at = UTC_TIMESTAMP(3)
WHERE sent_at IS NULL;

CREATE TABLE IF NOT EXISTS emergency_trigger_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(32) NOT NULL,
  request_ip VARCHAR(64) NULL,
  request_user_agent VARCHAR(255) NULL,
  status ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_emergency_trigger_pending (status, updated_at),
  KEY idx_emergency_trigger_user (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS verification_emergency_contact_dispatches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  contact_id BIGINT UNSIGNED NOT NULL,
  due_at DATETIME(3) NOT NULL,
  reason VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  file_ids_json JSON NOT NULL,
  status ENUM('pending','processing','delivered','failed') NOT NULL DEFAULT 'pending',
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

CREATE TABLE IF NOT EXISTS account_lifecycle_jobs (
  user_id BIGINT UNSIGNED NOT NULL,
  action ENUM('cancel_files','delete_account') NOT NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  status ENUM('pending','processing','failed') NOT NULL DEFAULT 'pending',
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  KEY idx_account_lifecycle_jobs_status (status, updated_at)
);
