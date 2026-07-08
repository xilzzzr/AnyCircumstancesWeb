-- Run this once before deploying APNs sending code.
-- It keeps existing tokens, allows multiple iOS devices per user, separates
-- sandbox vs production APNs tokens, and lets APNs rejections invalidate tokens.

ALTER TABLE user_device_tokens
  DROP PRIMARY KEY,
  MODIFY user_id bigint unsigned NOT NULL,
  ADD COLUMN id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST,
  ADD COLUMN platform enum('ios') NOT NULL DEFAULT 'ios',
  ADD COLUMN apns_env enum('development','production') NOT NULL DEFAULT 'development',
  ADD COLUMN updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN invalidated_at timestamp NULL DEFAULT NULL,
  ADD UNIQUE KEY uniq_device_token (token),
  ADD KEY idx_user_apns_env_valid (user_id, apns_env, invalidated_at);
