// 报告查询工具 - 根据reportId查询报告详情
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { reviewReports } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type ReportStatus = "pending" | "in_progress" | "completed" | "failed";
type Recommendation = "pass" | "revise" | "fail";

export const getReportTool = createTool({
  id: "get-report",
  description: "查询审查报告详情，包括状态、评分、关联项目和文档信息。用于子智能体获取报告上下文。",
  inputSchema: z.object({
    reportId: z.string().uuid().describe("审查报告ID"),
  }),
  outputSchema: z.object({
    report: z.object({
      id: z.string().uuid(),
      projectId: z.string().uuid(),
      documentId: z.string().uuid(),
      status: z.enum(["pending", "in_progress", "completed", "failed"]),
      aiScore: z.number().optional(),
      recommendation: z.enum(["pass", "revise", "fail"]).optional(),
      summary: z.string().optional(),
      documentName: z.string(),
      projectName: z.string(),
      createdAt: z.string(),
      completedAt: z.string().optional(),
    }),
    summary: z.string(),
  }),
  execute: async ({ reportId }): Promise<{
    report: {
      id: string;
      projectId: string;
      documentId: string;
      status: ReportStatus;
      aiScore?: number;
      recommendation?: Recommendation;
      summary?: string;
      documentName: string;
      projectName: string;
      createdAt: string;
      completedAt?: string;
    };
    summary: string;
  }> => {
    try {
      const report = await db.query.reviewReports.findFirst({
        where: eq(reviewReports.id, reportId),
        with: {
          document: { columns: { id: true, name: true } },
          project: { columns: { id: true, name: true } },
        },
      });

      if (!report) {
        return {
          report: {
            id: reportId,
            projectId: "",
            documentId: "",
            status: "pending" as ReportStatus,
            documentName: "",
            projectName: "",
            createdAt: new Date().toISOString(),
          },
          summary: `报告 ${reportId} 不存在`,
        };
      }

      return {
        report: {
          id: report.id,
          projectId: report.projectId,
          documentId: report.documentId,
          status: report.status as ReportStatus,
          aiScore: report.aiScore ? Number(report.aiScore) : undefined,
          recommendation: report.recommendation as Recommendation | undefined,
          summary: report.summary || "",
          documentName: report.document?.name || "",
          projectName: report.project?.name || "",
          createdAt: report.createdAt?.toISOString() || new Date().toISOString(),
          completedAt: report.completedAt?.toISOString(),
        },
        summary: `报告 ${report.id.slice(0, 8)}: 状态=${report.status}, 文档=${report.document?.name}, 项目=${report.project?.name}`,
      };
    } catch (error) {
      console.error("报告查询失败:", error);
      return {
        report: {
          id: reportId,
          projectId: "",
          documentId: "",
          status: "failed" as ReportStatus,
          documentName: "",
          projectName: "",
          createdAt: new Date().toISOString(),
        },
        summary: `报告查询失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
});