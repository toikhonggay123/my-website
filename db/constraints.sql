CREATE UNIQUE INDEX one_pending_per_device ON requests(device_id) WHERE status='pending';
CREATE UNIQUE INDEX one_pending_per_student_session ON requests(student_id,session_id) WHERE status='pending';
CREATE TRIGGER immutable_terminal_request BEFORE UPDATE ON requests
WHEN OLD.status!='pending' BEGIN SELECT RAISE(ABORT,'request_already_processed'); END;
CREATE TRIGGER validate_request_insert BEFORE INSERT ON requests BEGIN
 SELECT CASE WHEN NEW.status!='pending' THEN RAISE(ABORT,'pending_required') END;
END;
CREATE TRIGGER record_approved BEFORE UPDATE OF status ON requests
WHEN NEW.status='approved' BEGIN
 SELECT CASE WHEN NEW.actor IS NULL OR NEW.processed_at IS NULL THEN RAISE(ABORT,'teacher_required') END;
 INSERT INTO attendance(request_id,space,student_id,session_id,code,name,grade,class,confirmed_at,teacher)
 SELECT NEW.id,NEW.space,NEW.student_id,NEW.session_id,s.code,s.name,s.grade,s.class,NEW.processed_at,NEW.actor FROM students s WHERE s.id=NEW.student_id;
END;
CREATE TRIGGER finish_request AFTER UPDATE OF status ON requests
WHEN NEW.status IN ('approved','rejected','expired') BEGIN
 UPDATE devices SET lock_until=NEW.lock_until WHERE id=NEW.device_id;
 INSERT INTO audit(space,at,actor,action,result) VALUES(NEW.space,NEW.processed_at,NEW.actor,NEW.status,NEW.id);
END;
CREATE TRIGGER queue_sync AFTER INSERT ON attendance WHEN NEW.space='live' BEGIN
 INSERT INTO outbox(attendance_seq) VALUES(NEW.seq);
END;
