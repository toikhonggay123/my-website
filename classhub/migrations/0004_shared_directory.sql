ALTER TABLE students ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1));
CREATE TABLE directory_connections (
  org_id TEXT PRIMARY KEY NOT NULL REFERENCES organizations(id),
  source_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT -1,
  branch_id TEXT NOT NULL,
  synced_at INTEGER,
  sync_nonce TEXT,
  FOREIGN KEY(org_id,branch_id) REFERENCES branches(org_id,id)
);
CREATE TABLE directory_classes (
  org_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  grade TEXT NOT NULL,
  PRIMARY KEY(org_id,class_id),
  UNIQUE(org_id,external_id),
  FOREIGN KEY(org_id,class_id) REFERENCES classes(org_id,id)
);
CREATE TABLE directory_students (
  org_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_class_id TEXT NOT NULL,
  enrollment_id TEXT,
  PRIMARY KEY(org_id,student_id),
  UNIQUE(org_id,external_id),
  FOREIGN KEY(org_id,student_id) REFERENCES students(org_id,id),
  FOREIGN KEY(org_id,external_class_id) REFERENCES directory_classes(org_id,external_id),
  FOREIGN KEY(org_id,enrollment_id) REFERENCES enrollments(org_id,id)
);
