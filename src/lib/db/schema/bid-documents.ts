/**
 * Bid Document Schema
 *
 * Stores generated or uploaded bid documents with structured sections
 * that link back to review items, response items, and scoring info.
 *
 * Sections are stored as JSONB with the following structure:
 * [{
 *   id: "uuid",
 *   sectionNo: "1",
 *   title: "投标函",
 *   content: "...",
 *   parentId: null,
 *   linkedReviewItems: ["uuid"],
 *   linkedResponseItems: ["uuid"],
 *   scoringInfo: { score: 10, weight: 0.1 },
 *   status: "generated" | "edited" | "empty"
 * }]
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenderProjects, documents, users } from "./index";

// ==================== 投标文档 ====================

export const bidDocuments = pgTable("bid_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => tenderProjects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  source: varchar("source", { length: 20 }).notNull(), // "generated" | "uploaded"
  documentFileId: uuid("document_file_id"), // FK to documents table
  sections: jsonb("sections").notNull(), // Array of section objects
  metadata: jsonb("metadata"),
  version: integer("version").default(1),
  status: varchar("status", { length: 20 }).default("draft"), // draft | editing | finalized
  createdById: uuid("created_by_id")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// ==================== 投标文档关系 ====================

export const bidDocumentsRelations = relations(bidDocuments, ({ one }) => ({
  project: one(tenderProjects, {
    fields: [bidDocuments.projectId],
    references: [tenderProjects.id],
  }),
  documentFile: one(documents, {
    fields: [bidDocuments.documentFileId],
    references: [documents.id],
  }),
  createdBy: one(users, {
    fields: [bidDocuments.createdById],
    references: [users.id],
  }),
}));
