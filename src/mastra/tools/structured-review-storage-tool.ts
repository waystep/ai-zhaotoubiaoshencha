import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  documentBlocks,
  responseItemResults,
  reviewIssues,
  reviewItemResults,
  reviewReports,
} from "@/lib/db/schema";

const locationSchema = z.object({
  pageNumber: z.number().int().positive(),
  blockIndex: z.number().int().nonnegative(),
  bbox: z
    .object({
      x0: z.number(),
      y0: z.number(),
      x1: z.number(),
      y1: z.number(),
    })
    .optional(),
  textSnippet: z.string().optional(),
  highlightText: z.string().optional(),
});

const issueSchema = z.object({
  blockId: z.string().uuid().optional(),
  checkpointId: z.string().optional(),
  category: z.string(),
  severity: z.enum(["critical", "major", "minor", "suggestion"]),
  title: z.string(),
  description: z.string(),
  location: locationSchema,
  suggestion: z.string().optional(),
  agentSource: z.string().optional(),
});

const reviewItemResultSchema = z.object({
  reviewItemId: z.string().uuid(),
  status: z.enum(["pass", "fail", "needs_manual_review"]),
  reason: z.string(),
  evidenceBlockIds: z.array(z.string().uuid()).default([]),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const responseItemResultSchema = z.object({
  responseItemId: z.string().uuid(),
  status: z.enum(["answered", "partially_answered", "unanswered", "not_applicable"]),
  reason: z.string(),
  evidenceBlockIds: z.array(z.string().uuid()).default([]),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function ensureUuid(value?: string | null) {
  if (!value) return null;
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

async function filterExistingBlockIds(blockIds: string[]) {
  if (blockIds.length === 0) return new Set<string>();

  const rows = await db.query.documentBlocks.findMany({
    where: inArray(documentBlocks.id, blockIds),
    columns: { id: true },
  });

  return new Set(rows.map((row) => row.id));
}

export const structuredReviewStorageTool = createTool({
  id: "structured-review-storage",
  description: "保存结构化审查结果，写入 report 摘要、问题项、review item results、response item results，并更新 report 状态。",
  inputSchema: z.object({
    reportId: z.string().uuid(),
    score: z.number().min(0).max(100),
    recommendation: z.enum(["pass", "fail", "revise"]),
    summary: z.string(),
    issues: z.array(issueSchema).default([]),
    reviewItemResults: z.array(reviewItemResultSchema).default([]),
    responseItemResults: z.array(responseItemResultSchema).default([]),
    aiAnalysis: z.record(z.string(), z.unknown()).optional(),
    modelConfigUsed: z.record(z.string(), z.unknown()).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reportId: z.string().uuid(),
    issueCount: z.number().int().nonnegative(),
    reviewItemResultCount: z.number().int().nonnegative(),
    responseItemResultCount: z.number().int().nonnegative(),
    message: z.string(),
  }),
  execute: async ({
    reportId,
    score,
    recommendation,
    summary,
    issues = [],
    reviewItemResults: reviewResults = [],
    responseItemResults: responseResults = [],
    aiAnalysis,
    modelConfigUsed,
  }) => {
    try {
      const report = await db.query.reviewReports.findFirst({
        where: eq(reviewReports.id, reportId),
        columns: { id: true, documentId: true },
      });

      if (!report) {
        throw new Error("报告不存在");
      }

      const requestedBlockIds = new Set<string>();
      for (const issue of issues) {
        const blockId = ensureUuid(issue.blockId);
        if (blockId) requestedBlockIds.add(blockId);
      }
      for (const result of reviewResults) {
        (result.evidenceBlockIds ?? []).forEach((id) => requestedBlockIds.add(id));
      }
      for (const result of responseResults) {
        (result.evidenceBlockIds ?? []).forEach((id) => requestedBlockIds.add(id));
      }

      const validBlockIds = await filterExistingBlockIds([...requestedBlockIds]);

      await db.delete(reviewIssues).where(eq(reviewIssues.reportId, reportId));
      await db.delete(reviewItemResults).where(eq(reviewItemResults.reportId, reportId));
      await db.delete(responseItemResults).where(eq(responseItemResults.reportId, reportId));

      if (issues.length > 0) {
        await db.insert(reviewIssues).values(
          issues.map((issue) => ({
            reportId,
            blockId: issue.blockId && validBlockIds.has(issue.blockId) ? issue.blockId : null,
            checkpointId: issue.checkpointId || null,
            agentSource: issue.agentSource || "report-generation-agent",
            category: issue.category,
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            location: issue.location,
            suggestion: issue.suggestion || null,
            isResolved: false,
          })),
        );
      }

      if (reviewResults.length > 0) {
        await db.insert(reviewItemResults).values(
          reviewResults.map((result) => ({
            reportId,
            reviewItemId: result.reviewItemId,
            status: result.status,
            reason: result.reason,
            evidenceBlockIds: (result.evidenceBlockIds ?? []).filter((id) => validBlockIds.has(id)),
            confidence: result.confidence != null ? String(result.confidence) : null,
            metadata: result.metadata || {},
          })),
        );
      }

      if (responseResults.length > 0) {
        await db.insert(responseItemResults).values(
          responseResults.map((result) => ({
            reportId,
            responseItemId: result.responseItemId,
            status: result.status,
            reason: result.reason,
            evidenceBlockIds: (result.evidenceBlockIds ?? []).filter((id) => validBlockIds.has(id)),
            confidence: result.confidence != null ? String(result.confidence) : null,
            metadata: result.metadata || {},
          })),
        );
      }

      const reviewItemsSummary = {
        total: reviewResults.length,
        pass: reviewResults.filter((item) => item.status === "pass").length,
        fail: reviewResults.filter((item) => item.status === "fail").length,
        needsManualReview: reviewResults.filter((item) => item.status === "needs_manual_review").length,
      };

      const responseCoverageSummary = {
        total: responseResults.length,
        answered: responseResults.filter((item) => item.status === "answered").length,
        partiallyAnswered: responseResults.filter((item) => item.status === "partially_answered").length,
        unanswered: responseResults.filter((item) => item.status === "unanswered").length,
        notApplicable: responseResults.filter((item) => item.status === "not_applicable").length,
      };

      await db
        .update(reviewReports)
        .set({
          status: "completed",
          aiScore: String(score),
          recommendation,
          summary,
          aiAnalysis: {
            ...(aiAnalysis || {}),
            reviewItemsSummary,
            responseCoverageSummary,
            modelConfigUsed: modelConfigUsed || null,
          },
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reviewReports.id, reportId));

      return {
        success: true,
        reportId,
        issueCount: issues.length,
        reviewItemResultCount: reviewResults.length,
        responseItemResultCount: responseResults.length,
        message: "结构化审查结果已保存",
      };
    } catch (error) {
      await db
        .update(reviewReports)
        .set({
          status: "failed",
          aiAnalysis: {
            error: error instanceof Error ? error.message : "结构化结果保存失败",
          },
          updatedAt: new Date(),
        })
        .where(eq(reviewReports.id, reportId));

      return {
        success: false,
        reportId,
        issueCount: 0,
        reviewItemResultCount: 0,
        responseItemResultCount: 0,
        message: error instanceof Error ? error.message : "结构化结果保存失败",
      };
    }
  },
});
