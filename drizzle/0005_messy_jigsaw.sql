CREATE TYPE "public"."knowledge_base_type" AS ENUM('legal_regulation', 'bid_template', 'risk_item', 'custom');--> statement-breakpoint
CREATE TYPE "public"."rule_detection_type" AS ENUM('keyword', 'comparison', 'semantic', 'existence');--> statement-breakpoint
CREATE TABLE "knowledge_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "knowledge_base_type" NOT NULL,
	"description" text,
	"icon" varchar(50),
	"organization_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true,
	"document_count" integer DEFAULT 0,
	"total_chunks" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_item_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" jsonb,
	"token_count" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"title" varchar(500),
	"content" text NOT NULL,
	"source" varchar(255),
	"metadata" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"is_vectorized" boolean DEFAULT false,
	"chunk_count" integer DEFAULT 0,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rule_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"rule_no" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"detection_type" "rule_detection_type",
	"severity" varchar(10) NOT NULL,
	"description" text NOT NULL,
	"parameters" jsonb,
	"is_enabled" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"industry" varchar(100),
	"agent_id" uuid,
	"is_active" boolean DEFAULT true,
	"organization_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "knowledge_item_chunks" ADD CONSTRAINT "knowledge_item_chunks_item_id_knowledge_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."knowledge_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_items" ADD CONSTRAINT "rule_items_rule_set_id_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."rule_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_agent_id_agent_definitions_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_definitions"("id") ON DELETE set null ON UPDATE no action;