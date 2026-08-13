CREATE TABLE IF NOT EXISTS billing_entitlements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  provider ENUM('stripe', 'apple') NOT NULL,
  external_subscription_id VARCHAR(191) NOT NULL,
  product_id VARCHAR(191) NULL,
  storage_limit_gb INT NULL,
  checkin_frequency VARCHAR(16) NULL,
  billing_interval VARCHAR(16) NULL,
  status VARCHAR(32) NOT NULL,
  environment VARCHAR(32) NULL,
  current_period_end DATETIME(3) NULL,
  raw_metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_entitlement_provider_subscription (provider, external_subscription_id),
  KEY idx_entitlement_user_status (user_id, status, current_period_end),
  KEY idx_entitlement_provider (provider)
);

CREATE TABLE IF NOT EXISTS apple_account_links (
  user_id BIGINT UNSIGNED NOT NULL,
  app_account_token CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_apple_account_token (app_account_token)
);

CREATE TABLE IF NOT EXISTS apple_notification_events (
  notification_uuid CHAR(36) NOT NULL,
  notification_type VARCHAR(64) NULL,
  environment VARCHAR(32) NULL,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (notification_uuid)
);

INSERT INTO billing_entitlements
  (user_id, provider, external_subscription_id, status, current_period_end,
   storage_limit_gb, checkin_frequency, billing_interval, raw_metadata_json)
SELECT
  user_id, 'stripe', stripe_subscription_id, status, current_period_end,
  storage_limit_gb, checkin_frequency, billing_interval,
  JSON_OBJECT('migratedFrom', 'billing_profiles')
FROM billing_profiles
WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id <> ''
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  current_period_end = VALUES(current_period_end);
