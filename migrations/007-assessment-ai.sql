BEGIN;
ALTER TABLE assessment_packs ADD COLUMN IF NOT EXISTS approval_mode text NOT NULL DEFAULT 'human' CHECK(approval_mode IN('human','ai'));
CREATE TABLE IF NOT EXISTS assessment_ai_checks (
  id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES assessment_packs(id) ON DELETE CASCADE,
  course_version text NOT NULL, budget_day text NOT NULL, model_name text NOT NULL,
  status text NOT NULL CHECK(status IN('queued','running','completed','failed')),
  proposed_spec jsonb, checked_spec jsonb, report jsonb, sources jsonb,
  calls jsonb NOT NULL DEFAULT '[]', accounted_fen integer NOT NULL DEFAULT 20 CHECK(accounted_fen>=0),
  error text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS assessment_ai_one_active ON assessment_ai_checks(pack_id) WHERE status IN('queued','running');
ALTER TABLE assessment_ai_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_ai_checks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_ai_checks ON assessment_ai_checks;
DROP POLICY IF EXISTS ai_check_read ON assessment_ai_checks;
DROP POLICY IF EXISTS ai_check_request ON assessment_ai_checks;
DROP POLICY IF EXISTS ai_check_expire ON assessment_ai_checks;
CREATE POLICY ai_check_read ON assessment_ai_checks FOR SELECT USING(owner_id=current_setting('app.user_id',true));
CREATE POLICY ai_check_request ON assessment_ai_checks FOR INSERT WITH CHECK(owner_id=current_setting('app.user_id',true) AND status='queued' AND calls='[]'::jsonb AND checked_spec IS NULL AND report IS NULL AND sources IS NULL AND accounted_fen=CASE WHEN proposed_spec IS NULL THEN 30 ELSE 20 END AND EXISTS(SELECT 1 FROM assessment_packs p WHERE p.id=assessment_ai_checks.pack_id AND p.owner_id=assessment_ai_checks.owner_id AND p.status='pending'));
CREATE POLICY ai_check_expire ON assessment_ai_checks FOR UPDATE USING(owner_id=current_setting('app.user_id',true) AND status IN('queued','running')) WITH CHECK(owner_id=current_setting('app.user_id',true) AND status='failed');
DROP POLICY IF EXISTS ai_pack_publish ON assessment_packs;
DROP POLICY IF EXISTS own_pending_pack ON assessment_packs;
CREATE POLICY own_pending_pack ON assessment_packs FOR UPDATE USING(owner_id=current_setting('app.user_id',true) AND status='pending') WITH CHECK(owner_id=current_setting('app.user_id',true) AND status='pending' AND approval_mode='human' AND reviewer_id IS NULL AND approved_at IS NULL);
DROP POLICY IF EXISTS ai_backend_write ON assessment_ai_checks;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='learning_ai_worker') THEN
    CREATE POLICY ai_backend_write ON assessment_ai_checks FOR UPDATE TO learning_ai_worker USING(owner_id=current_setting('app.user_id',true)) WITH CHECK(owner_id=current_setting('app.user_id',true));
    CREATE POLICY ai_pack_publish ON assessment_packs FOR UPDATE TO learning_ai_worker USING(owner_id=current_setting('app.user_id',true) AND status='pending') WITH CHECK(owner_id=current_setting('app.user_id',true) AND status='approved' AND approval_mode='ai' AND reviewer_id IS NULL AND EXISTS(SELECT 1 FROM assessment_ai_checks a WHERE a.pack_id=assessment_packs.id AND a.owner_id=assessment_packs.owner_id AND a.status='completed' AND a.checked_spec=assessment_packs.spec));
  END IF;
END $$;
COMMIT;
