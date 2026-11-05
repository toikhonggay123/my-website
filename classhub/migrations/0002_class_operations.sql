CREATE TABLE organizations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('independent','center','school','other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE branches (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  id TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY(org_id,id),
  UNIQUE(org_id,name)
);
CREATE TABLE memberships (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES "user"(id),
  branch_id TEXT,
  role TEXT NOT NULL CHECK(role IN ('owner','branch_admin','teacher')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(org_id,user_id),
  FOREIGN KEY(org_id,branch_id) REFERENCES branches(org_id,id),
  CHECK((role='owner' AND branch_id IS NULL) OR (role='branch_admin' AND branch_id IS NOT NULL) OR role='teacher')
);
CREATE INDEX memberships_by_user ON memberships(user_id,active,org_id);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT REFERENCES organizations(id),
  branch_id TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','branch_admin','teacher')),
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(org_id,branch_id) REFERENCES branches(org_id,id),
  CHECK((role='owner' AND org_id IS NULL AND branch_id IS NULL) OR
        (role='branch_admin' AND org_id IS NOT NULL AND branch_id IS NOT NULL) OR
        (role='teacher' AND org_id IS NOT NULL))
);

CREATE TABLE courses (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  id TEXT NOT NULL,
  code TEXT COLLATE NOCASE NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(org_id,id),
  UNIQUE(org_id,code)
);
CREATE TABLE classes (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  code TEXT COLLATE NOCASE NOT NULL,
  name TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL CHECK(ends_on>=starts_on),
  capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 100),
  room TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','active','completed','archived','cancelled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(org_id,id),
  UNIQUE(org_id,code),
  UNIQUE(org_id,id,branch_id),
  FOREIGN KEY(org_id,course_id) REFERENCES courses(org_id,id),
  FOREIGN KEY(org_id,branch_id) REFERENCES branches(org_id,id)
);
CREATE INDEX classes_branch ON classes(org_id,branch_id,status,name);
CREATE TABLE students (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  id TEXT NOT NULL,
  code TEXT COLLATE NOCASE NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(org_id,id),
  UNIQUE(org_id,code)
);
CREATE INDEX students_by_name ON students(org_id,name,id);

CREATE TABLE teacher_assignments (
  org_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  duty TEXT NOT NULL CHECK(duty IN ('primary','support')),
  assigned_at INTEGER NOT NULL,
  ended_at INTEGER,
  PRIMARY KEY(org_id,class_id,user_id,assigned_at),
  FOREIGN KEY(org_id,class_id) REFERENCES classes(org_id,id),
  FOREIGN KEY(org_id,user_id) REFERENCES memberships(org_id,user_id)
);
CREATE UNIQUE INDEX teacher_assignment_active ON teacher_assignments(org_id,class_id,user_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX teacher_assignment_primary ON teacher_assignments(org_id,class_id) WHERE ended_at IS NULL AND duty='primary';
CREATE INDEX teacher_assignments_scope ON teacher_assignments(org_id,user_id,class_id) WHERE ended_at IS NULL;

CREATE TABLE enrollments (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  enrolled_on TEXT NOT NULL,
  withdrawn_on TEXT CHECK(withdrawn_on>=enrolled_on),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(org_id,id),
  UNIQUE(org_id,id,class_id),
  FOREIGN KEY(org_id,class_id) REFERENCES classes(org_id,id),
  FOREIGN KEY(org_id,student_id) REFERENCES students(org_id,id)
);
CREATE UNIQUE INDEX enrollment_active ON enrollments(org_id,class_id,student_id) WHERE withdrawn_on IS NULL;
CREATE INDEX enrollments_roster ON enrollments(org_id,class_id,enrolled_on,withdrawn_on);
CREATE INDEX enrollments_student ON enrollments(org_id,student_id,enrolled_on);

CREATE TRIGGER enrollments_validate BEFORE INSERT ON enrollments BEGIN
  SELECT RAISE(ABORT,'ENROLLMENT_OVERLAP') WHERE EXISTS (
    SELECT 1 FROM enrollments e WHERE e.org_id=NEW.org_id AND e.class_id=NEW.class_id
      AND e.student_id=NEW.student_id AND e.withdrawn_on IS DISTINCT FROM e.enrolled_on
      AND (e.withdrawn_on IS NULL OR e.withdrawn_on>NEW.enrolled_on)
  );
  SELECT RAISE(ABORT,'CLASS_CAPACITY') WHERE (
    SELECT COUNT(*) FROM enrollments e WHERE e.org_id=NEW.org_id AND e.class_id=NEW.class_id
      AND (e.withdrawn_on IS NULL OR (e.withdrawn_on>NEW.enrolled_on AND e.withdrawn_on>e.enrolled_on))
  ) >= (SELECT capacity FROM classes WHERE org_id=NEW.org_id AND id=NEW.class_id);
END;

CREATE TRIGGER classes_capacity BEFORE UPDATE OF capacity ON classes BEGIN
  SELECT RAISE(ABORT,'CLASS_CAPACITY') WHERE NEW.capacity < (
    SELECT COUNT(*) FROM enrollments WHERE org_id=NEW.org_id AND class_id=NEW.id AND withdrawn_on IS NULL
  );
END;

CREATE TABLE audit_events (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES "user"(id),
  event TEXT NOT NULL,
  target_id TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(org_id,id)
);
CREATE INDEX audit_events_target ON audit_events(org_id,target_id,occurred_at DESC);
