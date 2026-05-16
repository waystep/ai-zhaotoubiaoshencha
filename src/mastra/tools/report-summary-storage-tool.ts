import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reviewReports } from "@/lib/db/schema";

export const reportSummaryStorageTool = createTool({
  id: "report-summary-storage",
  description: "存储审查报告摘要。仅由报告生成智能体调用。将审查流程的最终分析总结写入报告的 summary 字段。",
  inputSchema: z.object({
    reportId: z.string().uuid(),
    summary: z.string().min(50).describe("审查报告摘要，至少50字，应包含审查结论、关键发现、建议等"),
    score: z.number().min(0).max(100).optional().describe("综合评分 0-100"),
    recommendation: z.enum(["pass", "fail", "revise"]).optional().describe("建议结论：通过/不通过/整改后通过"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reportId: z.string().uuid(),
    message: z.string(),
  }),
  execute: async ({ reportId, summary, score, recommendation }) => {
    try {
      const report = await db.query.reviewReports.findFirst({
        where: eq(reviewReports.id, reportId),
        columns: { id: true },
      });
      if (!report) {
        return {
          success: false,
          reportId,
          message: "报告不存在",
        };
      }

      const updateData: Record<string, unknown> = {
        summary,
        updatedAt: new Date(),
      };
      if (score !== undefined) updateData.aiScore = String(score);
      if (recommendation !== undefined) updateData.recommendation = recommendation;

      await db
        .update(reviewReports)
        .set(updateData)
        .where(eq(reviewReports.id, reportId));

      const parts = [`审查摘要已保存，共 ${summary.length} 字`];
      if (score !== undefined) parts.push(`评分：${score}`);
      if (recommendation !== undefined) parts.push(`建议结论：${recommendation}`);

      return {
        success: true,
        reportId,
        message: parts.join("，"),
      };
    } catch (error) {
      return {
        success: false,
        reportId,
        message: error instanceof Error ? error.message : "摘要保存失败",
      };
    }
  },
});