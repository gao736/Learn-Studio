BEGIN;
ALTER TABLE learning_courses ADD COLUMN IF NOT EXISTS content_revision integer NOT NULL DEFAULT 0 CHECK(content_revision>=0);
CREATE TABLE IF NOT EXISTS course_material_versions (
  course_id uuid NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK(revision>=0), version text NOT NULL,
  material jsonb NOT NULL, sources jsonb NOT NULL, reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(course_id,revision), UNIQUE(course_id,version)
);
ALTER TABLE course_material_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_material_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_material_versions ON course_material_versions;
CREATE POLICY own_material_versions ON course_material_versions USING(owner_id=current_setting('app.user_id',true))
  WITH CHECK(owner_id=current_setting('app.user_id',true) AND EXISTS(SELECT 1 FROM learning_courses c WHERE c.id=course_material_versions.course_id AND c.owner_id=course_material_versions.owner_id));
COMMIT;
