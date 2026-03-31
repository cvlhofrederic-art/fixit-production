-- Add source_type column for cron scan results
ALTER TABLE marches ADD COLUMN IF NOT EXISTS source_type TEXT;

CREATE INDEX IF NOT EXISTS idx_marches_source_type ON marches(source_type);

-- Allow publisher_email to be NULL (cron-scanned marchés don't have an email)
ALTER TABLE marches ALTER COLUMN publisher_email DROP NOT NULL;
