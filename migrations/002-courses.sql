BEGIN;
CREATE TABLE IF NOT EXISTS learning_courses (
  id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  submission_key uuid NOT NULL, created_day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai')::date,
  goal jsonb NOT NULL, schedule jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','queued','running','ready','failed')),
  error text NOT NULL DEFAULT '', material jsonb, sources jsonb NOT NULL DEFAULT '[]',
  provenance text NOT NULL DEFAULT 'pending' CHECK(provenance IN('pending','real','simulation')),
  active_generation uuid, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,submission_key), UNIQUE(owner_id,created_day)
);
CREATE TABLE IF NOT EXISTS course_generations (
  id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  status text NOT NULL CHECK(status IN('queued','running','completed','failed')),
  budget_day text NOT NULL, reserved_fen integer NOT NULL DEFAULT 10,
  accounted_fen integer NOT NULL DEFAULT 10 CHECK(accounted_fen >= 0),
  billing_status text NOT NULL DEFAULT 'reserved' CHECK(billing_status IN('reserved','estimated','unknown','simulation')),
  usage jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_generations_course ON course_generations(course_id);
CREATE TABLE IF NOT EXISTS model_budgets (period text PRIMARY KEY, used_fen integer NOT NULL CHECK(used_fen >= 0));
ALTER TABLE learning_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_courses FORCE ROW LEVEL SECURITY;
ALTER TABLE course_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_generations FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='learning_courses' AND policyname='own_courses') THEN
    CREATE POLICY own_courses ON learning_courses USING(owner_id=current_setting('app.user_id',true)) WITH CHECK(owner_id=current_setting('app.user_id',true));
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='course_generations' AND policyname='own_generations') THEN
    CREATE POLICY own_generations ON course_generations USING(owner_id=current_setting('app.user_id',true)) WITH CHECK(owner_id=current_setting('app.user_id',true));
  END IF;
END $$;
COMMIT;
