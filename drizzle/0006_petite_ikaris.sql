CREATE TABLE "bid_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"source" varchar(20) NOT NULL,
	"document_file_id" uuid,
	"sections" jsonb NOT NULL,
	"metadata" jsonb,
	"version" integer DEFAULT 1,
	"status" varchar(20) DEFAULT 'draft',
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bid_documents" ADD CONSTRAINT "bid_documents_project_id_tender_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tender_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_documents" ADD CONSTRAINT "bid_documents_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;