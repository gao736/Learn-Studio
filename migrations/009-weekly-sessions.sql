BEGIN;
CREATE TABLE IF NOT EXISTS weekly_sessions (
 id uuid PRIMARY KEY, plan_id uuid NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
 owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, week integer NOT NULL CHECK(week>0),
 pack_version integer NOT NULL, source_version text NOT NULL,
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','submitted','expired')),
 questions jsonb NOT NULL, sources jsonb NOT NULL, answers jsonb NOT NULL DEFAULT '{}', feedback jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes',
 submitted_at timestamptz, adjusted_at timestamptz, applied_changes jsonb NOT NULL DEFAULT '[]'
);
CREATE UNIQUE INDEX IF NOT EXISTS weekly_plan_week ON weekly_sessions(plan_id,week) WHERE state<>'expired';
ALTER TABLE weekly_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_weekly ON weekly_sessions;
CREATE POLICY own_weekly ON weekly_sessions USING(owner_id=current_setting('app.user_id',true))
 WITH CHECK(owner_id=current_setting('app.user_id',true) AND EXISTS(SELECT 1 FROM study_plans p WHERE p.id=plan_id AND p.owner_id=weekly_sessions.owner_id));
COMMIT;
