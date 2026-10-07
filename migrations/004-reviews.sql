BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS lesson_attempt_owner_identity ON lesson_attempts(id,owner_id);
CREATE TABLE IF NOT EXISTS review_cards (
  id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  fingerprint text NOT NULL, question jsonb NOT NULL, question_id text NOT NULL,
  label text NOT NULL, provenance text NOT NULL CHECK(provenance IN('curated','real')),
  lesson_attempt_id uuid, session_id uuid,
  course_id uuid REFERENCES learning_courses(id) ON DELETE CASCADE,
  memory jsonb NOT NULL, due timestamptz NOT NULL, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(lesson_attempt_id,owner_id) REFERENCES lesson_attempts(id,owner_id) ON DELETE CASCADE,
  FOREIGN KEY(session_id,owner_id) REFERENCES assessment_sessions(id,owner_id) ON DELETE CASCADE,
  CHECK(num_nonnulls(lesson_attempt_id,session_id)=1), UNIQUE(owner_id,fingerprint), UNIQUE(id,owner_id)
);
CREATE INDEX IF NOT EXISTS review_due ON review_cards(owner_id,due,id);
CREATE TABLE IF NOT EXISTS review_attempts (
  id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  card_id uuid NOT NULL, revision integer NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','submitted')),
  answer text, self_rating text CHECK(self_rating IN('hard','good','easy')), feedback jsonb,
  before_memory jsonb, after_memory jsonb, fsrs_log jsonb, parameters jsonb, algorithm text,
  created_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz,
  FOREIGN KEY(card_id,owner_id) REFERENCES review_cards(id,owner_id) ON DELETE CASCADE,
  UNIQUE(card_id,revision)
);
ALTER TABLE review_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cards FORCE ROW LEVEL SECURITY;
ALTER TABLE review_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_attempts FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='review_cards' AND policyname='own_review_cards') THEN
    CREATE POLICY own_review_cards ON review_cards USING(owner_id=current_setting('app.user_id',true)) WITH CHECK(owner_id=current_setting('app.user_id',true));
    CREATE POLICY own_review_attempts ON review_attempts USING(owner_id=current_setting('app.user_id',true)) WITH CHECK(owner_id=current_setting('app.user_id',true));
  END IF;
END $$;
COMMIT;
