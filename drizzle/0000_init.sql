CREATE TABLE `agent_prompt_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`version` integer NOT NULL,
	`system_prompt` text NOT NULL,
	`task_prompt_template` text NOT NULL,
	`model` text NOT NULL,
	`temperature` real NOT NULL,
	`max_output_tokens` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `apv_agent_idx` ON `agent_prompt_versions` (`agent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `apv_agent_version_uq` ON `agent_prompt_versions` (`agent_id`,`version`);--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`agent_type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`system_prompt` text NOT NULL,
	`task_prompt_template` text NOT NULL,
	`model` text DEFAULT 'gemini-2.5-flash' NOT NULL,
	`temperature` real DEFAULT 0.2 NOT NULL,
	`max_output_tokens` integer DEFAULT 2048 NOT NULL,
	`configuration` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agents_slug_uq` ON `agents` (`slug`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`active_territory_id` text,
	`active_product_id` text,
	`sender_name` text DEFAULT '' NOT NULL,
	`sender_company` text DEFAULT '' NOT NULL,
	`sender_email` text DEFAULT '' NOT NULL,
	`sender_signature` text DEFAULT '' NOT NULL,
	`daily_lead_target` integer DEFAULT 10 NOT NULL,
	`qualification_settings` text NOT NULL,
	`exhaustion_settings` text NOT NULL,
	`last_backup_at` integer,
	`last_backup_path` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`active_territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`active_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`entity_type` text DEFAULT '' NOT NULL,
	`entity_id` text DEFAULT '' NOT NULL,
	`territory_id` text,
	`lead_id` text,
	`message` text DEFAULT '' NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_event_idx` ON `audit_logs` (`event_type`);--> statement-breakpoint
CREATE INDEX `audit_lead_idx` ON `audit_logs` (`lead_id`);--> statement-breakpoint
CREATE TABLE `discovered_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`territory_id` text NOT NULL,
	`url` text NOT NULL,
	`url_hash` text NOT NULL,
	`domain` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`snippet` text DEFAULT '' NOT NULL,
	`query` text DEFAULT '' NOT NULL,
	`rank` integer DEFAULT 0 NOT NULL,
	`outcome` text DEFAULT 'discovered' NOT NULL,
	`rejection_reason` text DEFAULT '' NOT NULL,
	`lead_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `search_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cand_run_idx` ON `discovered_candidates` (`run_id`);--> statement-breakpoint
CREATE INDEX `cand_territory_idx` ON `discovered_candidates` (`territory_id`);--> statement-breakpoint
CREATE INDEX `cand_domain_idx` ON `discovered_candidates` (`domain`);--> statement-breakpoint
CREATE INDEX `cand_outcome_idx` ON `discovered_candidates` (`outcome`);--> statement-breakpoint
CREATE INDEX `cand_urlhash_idx` ON `discovered_candidates` (`url_hash`);--> statement-breakpoint
CREATE TABLE `duplicate_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text,
	`candidate_id` text,
	`matched_lead_id` text,
	`match_type` text NOT NULL,
	`score` real DEFAULT 1 NOT NULL,
	`resolution` text DEFAULT 'uncertain' NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`candidate_id`) REFERENCES `discovered_candidates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `dup_lead_idx` ON `duplicate_matches` (`lead_id`);--> statement-breakpoint
CREATE INDEX `dup_matched_idx` ON `duplicate_matches` (`matched_lead_id`);--> statement-breakpoint
CREATE INDEX `dup_resolution_idx` ON `duplicate_matches` (`resolution`);--> statement-breakpoint
CREATE TABLE `email_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`email_type` text NOT NULL,
	`language` text DEFAULT 'hr' NOT NULL,
	`recipient_email` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`unresolved_variables` text DEFAULT '[]' NOT NULL,
	`source_facts_used` text DEFAULT '[]' NOT NULL,
	`warnings` text DEFAULT '[]' NOT NULL,
	`send_key` text NOT NULL,
	`in_reply_to_thread_id` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `drafts_lead_idx` ON `email_drafts` (`lead_id`);--> statement-breakpoint
CREATE INDEX `drafts_status_idx` ON `email_drafts` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_sendkey_uq` ON `email_drafts` (`send_key`);--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`language` text DEFAULT 'hr' NOT NULL,
	`email_type` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `templates_type_lang_idx` ON `email_templates` (`email_type`,`language`);--> statement-breakpoint
CREATE TABLE `follow_up_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`first_follow_up_days` integer DEFAULT 4 NOT NULL,
	`final_follow_up_days` integer DEFAULT 7 NOT NULL,
	`max_follow_ups` integer DEFAULT 2 NOT NULL,
	`stop_after_reply` integer DEFAULT true NOT NULL,
	`stop_after_opt_out` integer DEFAULT true NOT NULL,
	`stop_after_invalid_address` integer DEFAULT true NOT NULL,
	`stop_after_not_interested` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gmail_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`connected_account_id` text DEFAULT '' NOT NULL,
	`connection_request_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`account_email` text DEFAULT '' NOT NULL,
	`composio_user_id` text DEFAULT 'local-user' NOT NULL,
	`auth_config_id` text DEFAULT '' NOT NULL,
	`last_checked_at` integer,
	`last_reply_check_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lead_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`url` text NOT NULL,
	`url_hash` text NOT NULL,
	`field` text DEFAULT '' NOT NULL,
	`snippet` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lead_sources_lead_idx` ON `lead_sources` (`lead_id`);--> statement-breakpoint
CREATE TABLE `lead_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`from_status` text DEFAULT '' NOT NULL,
	`to_status` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lead_history_lead_idx` ON `lead_status_history` (`lead_id`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`territory_id` text NOT NULL,
	`run_id` text,
	`business_name` text NOT NULL,
	`accommodation_name` text DEFAULT '' NOT NULL,
	`accommodation_type` text DEFAULT '' NOT NULL,
	`town` text DEFAULT '' NOT NULL,
	`settlement` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`domain` text DEFAULT '' NOT NULL,
	`normalized_domain` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`normalized_email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`normalized_phone` text DEFAULT '' NOT NULL,
	`contact_page_url` text DEFAULT '' NOT NULL,
	`normalized_name` text DEFAULT '' NOT NULL,
	`estimated_units` integer,
	`direct_booking` integer DEFAULT false NOT NULL,
	`international_guests_likely` integer DEFAULT false NOT NULL,
	`existing_digital_guide_detected` integer DEFAULT false NOT NULL,
	`is_in_target_location` integer DEFAULT false NOT NULL,
	`language_preference` text DEFAULT 'hr' NOT NULL,
	`status` text DEFAULT 'awaitingReview' NOT NULL,
	`lead_score` integer DEFAULT 0 NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`facts` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`last_contacted_at` integer,
	`next_follow_up_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `search_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `leads_territory_idx` ON `leads` (`territory_id`);--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX `leads_norm_email_idx` ON `leads` (`normalized_email`);--> statement-breakpoint
CREATE INDEX `leads_norm_domain_idx` ON `leads` (`normalized_domain`);--> statement-breakpoint
CREATE INDEX `leads_norm_phone_idx` ON `leads` (`normalized_phone`);--> statement-breakpoint
CREATE INDEX `leads_norm_name_idx` ON `leads` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `leads_next_followup_idx` ON `leads` (`next_follow_up_at`);--> statement-breakpoint
CREATE TABLE `processed_urls` (
	`id` text PRIMARY KEY NOT NULL,
	`territory_id` text,
	`url` text NOT NULL,
	`url_hash` text NOT NULL,
	`domain` text NOT NULL,
	`action` text DEFAULT 'scraped' NOT NULL,
	`last_processed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `processed_urlhash_uq` ON `processed_urls` (`url_hash`);--> statement-breakpoint
CREATE INDEX `processed_domain_idx` ON `processed_urls` (`domain`);--> statement-breakpoint
CREATE INDEX `processed_territory_idx` ON `processed_urls` (`territory_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_description` text DEFAULT '' NOT NULL,
	`full_description` text DEFAULT '' NOT NULL,
	`target_customer` text DEFAULT '' NOT NULL,
	`core_benefit` text DEFAULT '' NOT NULL,
	`price_text` text DEFAULT '' NOT NULL,
	`demo_url` text DEFAULT '' NOT NULL,
	`website_url` text DEFAULT '' NOT NULL,
	`email_generation_context` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scheduled_follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`sequence` integer DEFAULT 1 NOT NULL,
	`email_type` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`draft_id` text,
	`cancelled_reason` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`draft_id`) REFERENCES `email_drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `followups_lead_idx` ON `scheduled_follow_ups` (`lead_id`);--> statement-breakpoint
CREATE INDEX `followups_due_idx` ON `scheduled_follow_ups` (`due_at`);--> statement-breakpoint
CREATE INDEX `followups_status_idx` ON `scheduled_follow_ups` (`status`);--> statement-breakpoint
CREATE TABLE `scraped_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text,
	`url` text NOT NULL,
	`url_hash` text NOT NULL,
	`domain` text NOT NULL,
	`page_type` text DEFAULT 'landing' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`markdown` text DEFAULT '' NOT NULL,
	`http_status` integer,
	`scraped_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `discovered_candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scraped_candidate_idx` ON `scraped_pages` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `scraped_urlhash_idx` ON `scraped_pages` (`url_hash`);--> statement-breakpoint
CREATE TABLE `search_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`territory_id` text NOT NULL,
	`run_id` text,
	`raw_query` text NOT NULL,
	`normalized_query` text NOT NULL,
	`source` text DEFAULT 'template' NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL,
	`new_result_count` integer DEFAULT 0 NOT NULL,
	`exhausted` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `search_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `queries_territory_idx` ON `search_queries` (`territory_id`);--> statement-breakpoint
CREATE INDEX `queries_norm_idx` ON `search_queries` (`normalized_query`);--> statement-breakpoint
CREATE INDEX `queries_run_idx` ON `search_queries` (`run_id`);--> statement-breakpoint
CREATE TABLE `search_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`territory_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`product_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`stage` text DEFAULT 'queued' NOT NULL,
	`config` text NOT NULL,
	`stats` text NOT NULL,
	`current_candidate` text DEFAULT '' NOT NULL,
	`last_event_at` integer,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`exhaustion_signal` text DEFAULT '' NOT NULL,
	`error_message` text DEFAULT '' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `runs_territory_idx` ON `search_runs` (`territory_id`);--> statement-breakpoint
CREATE INDEX `runs_status_idx` ON `search_runs` (`status`);--> statement-breakpoint
CREATE INDEX `runs_created_idx` ON `search_runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `sent_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`draft_id` text,
	`email_type` text NOT NULL,
	`recipient_email` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`gmail_message_id` text DEFAULT '' NOT NULL,
	`gmail_thread_id` text DEFAULT '' NOT NULL,
	`provider` text DEFAULT 'composio_gmail' NOT NULL,
	`send_key` text NOT NULL,
	`sent_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`draft_id`) REFERENCES `email_drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sent_lead_idx` ON `sent_emails` (`lead_id`);--> statement-breakpoint
CREATE INDEX `sent_thread_idx` ON `sent_emails` (`gmail_thread_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sent_sendkey_uq` ON `sent_emails` (`send_key`);--> statement-breakpoint
CREATE TABLE `territories` (
	`id` text PRIMARY KEY NOT NULL,
	`town` text NOT NULL,
	`country` text DEFAULT 'Croatia' NOT NULL,
	`included_settlements` text DEFAULT '[]' NOT NULL,
	`excluded_settlements` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`possibly_exhausted` integer DEFAULT false NOT NULL,
	`confirmed_exhausted` integer DEFAULT false NOT NULL,
	`total_search_runs` integer DEFAULT 0 NOT NULL,
	`total_candidates_found` integer DEFAULT 0 NOT NULL,
	`total_qualified_leads` integer DEFAULT 0 NOT NULL,
	`total_contacted` integer DEFAULT 0 NOT NULL,
	`last_searched_at` integer,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `territories_town_idx` ON `territories` (`town`);--> statement-breakpoint
CREATE INDEX `territories_active_idx` ON `territories` (`active`);--> statement-breakpoint
CREATE UNIQUE INDEX `territories_town_country_uq` ON `territories` (`town`,`country`);