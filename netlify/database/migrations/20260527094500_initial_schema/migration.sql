CREATE TYPE "public"."bid_status" AS ENUM('draft', 'submitted', 'under_review', 'accepted', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('tender_doc', 'legal_doc', 'bid_doc', 'review_report');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."image_risk_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."issue_severity" AS ENUM('critical', 'major', 'minor', 'suggestion');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('tender_org', 'supplier', 'review_org');--> statement-breakpoint
CREATE TYPE "public"."parse_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'published', 'bidding', 'reviewing', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."response_item_result_status" AS ENUM('answered', 'partially_answered', 'unanswered', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."review_item_result_status" AS ENUM('pass', 'fail', 'needs_manual_review');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('tender_manager', 'tender_staff', 'supplier_admin', 'supplier_staff', 'review_expert', 'system_admin');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource" varchar(100),
	"resource_id" uuid,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bid_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"supplier_org_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"bid_price" numeric(15, 2),
	"bid_description" text,
	"status" "bid_status" DEFAULT 'draft',
	"submitted_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parsed_result_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"block_index" integer NOT NULL,
	"block_type" varchar(50),
	"content" text NOT NULL,
	"bbox" jsonb DEFAULT '{"x0":0,"y0":0,"x1":0,"y1":0}'::jsonb,
	"image_path" varchar(255),
	"parent_block_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_page_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"parsed_result_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"page_text" text NOT NULL,
	"block_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"embedding" jsonb NOT NULL,
	"embedding_model" varchar(100) DEFAULT 'text-embedding-3-small',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_parsed_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"total_pages" integer NOT NULL,
	"full_text" text,
	"structured_content" jsonb DEFAULT '{}'::jsonb,
	"mineru_raw_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"storage_path" text NOT NULL,
	"parse_status" "parse_status" DEFAULT 'pending',
	"parse_error" text,
	"parsed_at" timestamp,
	"mineru_task_id" varchar(100),
	"task_progress" integer DEFAULT 0,
	"task_submitted_at" timestamp,
	"extraction_status" "extraction_status" DEFAULT 'pending',
	"extraction_error" text,
	"extracted_at" timestamp,
	"extraction_task_id" varchar(100),
	"extraction_progress" integer DEFAULT 0,
	"extraction_items_count" integer DEFAULT 0,
	"auto_extract" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "extraction_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_id" uuid,
	"section" varchar(20),
	"title" varchar(200) NOT NULL,
	"checkpoint" text NOT NULL,
	"consequence" numeric(5, 2),
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extracted_by" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "image_risk_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"block_id" uuid,
	"image_path" varchar(255) NOT NULL,
	"page_number" integer NOT NULL,
	"status" "image_risk_status" DEFAULT 'pending',
	"error" text,
	"has_risk" boolean,
	"risk_type" varchar(100),
	"risk_text" varchar(255),
	"confidence" numeric(5, 2),
	"raw_response" jsonb DEFAULT '{}'::jsonb,
	"is_verified" boolean DEFAULT false,
	"verified_by" uuid,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"org_type" "org_type" DEFAULT 'supplier' NOT NULL,
	"license_no" varchar(100),
	"contact_person" varchar(100),
	"contact_phone" varchar(50),
	"address" text,
	"qualification" jsonb DEFAULT '{}'::jsonb,
	"logo" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "response_item_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"response_item_id" uuid NOT NULL,
	"status" "response_item_result_status" NOT NULL,
	"reason" text NOT NULL,
	"evidence_block_ids" jsonb DEFAULT '[]'::jsonb,
	"confidence" numeric(5, 2),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "response_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"source_block_id" uuid,
	"response_type" varchar(100) NOT NULL,
	"item_no" varchar(100),
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"location" jsonb DEFAULT '{"pageNumber":0,"blockIndex":0,"bbox":{"x0":0,"y0":0,"x1":0,"y1":0},"textSnippet":"","highlightText":""}'::jsonb NOT NULL,
	"response_requirements" jsonb DEFAULT '{"requiredFormat":null,"requiredContent":[],"minLength":null,"attachments":[]}'::jsonb,
	"scoring_info" jsonb DEFAULT '{"weight":null,"scoringCriteria":null}'::jsonb,
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
CREATE TABLE "review_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"block_id" uuid,
	"checkpoint_id" varchar(100),
	"agent_source" varchar(100),
	"category" varchar(100) NOT NULL,
	"severity" "issue_severity" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"location" jsonb DEFAULT '{"pageNumber":0,"blockIndex":0,"bbox":{"x0":0,"y0":0,"x1":0,"y1":0},"textSnippet":"","highlightText":""}'::jsonb NOT NULL,
	"suggestion" text,
	"is_resolved" boolean DEFAULT false,
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_item_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"review_item_id" uuid NOT NULL,
	"status" "review_item_result_status" NOT NULL,
	"reason" text NOT NULL,
	"evidence_block_ids" jsonb DEFAULT '[]'::jsonb,
	"confidence" numeric(5, 2),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"source_block_id" uuid,
	"item_type" varchar(100) NOT NULL,
	"item_no" varchar(100),
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"location" jsonb DEFAULT '{"pageNumber":0,"blockIndex":0,"bbox":{"x0":0,"y0":0,"x1":0,"y1":0},"textSnippet":"","highlightText":""}'::jsonb NOT NULL,
	"requirements" jsonb DEFAULT '{"mandatory":true,"threshold":null,"criteria":[],"proofRequired":[]}'::jsonb,
	"consequence" varchar(100),
	"legal_reference" text,
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
CREATE TABLE "review_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"reviewed_by" uuid,
	"status" "review_status" DEFAULT 'pending',
	"ai_score" numeric(5, 2),
	"ai_analysis" jsonb DEFAULT '{}'::jsonb,
	"manual_score" numeric(5, 2),
	"manual_analysis" jsonb DEFAULT '{}'::jsonb,
	"final_score" numeric(5, 2),
	"recommendation" varchar(50),
	"summary" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" NOT NULL,
	"permission_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tender_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"project_no" varchar(100) NOT NULL,
	"description" text,
	"tender_type" varchar(50),
	"budget" numeric(15, 2),
	"deadline" timestamp,
	"status" "project_status" DEFAULT 'draft',
	"requirements" jsonb DEFAULT '{"qualification":[],"experience":[],"technical":[],"compliance":[]}'::jsonb,
	"scoring_rules" jsonb DEFAULT '{"weights":{"price":30,"technical":40,"service":20,"compliance":10},"criteria":[]}'::jsonb,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false,
	"name" varchar(255),
	"avatar" text,
	"password_hash" text,
	"phone" varchar(50),
	"role" "user_role" DEFAULT 'supplier_staff',
	"expert_info" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_submissions" ADD CONSTRAINT "bid_submissions_project_id_tender_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tender_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_submissions" ADD CONSTRAINT "bid_submissions_supplier_org_id_organizations_id_fk" FOREIGN KEY ("supplier_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_submissions" ADD CONSTRAINT "bid_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_blocks" ADD CONSTRAINT "document_blocks_parsed_result_id_document_parsed_results_id_fk" FOREIGN KEY ("parsed_result_id") REFERENCES "public"."document_parsed_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_page_embeddings" ADD CONSTRAINT "document_page_embeddings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_page_embeddings" ADD CONSTRAINT "document_page_embeddings_parsed_result_id_document_parsed_results_id_fk" FOREIGN KEY ("parsed_result_id") REFERENCES "public"."document_parsed_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_parsed_results" ADD CONSTRAINT "document_parsed_results_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_tender_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tender_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_items" ADD CONSTRAINT "extraction_items_project_id_tender_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tender_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_items" ADD CONSTRAINT "extraction_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_risk_analysis" ADD CONSTRAINT "image_risk_analysis_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_risk_analysis" ADD CONSTRAINT "image_risk_analysis_block_id_document_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."document_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_risk_analysis" ADD CONSTRAINT "image_risk_analysis_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_item_results" ADD CONSTRAINT "response_item_results_report_id_review_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."review_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_item_results" ADD CONSTRAINT "response_item_results_response_item_id_response_items_id_fk" FOREIGN KEY ("response_item_id") REFERENCES "public"."response_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_items" ADD CONSTRAINT "response_items_project_id_tender_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tender_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_items" ADD CONSTRAINT "response_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_items" ADD CONSTRAINT "response_items_source_block_id_document_blocks_id_fk" FOREIGN KEY ("source_block_id") REFERENCES "public"."document_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_items" ADD CONSTRAINT "response_items_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_issues" ADD CONSTRAINT "review_issues_report_id_review_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."review_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_issues" ADD CONSTRAINT "review_issues_block_id_document_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."document_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_issues" ADD CONSTRAINT "review_issues_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_item_results" ADD CONSTRAINT "review_item_results_report_id_review_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."review_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_item_results" ADD CONSTRAINT "review_item_results_review_item_id_extraction_items_id_fk" FOREIGN KEY ("review_item_id") REFERENCES "public"."extraction_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_project_id_tender_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tender_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_source_block_id_document_blocks_id_fk" FOREIGN KEY ("source_block_id") REFERENCES "public"."document_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_project_id_tender_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tender_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_projects" ADD CONSTRAINT "tender_projects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_projects" ADD CONSTRAINT "tender_projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;