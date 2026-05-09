import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { documents, reviewReports } from "@/lib/db/schema";

export const resolveReviewReportTool = createTool({
  id: "resolve-review-report",
  description:
    "Resolve or validate the review report for a bid document under a project. Prefer explicit reportId when provided.",
  inputSchema: z.object({
    projectId: z.string().uuid().describe("Project ID"),
    bidDocumentId: z.string().uuid().describe("Bid document ID"),
    reportId: z.string().uuid().optional().describe("Explicit review report ID when already known"),
  }),
  outputSchema: z.object({
    reportId: z.string().uuid(),
    projectId: z.string().uuid(),
    documentId: z.string().uuid(),
    status: z.enum(["pending", "in_progress", "completed", "failed"]),
    created: z.boolean(),
    summary: z.string(),
  }),
  execute: async ({ projectId, bidDocumentId, reportId }) => {
    const document = await db.query.documents.findFirst({
      where: and(eq(documents.id, bidDocumentId), eq(documents.projectId, projectId)),
      columns: {
        id: true,
        projectId: true,
        docType: true,
      },
    });

    if (!document) {
      throw new Error("Bid document not found in project.");
    }

    if (document.docType !== "bid_doc") {
      throw new Error("The provided document is not a bid document.");
    }

    if (reportId) {
      const explicitReport = await db.query.reviewReports.findFirst({
        where: and(
          eq(reviewReports.id, reportId),
          eq(reviewReports.projectId, projectId),
          eq(reviewReports.documentId, bidDocumentId)
        ),
        columns: {
          id: true,
          projectId: true,
          documentId: true,
          status: true,
        },
      });

      if (!explicitReport) {
        throw new Error("The provided reportId does not match the project and bid document.");
      }

      return {
        reportId: explicitReport.id,
        projectId: explicitReport.projectId,
        documentId: explicitReport.documentId,
        status: explicitReport.status ?? "pending",
        created: false,
        summary: "Validated explicit review report for bid document.",
      };
    }

    const existingReport = await db.query.reviewReports.findFirst({
      where: and(
        eq(reviewReports.projectId, projectId),
        eq(reviewReports.documentId, bidDocumentId)
      ),
      orderBy: [desc(reviewReports.createdAt)],
      columns: {
        id: true,
        projectId: true,
        documentId: true,
        status: true,
      },
    });

    if (existingReport) {
      return {
        reportId: existingReport.id,
        projectId: existingReport.projectId,
        documentId: existingReport.documentId,
        status: existingReport.status ?? "pending",
        created: false,
        summary: "Resolved existing review report for bid document.",
      };
    }

    const [createdReport] = await db
      .insert(reviewReports)
      .values({
        projectId,
        documentId: bidDocumentId,
        status: "pending",
      })
      .returning({
        id: reviewReports.id,
        projectId: reviewReports.projectId,
        documentId: reviewReports.documentId,
        status: reviewReports.status,
      });

    return {
      reportId: createdReport.id,
      projectId: createdReport.projectId,
      documentId: createdReport.documentId,
      status: createdReport.status ?? "pending",
      created: true,
      summary: "Created review report for bid document.",
    };
  },
});
