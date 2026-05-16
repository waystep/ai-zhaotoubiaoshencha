import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  documentBlocks,
  reviewIssues,
  reviewItemResults,
  extractionItems,
  reviewReports,
} from "@/lib/db/schema";

const locationSchema = z.object({
  pageNumber: z.number().int().positive(),
  blockIndex: z.number().int().nonnegative(),
  bbox: z.object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() }).optional(),
  textSnippet: z.string().optional(),
  highlightText: z.string().optional(),
});

const issueSchema = z.object({
  blockId: z.string().optional(),
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
  reviewItemId: z.string(),
  status: z.enum(["pass", "fail", "needs_manual_review"]),
  reason: z.string(),
  evidenceBlockIds: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// 辅助函数：解析可能是字符串或数组的输入
function parseFlexibleArray<T>(input: unknown, schema: z.ZodType<T>): T[] {
  if (Array.isArray(input)) {
    return input.map(item => schema.parse(item));
  }
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.map(item => schema.parse(item));
      }
    } catch {
      // 解析失败，返回空数组
    }
  }
  return [];
}

function isValidUuid(value?: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function filterExistingBlockIds(blockIds: string[]): Promise<Set<string>> {
  const validUuids = blockIds.filter(isValidUuid);
  if (validUuids.length === 0) return new Set<string>();
  const rows = await db.query.documentBlocks.findMany({
    where: inArray(documentBlocks.id, validUuids),
    columns: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

async function resolveReviewItemIds(projectId: string, inputIds: string[]): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  const items = await db.query.extractionItems.findMany({
    where: eq(extractionItems.projectId, projectId),
    columns: { id: true },
  });

  for (const inputId of inputIds) {
    if (isValidUuid(inputId)) {
      const exists = items.some((item) => item.id === inputId);
      if (exists) mapping.set(inputId, inputId);
      continue;
    }
    const numMatch = inputId.match(/\d+/);
    if (numMatch) {
      const index = parseInt(numMatch[0], 10) - 1;
      if (index >= 0 && index < items.length) {
        mapping.set(inputId, items[index].id);
      }
    }
  }
  return mapping;
}

export const reviewResultsStorageTool = createTool({
  id: "review-results-storage",
  description: "存储审查项结果和发现的问题。仅由投标文件审查智能体调用。保存 issues（问题列表）和 reviewItemResults（审查项结果），同时更新 score（评分 0-100）和 recommendation（建议结论：pass/fail/revise）。reviewItemId 可使用真实UUID或序号（如 '1', '2'）。",
  inputSchema: z.object({
    reportId: z.string().uuid(),
    score: z.number().min(0).max(100),
    recommendation: z.enum(["pass", "fail", "revise"]),
    issues: z.union([z.array(issueSchema), z.string()]).optional(),
    reviewItemResults: z.union([z.array(reviewItemResultSchema), z.string()]).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reportId: z.string().uuid(),
    issueCount: z.number().int().nonnegative(),
    reviewItemResultCount: z.number().int().nonnegative(),
    message: z.string(),
  }),
  execute: async ({
    reportId,
    score,
    recommendation,
    issues: issuesInput,
    reviewItemResults: reviewResultsInput,
  }) => {
    const parsedIssues = parseFlexibleArray(issuesInput, issueSchema);
    const parsedReviewResults = parseFlexibleArray(reviewResultsInput, reviewItemResultSchema);

    try {
      const report = await db.query.reviewReports.findFirst({
        where: eq(reviewReports.id, reportId),
        columns: { id: true, documentId: true, projectId: true },
      });
      if (!report) throw new Error("报告不存在");

      const projectId = report.projectId;

      // 解析审查项ID
      const reviewItemIdMapping = await resolveReviewItemIds(
        projectId,
        parsedReviewResults.map((r) => r.reviewItemId),
      );

      // 过滤有效的 block IDs
      const requestedBlockIds = new Set<string>();
      for (const issue of parsedIssues) {
        if (issue.blockId) requestedBlockIds.add(issue.blockId);
      }
      for (const result of parsedReviewResults) {
        (result.evidenceBlockIds ?? []).forEach((id) => requestedBlockIds.add(id));
      }
      const validBlockIds = await filterExistingBlockIds([...requestedBlockIds]);

      // 清理旧数据
      await db.delete(reviewIssues).where(eq(reviewIssues.reportId, reportId));
      await db.delete(reviewItemResults).where(eq(reviewItemResults.reportId, reportId));

      // 保存问题
      if (parsedIssues.length > 0) {
        await db.insert(reviewIssues).values(
          parsedIssues.map((issue) => ({
            reportId,
            blockId: issue.blockId && validBlockIds.has(issue.blockId) ? issue.blockId : null,
            checkpointId: issue.checkpointId || null,
            agentSource: issue.agentSource || "tender-review-agent",
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

      // 保存审查项结果
      const validReviewResults = parsedReviewResults.filter((result) =>
        reviewItemIdMapping.has(result.reviewItemId),
      );

      if (validReviewResults.length > 0) {
        await db.insert(reviewItemResults).values(
          validReviewResults.map((result) => ({
            reportId,
            reviewItemId: reviewItemIdMapping.get(result.reviewItemId)!,
            status: result.status,
            reason: result.reason,
            evidenceBlockIds: (result.evidenceBlockIds ?? []).filter((id) => validBlockIds.has(id)),
            confidence: result.confidence != null ? String(result.confidence) : null,
            metadata: result.metadata || {},
          })),
        );
      }

      // 统计摘要并更新报告（不含summary）
      const reviewItemsSummary = {
        total: validReviewResults.length,
        pass: validReviewResults.filter((item) => item.status === "pass").length,
        fail: validReviewResults.filter((item) => item.status === "fail").length,
        needsManualReview: validReviewResults.filter((item) => item.status === "needs_manual_review").length,
      };

      await db
        .update(reviewReports)
        .set({
          aiScore: String(score),
          recommendation,
          aiAnalysis: {
            reviewItemsSummary,
          },
          updatedAt: new Date(),
        })
        .where(eq(reviewReports.id, reportId));

      return {
        success: true,
        reportId,
        issueCount: parsedIssues.length,
        reviewItemResultCount: validReviewResults.length,
        message: `审查结果已保存：${parsedIssues.length}个问题，${validReviewResults.length}个审查项结果。评分：${score}，建议：${recommendation}`,
      };
    } catch (error) {
      return {
        success: false,
        reportId,
        issueCount: 0,
        reviewItemResultCount: 0,
        message: error instanceof Error ? error.message : "保存失败",
      };
    }
  },
});