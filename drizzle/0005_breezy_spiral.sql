CREATE TYPE "public"."extraction_item_category" AS ENUM('review', 'response');--> statement-breakpoint
CREATE TABLE "extraction_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"source_block_id" uuid,
	"item_category" "extraction_item_category" NOT NULL,
	"item_type" varchar(100) NOT NULL,
	"item_no" varchar(100),
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"location" jsonb DEFAULT '{"pageNumber":0,"blockIndex":0,"bbox":{"x0":0,"y0":0,"x1":0,"y1":0},"textSnippet":"","highlightText":""}'::jsonb NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb,
	"consequence" varchar(100),
	"legal_reference" text,
	"response_requirements" jsonb DEFAULT '{}'::jsonb,
	"scoring_info" jsonb DEFAULT '{}'::jsonb,
	"extraction_status" "extraction_status" DEFAULT 'completed',
	"extracted_by" varchar(100),
	"extraction_confidence" numeric(5, 2),
	"extraction_metadata" jsonb DEFAULT '{}'::jsonb,
	"is_verified" boolean DEFAULT false,
	"verified_by" uuid,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "extraction_items_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "extraction_items" ADD CONSTRAINT "extraction_items_project_id_tender_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tender_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_items" ADD CONSTRAINT "extraction_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_items" ADD CONSTRAINT "extraction_items_source_block_id_document_blocks_id_fk" FOREIGN KEY ("source_block_id") REFERENCES "public"."document_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_items" ADD CONSTRAINT "extraction_items_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;