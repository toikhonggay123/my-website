CREATE TABLE timetable_rules (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),
  every_weeks INTEGER NOT NULL CHECK(every_weeks BETWEEN 1 AND 4),
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL CHECK(ends_on>=starts_on),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL CHECK(ends_at>starts_at),
  room TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY(org_id,id),
  UNIQUE(org_id,id,class_id),
  FOREIGN KEY(org_id,class_id) REFERENCES classes(org_id,id),
  FOREIGN KEY(org_id,teacher_id) REFERENCES memberships(org_id,user_id)
);
CREATE TABLE class_sessions (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  rule_id TEXT,
  source_date TEXT,
  lesson_date TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL CHECK(ends_at>starts_at),
  room TEXT NOT NULL COLLATE NOCASE DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
  attendance_state TEXT NOT NULL DEFAULT 'unmarked' CHECK(attendance_state IN ('unmarked','draft','finalized')),
  version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),
  edit_token TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(org_id,id),
  UNIQUE(org_id,id,class_id),
  UNIQUE(org_id,rule_id,source_date),
  CHECK((rule_id IS NULL)=(source_date IS NULL)),
  FOREIGN KEY(org_id,class_id,branch_id) REFERENCES classes(org_id,id,branch_id),
  FOREIGN KEY(org_id,rule_id,class_id) REFERENCES timetable_rules(org_id,id,class_id),
  FOREIGN KEY(org_id,teacher_id) REFERENCES memberships(org_id,user_id)
);
CREATE INDEX sessions_calendar ON class_sessions(org_id,lesson_date,starts_at);
CREATE INDEX sessions_class ON class_sessions(org_id,class_id,starts_at);
CREATE INDEX sessions_teacher ON class_sessions(org_id,teacher_id,starts_at);
CREATE INDEX sessions_room ON class_sessions(org_id,branch_id,room,starts_at) WHERE room <> '';

CREATE VIEW schedule_conflicts AS
  SELECT a.org_id,a.id AS session_id,b.id AS conflicting_id
  FROM class_sessions a JOIN class_sessions b
    ON a.org_id=b.org_id AND a.id<>b.id AND a.starts_at<b.ends_at AND a.ends_at>b.starts_at
    AND (a.class_id=b.class_id OR a.teacher_id=b.teacher_id OR
      (a.branch_id=b.branch_id AND a.room<>'' AND a.room=b.room))
  WHERE a.status<>'cancelled' AND b.status<>'cancelled';

CREATE TRIGGER session_insert_guard AFTER INSERT ON class_sessions BEGIN
  SELECT RAISE(ABORT,'SCHEDULE_CONFLICT') WHERE EXISTS (
    SELECT 1 FROM schedule_conflicts WHERE org_id=NEW.org_id AND session_id=NEW.id
  );
  SELECT RAISE(ABORT,'TEACHER_INACTIVE') WHERE NOT EXISTS (
    SELECT 1 FROM teacher_assignments a JOIN memberships m ON m.org_id=a.org_id AND m.user_id=a.user_id
    WHERE a.org_id=NEW.org_id AND a.class_id=NEW.class_id AND a.user_id=NEW.teacher_id
      AND a.ended_at IS NULL AND m.active=1 AND m.role='teacher'
  );
END;
CREATE TRIGGER session_update_guard AFTER UPDATE OF starts_at,ends_at,room,teacher_id ON class_sessions BEGIN
  SELECT RAISE(ABORT,'SCHEDULE_CONFLICT') WHERE EXISTS (
    SELECT 1 FROM schedule_conflicts WHERE org_id=NEW.org_id AND session_id=NEW.id
  );
  SELECT RAISE(ABORT,'TEACHER_INACTIVE') WHERE NOT EXISTS (
    SELECT 1 FROM teacher_assignments a JOIN memberships m ON m.org_id=a.org_id AND m.user_id=a.user_id
    WHERE a.org_id=NEW.org_id AND a.class_id=NEW.class_id AND a.user_id=NEW.teacher_id
      AND a.ended_at IS NULL AND m.active=1 AND m.role='teacher'
  );
END;

CREATE TABLE attendance_records (
  org_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('present','late','absent','excused','unmarked')),
  note TEXT NOT NULL DEFAULT '',
  marked_by TEXT NOT NULL REFERENCES "user"(id),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(org_id,session_id,enrollment_id),
  FOREIGN KEY(org_id,session_id,class_id) REFERENCES class_sessions(org_id,id,class_id),
  FOREIGN KEY(org_id,enrollment_id,class_id) REFERENCES enrollments(org_id,id,class_id)
);
