BEGIN;
CREATE TABLE IF NOT EXISTS assessment_reviewers (user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE);
ALTER TABLE assessment_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_reviewers FORCE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION is_assessment_reviewer() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM assessment_reviewers WHERE user_id=current_setting('app.user_id',true))
$$;
CREATE TABLE IF NOT EXISTS assessment_packs (
  id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE, spec jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved')),
  blocked_keys jsonb NOT NULL, reviewer_id text REFERENCES "user"(id) ON DELETE SET NULL,
  rationale text, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,course_id)
);
CREATE TABLE IF NOT EXISTS assessment_sessions (
  id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  pack_id text NOT NULL, pack_version integer NOT NULL, skill_id text NOT NULL,
  mode text NOT NULL CHECK(mode IN('diagnosis','exam','skip')),
  state text NOT NULL DEFAULT 'active' CHECK(state IN('active','submitted','expired')),
  questions jsonb NOT NULL, help jsonb NOT NULL DEFAULT '{}', answers jsonb NOT NULL DEFAULT '{}', feedback jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes', submitted_at timestamptz,
  UNIQUE(id,owner_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS assessment_one_active ON assessment_sessions(owner_id,pack_id,pack_version,skill_id) WHERE state='active';
CREATE INDEX IF NOT EXISTS assessment_owner_pack ON assessment_sessions(owner_id,pack_id,pack_version,created_at);
CREATE TABLE IF NOT EXISTS assessment_reviews (
  id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  session_id uuid NOT NULL, question_id text NOT NULL, reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','resolved')), correct boolean,
  reviewer_id text REFERENCES "user"(id) ON DELETE SET NULL, rationale text, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
  FOREIGN KEY(session_id,owner_id) REFERENCES assessment_sessions(id,owner_id) ON DELETE CASCADE,
  UNIQUE(session_id,question_id)
);
ALTER TABLE assessment_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_packs FORCE ROW LEVEL SECURITY;
ALTER TABLE assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE assessment_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_reviews FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='assessment_reviewers' AND policyname='reviewer_membership') THEN
    CREATE POLICY reviewer_membership ON assessment_reviewers FOR SELECT USING(user_id=current_setting('app.user_id',true));
    CREATE POLICY pack_read ON assessment_packs FOR SELECT USING(owner_id=current_setting('app.user_id',true) OR is_assessment_reviewer());
    CREATE POLICY pack_request ON assessment_packs FOR INSERT WITH CHECK(owner_id=current_setting('app.user_id',true) AND status='pending');
    CREATE POLICY pack_approve ON assessment_packs FOR UPDATE USING(is_assessment_reviewer()) WITH CHECK(is_assessment_reviewer());
    CREATE POLICY session_read ON assessment_sessions FOR SELECT USING(owner_id=current_setting('app.user_id',true) OR is_assessment_reviewer());
    CREATE POLICY session_insert ON assessment_sessions FOR INSERT WITH CHECK(owner_id=current_setting('app.user_id',true));
    CREATE POLICY session_update ON assessment_sessions FOR UPDATE USING(owner_id=current_setting('app.user_id',true)) WITH CHECK(owner_id=current_setting('app.user_id',true));
    CREATE POLICY review_read ON assessment_reviews FOR SELECT USING(owner_id=current_setting('app.user_id',true) OR is_assessment_reviewer());
    CREATE POLICY review_request ON assessment_reviews FOR INSERT WITH CHECK(owner_id=current_setting('app.user_id',true) AND status='pending');
    CREATE POLICY review_decide ON assessment_reviews FOR UPDATE USING(is_assessment_reviewer()) WITH CHECK(is_assessment_reviewer());
  END IF;
END $$;
COMMIT;
