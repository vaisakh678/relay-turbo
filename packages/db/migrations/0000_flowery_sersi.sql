CREATE TYPE "public"."app_status" AS ENUM('live', 'paused');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('anthropic', 'openai', 'google');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('ok', 'error', 'rate_limited', 'aborted');--> statement-breakpoint
CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"emoji" text DEFAULT '✨' NOT NULL,
	"status" "app_status" DEFAULT 'paused' NOT NULL,
	"provider" "provider" NOT NULL,
	"model" text NOT NULL,
	"temperature" real DEFAULT 0.7 NOT NULL,
	"webhook_url" text,
	"signing_secret" text NOT NULL,
	"active_prompt_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "apps_temperature_range" CHECK ("apps"."temperature" between 0 and 2)
);
--> statement-breakpoint
CREATE TABLE "plan_limits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"app_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"messages_per_day" integer NOT NULL,
	"max_output_tokens" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_limits_messages_nonneg" CHECK ("plan_limits"."messages_per_day" >= 0),
	CONSTRAINT "plan_limits_tokens_positive" CHECK ("plan_limits"."max_output_tokens" > 0)
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"app_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_keys" (
	"provider" "provider" PRIMARY KEY NOT NULL,
	"api_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"app_id" uuid NOT NULL,
	"external_user_id" text NOT NULL,
	"plan" text NOT NULL,
	"provider" "provider" NOT NULL,
	"model" text NOT NULL,
	"prompt_version" integer NOT NULL,
	"status" "request_status" NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"ttft_ms" integer,
	"duration_ms" integer NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_limits" ADD CONSTRAINT "plan_limits_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "apps_slug_key" ON "apps" USING btree ("slug") WHERE "apps"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_limits_app_plan_key" ON "plan_limits" USING btree ("app_id","plan");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_versions_app_version_key" ON "prompt_versions" USING btree ("app_id","version");--> statement-breakpoint
CREATE INDEX "request_logs_app_created_idx" ON "request_logs" USING btree ("app_id","created_at");--> statement-breakpoint
CREATE INDEX "request_logs_app_user_created_idx" ON "request_logs" USING btree ("app_id","external_user_id","created_at");--> statement-breakpoint
CREATE INDEX "request_logs_created_idx" ON "request_logs" USING btree ("created_at");