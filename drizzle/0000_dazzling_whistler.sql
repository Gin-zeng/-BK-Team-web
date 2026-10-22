CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`game_id` text NOT NULL,
	`data` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imports_fingerprint_unique` ON `imports` (`fingerprint`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`upload_id` text NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
