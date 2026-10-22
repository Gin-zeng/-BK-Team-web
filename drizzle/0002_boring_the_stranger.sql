CREATE TABLE `ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`dims` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ratings_player_idx` ON `ratings` (`player_id`);