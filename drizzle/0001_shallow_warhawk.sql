CREATE TABLE `forum_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uploader_id` integer NOT NULL,
	`url` text NOT NULL,
	`filename` text NOT NULL,
	`byte_size` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`uploader_id`) REFERENCES `forum_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forum_attachments_url_unique` ON `forum_attachments` (`url`);--> statement-breakpoint
CREATE INDEX `idx_forum_attachments_uploader_id` ON `forum_attachments` (`uploader_id`,`id`);--> statement-breakpoint
CREATE TABLE `forum_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`position` integer NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forum_categories_slug_unique` ON `forum_categories` (`slug`);--> statement-breakpoint
INSERT INTO `forum_categories` (`slug`, `title`, `description`, `position`) VALUES
  ('general', 'General', 'Community discussion and site feedback.', 1),
  ('projects-tooling', 'Projects & Tooling', 'Project releases, developer tools, and implementation notes.', 2),
  ('systems-research', 'Systems & Research', 'Systems engineering, research, and technical discussion.', 3);--> statement-breakpoint
CREATE TABLE `forum_moderation_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`action` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `forum_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `forum_replies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`body` text NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`topic_id`) REFERENCES `forum_topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `forum_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_forum_replies_topic_id` ON `forum_replies` (`topic_id`,`id`);--> statement-breakpoint
CREATE TABLE `forum_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reporter_id` integer NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `forum_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_forum_reports_status_id` ON `forum_reports` (`status`,`id`);--> statement-breakpoint
CREATE TABLE `forum_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `forum_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forum_sessions_token_hash_unique` ON `forum_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_forum_sessions_token_expiry` ON `forum_sessions` (`token_hash`,`expires_at`);--> statement-breakpoint
CREATE TABLE `forum_topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`is_locked` integer DEFAULT false NOT NULL,
	`is_sticky` integer DEFAULT false NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`last_activity_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `forum_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `forum_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_forum_topics_category_activity` ON `forum_topics` (`category_id`,`is_hidden`,`is_sticky`,`last_activity_at`);--> statement-breakpoint
CREATE TABLE `forum_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`username_key` text NOT NULL,
	`password_hash` text NOT NULL,
	`is_suspended` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forum_users_username_unique` ON `forum_users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `forum_users_username_key_unique` ON `forum_users` (`username_key`);--> statement-breakpoint
CREATE INDEX `idx_forum_users_username_key` ON `forum_users` (`username_key`);
