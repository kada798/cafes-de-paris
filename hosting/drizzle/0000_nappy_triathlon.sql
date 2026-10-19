CREATE TABLE `engagement_events` (
	`event_key` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`actor` text NOT NULL,
	`kind` text NOT NULL,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `engagement_source_time` ON `engagement_events` (`source_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `engagement_actor_time` ON `engagement_events` (`actor`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `engagement_likes` (
	`source_id` text NOT NULL,
	`actor` text NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`source_id`, `actor`)
);
