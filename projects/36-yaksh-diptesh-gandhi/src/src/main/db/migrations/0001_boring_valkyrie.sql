ALTER TABLE `chat_sessions` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD `total_tokens` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD `parent_session_id` text;