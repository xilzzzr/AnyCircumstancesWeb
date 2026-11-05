-- Run once before deploying this release. Existing schedules and grace periods
-- stay unchanged; calendar scheduling is opt-in for the daily paid tier.
ALTER TABLE verification_settings ADD COLUMN schedule_json JSON NULL;
ALTER TABLE users ADD COLUMN display_name VARCHAR(120) NULL;
