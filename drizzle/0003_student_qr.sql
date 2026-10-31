CREATE TABLE `student_qr` (
	`student_id` text PRIMARY KEY NOT NULL,
	`space` text NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_qr_token_unique` ON `student_qr` (`token`);