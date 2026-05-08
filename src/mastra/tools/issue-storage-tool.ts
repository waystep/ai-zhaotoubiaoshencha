// 问题存储工具 - 将审查发现的问题存储到数据库
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { reviewIssues } from "@/lib/db/schema";

export const issueStorageTool = createTool({
  id: "issue-storage",
  description: "将审查发现的问题存储到数据库reviewIssues表",
  inputSchema: z.object({
    reportId: z.string().uuid().describe("审查报告ID"),
    issues: z
      .array(
        z.object({
          blockId: z.string().uuid().optional().describe("问题所在区块ID"),
          checkpointId: z.string().optional().describe("相关检查点ID"),
          category: z.string().describe("问题类别"),
          severity: z.enum(["critical", "major", "minor", "suggestion"]).describe("问题严重程度"),
          title: z.string().describe("问题标题"),
          description: z.string().describe("问题描述"),
          location: z
            .object({
              pageNumber: z.number().int().positive().describe("页码"),
              blockIndex: z.number().int().nonnegative().describe("区块索引"),
              bbox: z
                .object({
                  x0: z.number(),
                  y0: z.number(),
                  x1: z.number(),
                  y1: z.number(),
                })
                .optional()
                .describe("问题区域坐标"),
              textSnippet: z.string().optional().describe("问题文本片段"),
              highlightText: z.string().optional().describe("高亮文本"),
            })
            .describe("问题位置"),
          suggestion: z.string().describe("整改建议"),
          agentSource: z.string().optional().describe("发现问题的智能体来源"),
        })
      )
      .describe("问题列表"),
  }),
  outputSchema: z.object({
    storedIssueIds: z.array(z.string().uuid()).describe("已存储的问题ID列表"),
    totalStored: z.number().int().nonnegative().describe("已存储问题总数"),
    success: z.boolean().describe("存储是否成功"),
    message: z.string().optional().describe("存储结果消息"),
  }),
  execute: async ({ reportId, issues }) => {
    try {
      const storedIds: string[] = [];

      // 批量插入问题
      for (const issue of issues) {
        const [stored] = await db
          .insert(reviewIssues)
          .values({
            reportId,
            blockId: issue.blockId || null,
            category: issue.category,
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            location: {
              pageNumber: issue.location.pageNumber,
              blockIndex: issue.location.blockIndex,
              bbox: issue.location.bbox,
              textSnippet: issue.location.textSnippet,
              highlightText: issue.location.highlightText,
            },
            suggestion: issue.suggestion,
            isResolved: false,
            checkpointId: issue.checkpointId || null,
            agentSource: issue.agentSource || null,
          })
          .returning();

        storedIds.push(stored.id);
      }

      return {
        storedIssueIds: storedIds,
        totalStored: storedIds.length,
        success: true,
        message: `成功存储 ${storedIds.length} 个审查问题`,
      };
    } catch (error) {
      console.error("问题存储失败:", error);
      return {
        storedIssueIds: [],
        totalStored: 0,
        success: false,
        message: `问题存储失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
});