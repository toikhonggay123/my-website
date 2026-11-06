-- School mode: terms, subjects, bell periods, closures, subject-teacher assignments,
-- versioned weekly timetables and one attendance session per class and shift.
-- Additive only. Existing course/class/session data is unchanged.

CREATE TABLE school_terms (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  id TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL CHECK(ends_on>=starts_on),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(org_id,id),
  UNIQUE(org_id,name)
);

CREATE TABLE subjects (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  id TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  short_name TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(org_id,id),
  UNIQUE(org_id,name)
);

CREATE TABLE bell_periods (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  shift TEXT NOT NULL CHECK(shift IN ('morning','afternoon')),
  period INTEGER NOT NULL CHECK(period BETWEEN 1 AND 10),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL CHECK(ends_at>starts_at),
  PRIMARY KEY(org_id,shift,period)
);

CREATE TABLE school_closures (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  closed_on TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(org_id,closed_on)
);

CREATE TABLE teaching_assignments (
  org_id TEXT NOT NULL,
  term_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(org_id,term_id,class_id,subject_id),
  FOREIGN KEY(org_id,term_id) REFERENCES school_terms(org_id,id),
  FOREIGN KEY(org_id,class_id) REFERENCES classes(org_id,id),
  FOREIGN KEY(org_id,subject_id) REFERENCES subjects(org_id,id),
  FOREIGN KEY(org_id,user_id) REFERENCES memberships(org_id,user_id)
);
CREATE INDEX teaching_assignments_teacher ON teaching_assignments(org_id,user_id,term_id);

-- A term has at most one draft. A published version applies from effective_from until a later
-- published version of the same term. Republishing from the same or an earlier date archives later versions.
CREATE TABLE timetable_versions (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  term_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  effective_from TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER,
  published_by TEXT REFERENCES "user"(id),
  PRIMARY KEY(org_id,id),
  FOREIGN KEY(org_id,term_id) REFERENCES school_terms(org_id,id),
  CHECK((status='draft' AND effective_from IS NULL) OR (status<>'draft' AND effective_from IS NOT NULL))
);
CREATE UNIQUE INDEX timetable_one_draft ON timetable_versions(org_id,term_id) WHERE status='draft';
CREATE UNIQUE INDEX timetable_effective ON timetable_versions(org_id,term_id,effective_from) WHERE status='published';

CREATE TABLE timetable_slots (
  org_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),
  shift TEXT NOT NULL CHECK(shift IN ('morning','afternoon')),
  period INTEGER NOT NULL CHECK(period BETWEEN 1 AND 10),
  subject_id TEXT NOT NULL,
  room TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(org_id,version_id,class_id,weekday,shift,period),
  FOREIGN KEY(org_id,version_id) REFERENCES timetable_versions(org_id,id),
  FOREIGN KEY(org_id,class_id) REFERENCES classes(org_id,id),
  FOREIGN KEY(org_id,subject_id) REFERENCES subjects(org_id,id)
);

-- School attendance sessions carry their shift. Course sessions keep shift NULL.
ALTER TABLE class_sessions ADD COLUMN shift TEXT CHECK(shift IN ('morning','afternoon'));
CREATE UNIQUE INDEX sessions_school_shift ON class_sessions(org_id,class_id,lesson_date,shift) WHERE shift IS NOT NULL;
