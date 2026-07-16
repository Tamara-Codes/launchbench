CREATE TABLE `product_social_strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`primary_platform` text DEFAULT 'instagram' NOT NULL,
	`preferred_language` text DEFAULT 'hr' NOT NULL,
	`primary_audience` text DEFAULT '' NOT NULL,
	`brand_voice` text DEFAULT '' NOT NULL,
	`core_messages` text DEFAULT '[]' NOT NULL,
	`content_pillars` text DEFAULT '[]' NOT NULL,
	`visual_directions` text DEFAULT '[]' NOT NULL,
	`prohibited_claims` text DEFAULT '[]' NOT NULL,
	`banned_phrases` text DEFAULT '[]' NOT NULL,
	`preferred_ctas` text DEFAULT '[]' NOT NULL,
	`hashtag_guidance` text DEFAULT '' NOT NULL,
	`direct_sales_frequency` integer DEFAULT 1 NOT NULL,
	`posting_priority` integer DEFAULT 50 NOT NULL,
	`example_ideas` text DEFAULT '[]' NOT NULL,
	`advanced_context` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_social_strategy_product_uq` ON `product_social_strategies` (`product_id`);