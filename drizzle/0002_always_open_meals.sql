DROP TRIGGER approval_session_guard;
--> statement-breakpoint
CREATE TRIGGER approval_session_guard BEFORE UPDATE OF status ON requests
WHEN NEW.status='approved' BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM meal_sessions m JOIN devices d ON d.id=NEW.device_id JOIN students s ON s.id=NEW.student_id
  WHERE m.id=NEW.session_id AND m.space=NEW.space AND d.space=NEW.space AND s.space=NEW.space
  AND d.active=1 AND s.active=1
  AND m.date=strftime('%Y-%m-%d',NEW.processed_at/1000,'unixepoch','+7 hours')
 ) THEN RAISE(ABORT,'session_no_longer_active') END;
END;
