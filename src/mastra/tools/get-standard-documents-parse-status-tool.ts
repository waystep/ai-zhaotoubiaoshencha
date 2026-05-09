import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";

const standardDocTypes = ["tender_doc", "legal_doc"] as const;

export const getStandardDocumentsParseStatusTool = createTool({
  id: "get-standard-documents-parse-status",
  description:
    "Get parse status for standard documents only (tender_doc and legal_doc). Never includes bid documents and never uses extraction status.",
  inputSchema: z.object({
    projectId: z.string().uuid().describe("Project ID"),
  }),
  outputSchema: z.object({
    projectId: z.string().uuid(),
    isReadyForReview: z
      .boolean()
      .describe("True when all standard documents have completed parsing"),
    totalStandardDocuments: z.number().int().nonnegative(),
    parseStats: z.object({
      pending: z.number().int().nonnegative(),
      processing: z.number().int().nonnegative(),
      completed: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
    }),
    documents: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        originalName: z.string(),
        docType: z.enum(standardDocTypes),
        parseStatus: z.enum(["pending", "processing", "completed", "failed"]),
        parseError: z.string().nullable(),
        parsedAt: z.string().nullable(),
      })
    ),
    summary: z.string(),
  }),
  execute: async ({ projectId }) => {
    try {
      const docs = await db.query.documents.findMany({
        where: and(
          eq(documents.projectId, projectId),
          inArray(documents.docType, [...standardDocTypes])
        ),
        orderBy: [documents.createdAt],
      });

      const parseStats = {
        pending: docs.filter((doc) => doc.parseStatus === "pending").length,
        processing: docs.filter((doc) => doc.parseStatus === "processing").length,
        completed: docs.filter((doc) => doc.parseStatus === "completed").length,
        failed: docs.filter((doc) => doc.parseStatus === "failed").length,
      };

      const isReadyForReview =
        docs.length > 0 &&
        docs.every((doc) => doc.parseStatus === "completed");

      const summary =
        docs.length === 0
          ? "No standard documents found. Review cannot start until tender or legal documents are uploaded and parsed."
          : `Found ${docs.length} standard documents. Parse status: ${parseStats.completed} completed, ${parseStats.processing} processing, ${parseStats.pending} pending, ${parseStats.failed} failed.`;

      return {
        projectId,
        isReadyForReview,
        totalStandardDocuments: docs.length,
        parseStats,
        documents: docs.map((doc) => ({
          id: doc.id,
          name: doc.name,
          originalName: doc.originalName,
          docType: doc.docType as (typeof standardDocTypes)[number],
          parseStatus: (doc.parseStatus ?? "pending") as
            | "pending"
            | "processing"
            | "completed"
            | "failed",
          parseError: doc.parseError ?? null,
          parsedAt: doc.parsedAt ? doc.parsedAt.toISOString() : null,
        })),
        summary,
      };
    } catch (error) {
      console.error("Failed to get standard document parse status:", error);
      return {
        projectId,
        isReadyForReview: false,
        totalStandardDocuments: 0,
        parseStats: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        },
        documents: [],
        summary: `Failed to get standard document parse status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});
