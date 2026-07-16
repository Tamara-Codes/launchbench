ALTER TABLE `products` ADD `ideal_business_types` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `products` ADD `fit_signals` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `products` ADD `exclusions` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `products` ADD `search_guidance` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `territories` ADD `product_id` text REFERENCES `products`(`id`);
--> statement-breakpoint
ALTER TABLE `leads` ADD `product_id` text REFERENCES `products`(`id`);
--> statement-breakpoint
UPDATE `territories`
SET `product_id` = (
  SELECT `product_id` FROM `search_runs`
  WHERE `search_runs`.`territory_id` = `territories`.`id`
  ORDER BY `created_at` DESC LIMIT 1
)
WHERE `product_id` IS NULL;
--> statement-breakpoint
UPDATE `leads`
SET `product_id` = (
  SELECT `product_id` FROM `search_runs`
  WHERE `search_runs`.`id` = `leads`.`run_id`
)
WHERE `run_id` IS NOT NULL;
