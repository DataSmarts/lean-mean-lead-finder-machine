CREATE TYPE "public"."business_enrich_status" AS ENUM('queued', 'ai_running', 'hunter_running', 'enriched', 'partial', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."contact_kind" AS ENUM('person', 'merged');--> statement-breakpoint
CREATE TYPE "public"."contact_source" AS ENUM('ai', 'hunter');--> statement-breakpoint
CREATE TYPE "public"."email_verification" AS ENUM('valid', 'invalid', 'accept_all', 'webmail', 'disposable', 'unknown', 'unverified');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'discovering', 'awaiting_approval', 'rejected', 'enriching', 'completed', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."trigger_source" AS ENUM('dashboard', 'schedule', 'api');--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_place_id" text NOT NULL,
	"name" text NOT NULL,
	"website_uri" text,
	"website_domain" text,
	"formatted_address" text,
	"national_phone" text,
	"international_phone" text,
	"rating" double precision,
	"user_rating_count" integer,
	"price_level" text,
	"types" text[] DEFAULT '{}'::text[] NOT NULL,
	"first_seen_run_id" uuid,
	"last_seen_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"source" "contact_source" NOT NULL,
	"kind" "contact_kind" NOT NULL,
	"full_name" text,
	"first_name" text,
	"last_name" text,
	"title" text,
	"email" text,
	"email_confidence" integer,
	"email_verification" "email_verification" DEFAULT 'unverified' NOT NULL,
	"seniority" text,
	"department" text,
	"phone" text,
	"linkedin_url" text,
	"instagram_url" text,
	"twitter_url" text,
	"facebook_url" text,
	"merged_into_id" uuid,
	"field_sources" jsonb,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"page_index" integer NOT NULL,
	"page_token" text,
	"results_count" integer DEFAULT 0 NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"neighborhood" text,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"niche" text NOT NULL,
	"max_results" integer DEFAULT 120 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"cron" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presets_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "run_businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"enrich_status" "business_enrich_status" DEFAULT 'queued' NOT NULL,
	"ai_status" "source_status" DEFAULT 'queued' NOT NULL,
	"hunter_status" "source_status" DEFAULT 'queued' NOT NULL,
	"ai_error" text,
	"hunter_error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"enriched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preset_id" uuid,
	"trigger_source" "trigger_source" NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"neighborhood" text,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"niche" text NOT NULL,
	"max_results" integer NOT NULL,
	"geocode_lat" double precision,
	"geocode_lng" double precision,
	"businesses_found" integer DEFAULT 0 NOT NULL,
	"businesses_enriched" integer DEFAULT 0 NOT NULL,
	"businesses_failed" integer DEFAULT 0 NOT NULL,
	"contacts_found" integer DEFAULT 0 NOT NULL,
	"approval_token" text NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" text,
	"rejected_at" timestamp with time zone,
	"trigger_run_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "runs_approval_token_unique" UNIQUE("approval_token")
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_merged_into_id_contacts_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_pages" ADD CONSTRAINT "discovery_pages_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_businesses" ADD CONSTRAINT "run_businesses_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_businesses" ADD CONSTRAINT "run_businesses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_preset_id_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."presets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_google_place_id_uidx" ON "businesses" USING btree ("google_place_id");--> statement-breakpoint
CREATE INDEX "businesses_website_domain_idx" ON "businesses" USING btree ("website_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_run_business_source_email_uidx" ON "contacts" USING btree ("run_id","business_id","source","email");--> statement-breakpoint
CREATE INDEX "contacts_run_business_idx" ON "contacts" USING btree ("run_id","business_id");--> statement-breakpoint
CREATE INDEX "contacts_run_kind_idx" ON "contacts" USING btree ("run_id","kind");--> statement-breakpoint
CREATE INDEX "contacts_lower_email_idx" ON "contacts" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_pages_run_page_uidx" ON "discovery_pages" USING btree ("run_id","page_index");--> statement-breakpoint
CREATE UNIQUE INDEX "run_businesses_run_business_uidx" ON "run_businesses" USING btree ("run_id","business_id");--> statement-breakpoint
CREATE INDEX "run_businesses_run_enrich_idx" ON "run_businesses" USING btree ("run_id","enrich_status");--> statement-breakpoint
CREATE INDEX "runs_status_created_at_idx" ON "runs" USING btree ("status","created_at" DESC NULLS LAST);