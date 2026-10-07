BEGIN;
-- Existing tasks retain their original provider and billing semantics.
ALTER TABLE course_generations ADD COLUMN IF NOT EXISTS model_provider text NOT NULL DEFAULT 'aliyun';
ALTER TABLE course_generations ADD COLUMN IF NOT EXISTS model_name text NOT NULL DEFAULT 'qwen3.8-flash';
ALTER TABLE course_generations ADD COLUMN IF NOT EXISTS pricing_receipt jsonb;
ALTER TABLE course_generations DROP CONSTRAINT IF EXISTS course_generations_billing_status_check;
ALTER TABLE course_generations ADD CONSTRAINT course_generations_billing_status_check CHECK(billing_status IN('reserved','estimated','unknown','simulation','free'));
COMMIT;
