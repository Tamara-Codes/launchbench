CREATE TABLE `content_agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`product_id` text NOT NULL,
	`action_type` text NOT NULL,
	`input_summary` text DEFAULT '' NOT NULL,
	`output_summary` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `content_agent_runs_agent_idx` ON `content_agent_runs` (`agent_id`);--> statement-breakpoint
CREATE INDEX `content_agent_runs_product_idx` ON `content_agent_runs` (`product_id`);--> statement-breakpoint
CREATE TABLE `generated_image_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`social_content_item_id` text NOT NULL,
	`product_id` text NOT NULL,
	`file_path` text NOT NULL,
	`prompt` text NOT NULL,
	`provider` text DEFAULT 'openai' NOT NULL,
	`model` text NOT NULL,
	`generation_settings` text DEFAULT '{}' NOT NULL,
	`response_metadata` text DEFAULT '{}' NOT NULL,
	`reference_asset_ids` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`social_content_item_id`) REFERENCES `social_content_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generated_image_item_idx` ON `generated_image_assets` (`social_content_item_id`);--> statement-breakpoint
CREATE INDEX `generated_image_product_idx` ON `generated_image_assets` (`product_id`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`file_path` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer,
	`height` integer,
	`tags` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`is_preferred_reference` integer DEFAULT false NOT NULL,
	`is_approved_brand_asset` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_product_idx` ON `media_assets` (`product_id`);--> statement-breakpoint
CREATE INDEX `media_created_idx` ON `media_assets` (`created_at`);--> statement-breakpoint
CREATE TABLE `social_content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`source_agent_id` text,
	`platform` text DEFAULT 'instagram' NOT NULL,
	`format` text DEFAULT 'single_image' NOT NULL,
	`content_type` text NOT NULL,
	`hook` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`cta` text DEFAULT '' NOT NULL,
	`hashtags` text DEFAULT '[]' NOT NULL,
	`image_prompt` text DEFAULT '' NOT NULL,
	`on_image_text` text DEFAULT '' NOT NULL,
	`visual_direction` text DEFAULT '' NOT NULL,
	`carousel_plan` text DEFAULT '[]' NOT NULL,
	`language` text DEFAULT 'hr' NOT NULL,
	`status` text DEFAULT 'idea' NOT NULL,
	`scheduled_for` integer,
	`posted_at` integer,
	`posted_url` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`rating` integer,
	`performed_well` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `social_product_idx` ON `social_content_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `social_status_idx` ON `social_content_items` (`status`);--> statement-breakpoint
CREATE INDEX `social_scheduled_idx` ON `social_content_items` (`scheduled_for`);--> statement-breakpoint
CREATE INDEX `social_created_idx` ON `social_content_items` (`created_at`);--> statement-breakpoint
ALTER TABLE `products` ADD `brand_voice` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `visual_style` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `color_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `social_media_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `preferred_cta` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `preferred_language` text DEFAULT 'hr' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `content_dos` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `content_donts` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `posting_priority` integer DEFAULT 0 NOT NULL;