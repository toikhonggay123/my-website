CREATE TABLE `attendance` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` text NOT NULL,
	`space` text NOT NULL,
	`student_id` text NOT NULL,
	`session_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`grade` text NOT NULL,
	`class` text NOT NULL,
	`confirmed_at` integer NOT NULL,
	`teacher` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `meal_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_request_id_unique` ON `attendance` (`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_meal_per_student` ON `attendance` (`student_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `attendance_session` ON `attendance` (`space`,`session_id`);--> statement-breakpoint
CREATE TABLE `audit` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`space` text NOT NULL,
	`at` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`space` text NOT NULL,
	`name` text NOT NULL,
	`hash` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`lock_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_hash_unique` ON `devices` (`hash`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attendance_seq` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_at` integer DEFAULT 0 NOT NULL,
	`error` text,
	FOREIGN KEY (`attendance_seq`) REFERENCES `attendance`(`seq`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_attendance_seq_unique` ON `outbox` (`attendance_seq`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`space` text NOT NULL,
	`student_id` text NOT NULL,
	`session_id` text NOT NULL,
	`device_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`processed_at` integer,
	`actor` text,
	`reason` text,
	`lock_until` integer,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `meal_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `requests_queue` ON `requests` (`space`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`space` text NOT NULL,
	`meal` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`start` text,
	`end` text
);
--> statement-breakpoint
CREATE TABLE `meal_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`space` text NOT NULL,
	`date` text NOT NULL,
	`meal` text NOT NULL,
	`override` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`space` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`grade` text NOT NULL,
	`class` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_code` ON `students` (`space`,`code`);--> statement-breakpoint
CREATE INDEX `student_class` ON `students` (`space`,`grade`,`class`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX one_pending_per_device ON requests(device_id) WHERE status='pending';

--> statement-breakpoint
CREATE UNIQUE INDEX one_pending_per_student_session ON requests(student_id,session_id) WHERE status='pending';

--> statement-breakpoint
CREATE TRIGGER immutable_terminal_request BEFORE UPDATE ON requests
WHEN OLD.status!='pending' BEGIN SELECT RAISE(ABORT,'request_already_processed'); END;

--> statement-breakpoint
CREATE TRIGGER validate_request_insert BEFORE INSERT ON requests BEGIN
 SELECT CASE WHEN NEW.status!='pending' THEN RAISE(ABORT,'pending_required') END;
END;

--> statement-breakpoint
CREATE TRIGGER record_approved BEFORE UPDATE OF status ON requests
WHEN NEW.status='approved' BEGIN
 SELECT CASE WHEN NEW.actor IS NULL OR NEW.processed_at IS NULL THEN RAISE(ABORT,'teacher_required') END;
 INSERT INTO attendance(request_id,space,student_id,session_id,code,name,grade,class,confirmed_at,teacher)
 SELECT NEW.id,NEW.space,NEW.student_id,NEW.session_id,s.code,s.name,s.grade,s.class,NEW.processed_at,NEW.actor FROM students s WHERE s.id=NEW.student_id;
END;

--> statement-breakpoint
CREATE TRIGGER finish_request AFTER UPDATE OF status ON requests
WHEN NEW.status IN ('approved','rejected','expired') BEGIN
 UPDATE devices SET lock_until=NEW.lock_until WHERE id=NEW.device_id;
 INSERT INTO audit(space,at,actor,action,result) VALUES(NEW.space,NEW.processed_at,NEW.actor,NEW.status,NEW.id);
END;

--> statement-breakpoint
CREATE TRIGGER queue_sync AFTER INSERT ON attendance WHEN NEW.space='live' BEGIN
 INSERT INTO outbox(attendance_seq) VALUES(NEW.seq);
END;
