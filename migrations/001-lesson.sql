BEGIN;
CREATE TABLE IF NOT EXISTS lesson_attempts (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  lesson_id text NOT NULL,
  lesson_version text NOT NULL,
  submission_key uuid NOT NULL,
  score integer NOT NULL CHECK (score >= 0),
  total integer NOT NULL CHECK (total > 0 AND score <= total),
  answers jsonb NOT NULL,
  feedback jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, submission_key)
);
CREATE INDEX IF NOT EXISTS lesson_attempts_owner_created ON lesson_attempts(owner_id, created_at DESC);
ALTER TABLE lesson_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_attempts FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lesson_attempts' AND policyname='own_attempts') THEN
    CREATE POLICY own_attempts ON lesson_attempts
      USING (owner_id = current_setting('app.user_id', true))
      WITH CHECK (owner_id = current_setting('app.user_id', true));
  END IF;
END $$;
COMMIT;
