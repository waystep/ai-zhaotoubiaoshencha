CREATE TABLE "document_page_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"parsed_result_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"page_text" text NOT NULL,
	"block_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"embedding" jsonb NOT NULL,
	"embedding_model" varchar(100) DEFAULT 'text-embedding-3-small',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "document_page_embeddings" ADD CONSTRAINT "document_page_embeddings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_page_embeddings" ADD CONSTRAINT "document_page_embeddings_parsed_result_id_document_parsed_results_id_fk" FOREIGN KEY ("parsed_result_id") REFERENCES "public"."document_parsed_results"("id") ON DELETE cascade ON UPDATE no action;