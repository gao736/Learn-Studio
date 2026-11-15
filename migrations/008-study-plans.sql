BEGIN;
CREATE TABLE IF NOT EXISTS study_plans (
 id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 course_key text NOT NULL, pack_id text NOT NULL, pack_version integer NOT NULL,
 source_version text NOT NULL, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,course_key)
);
CREATE TABLE IF NOT EXISTS study_plan_versions (
 plan_id uuid NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
 owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 revision integer NOT NULL, payload jsonb NOT NULL, reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(plan_id,revision)
);
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE study_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plan_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_study_plans ON study_plans;
CREATE POLICY own_study_plans ON study_plans USING(owner_id=current_setting('app.user_id',true))
 WITH CHECK(owner_id=current_setting('app.user_id',true) AND (course_key='astronomy' OR EXISTS(SELECT 1 FROM learning_courses c WHERE c.id::text=course_key AND c.owner_id=study_plans.owner_id)));
DROP POLICY IF EXISTS own_study_versions ON study_plan_versions;
CREATE POLICY own_study_versions ON study_plan_versions USING(owner_id=current_setting('app.user_id',true))
 WITH CHECK(owner_id=current_setting('app.user_id',true) AND EXISTS(SELECT 1 FROM study_plans p WHERE p.id=plan_id AND p.owner_id=study_plan_versions.owner_id));
COMMIT;
