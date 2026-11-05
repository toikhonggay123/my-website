CREATE TABLE directory_revisions (
  space TEXT PRIMARY KEY NOT NULL CHECK(space IN ('live','demo')),
  revision INTEGER NOT NULL DEFAULT 0
);
INSERT INTO directory_revisions(space) VALUES ('live'),('demo');
INSERT OR IGNORE INTO settings(key,value) VALUES ('directory:instance',lower(hex(randomblob(16))));

CREATE TABLE directory_classes (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  space TEXT NOT NULL CHECK(space IN ('live','demo')),
  grade TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(space,grade,name),
  UNIQUE(space,id)
);
INSERT INTO directory_classes(space,grade,name)
SELECT DISTINCT space,grade,class FROM students;

CREATE TABLE directory_operations (
  id TEXT PRIMARY KEY NOT NULL,
  space TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  nonce TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  applied INTEGER NOT NULL DEFAULT 1 CHECK(applied=1),
  created_at INTEGER NOT NULL
);

CREATE TRIGGER directory_class_insert AFTER INSERT ON directory_classes BEGIN
  UPDATE directory_revisions SET revision=revision+1 WHERE space=NEW.space;
END;
CREATE TRIGGER directory_class_update AFTER UPDATE OF grade,name ON directory_classes
WHEN OLD.grade<>NEW.grade OR OLD.name<>NEW.name BEGIN
  UPDATE students SET grade=NEW.grade,class=NEW.name
    WHERE space=OLD.space AND grade=OLD.grade AND class=OLD.name;
  UPDATE directory_revisions SET revision=revision+1 WHERE space=NEW.space;
END;
CREATE TRIGGER directory_student_insert AFTER INSERT ON students BEGIN
  INSERT INTO directory_classes(space,grade,name)
  SELECT NEW.space,NEW.grade,NEW.class WHERE NOT EXISTS (
    SELECT 1 FROM directory_classes WHERE space=NEW.space AND grade=NEW.grade AND name=NEW.class
  );
  UPDATE directory_revisions SET revision=revision+1 WHERE space=NEW.space;
END;
CREATE TRIGGER directory_student_update AFTER UPDATE OF code,name,grade,class,active ON students
WHEN OLD.code<>NEW.code OR OLD.name<>NEW.name OR OLD.grade<>NEW.grade OR OLD.class<>NEW.class OR OLD.active<>NEW.active BEGIN
  INSERT INTO directory_classes(space,grade,name)
  SELECT NEW.space,NEW.grade,NEW.class WHERE NOT EXISTS (
    SELECT 1 FROM directory_classes WHERE space=NEW.space AND grade=NEW.grade AND name=NEW.class
  );
  UPDATE directory_revisions SET revision=revision+1 WHERE space=NEW.space;
END;
CREATE TRIGGER directory_student_delete AFTER DELETE ON students BEGIN
  UPDATE directory_revisions SET revision=revision+1 WHERE space=OLD.space;
END;
