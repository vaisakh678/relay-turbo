CREATE TYPE "public"."token_kind" AS ENUM('live', 'test', 'playground');--> statement-breakpoint
CREATE TABLE "test_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"app_id" uuid NOT NULL,
	"label" text NOT NULL,
	"external_user_id" text NOT NULL,
	"plan" text NOT NULL,
	"vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "allow_test_tokens" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "token_kind" "token_kind" DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "test_token_id" uuid;--> statement-breakpoint
ALTER TABLE "test_tokens" ADD CONSTRAINT "test_tokens_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "test_tokens_app_created_idx" ON "test_tokens" USING btree ("app_id","created_at");--> statement-breakpoint
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_test_token_id_test_tokens_id_fk" FOREIGN KEY ("test_token_id") REFERENCES "public"."test_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "request_logs_test_token_idx" ON "request_logs" USING btree ("test_token_id");