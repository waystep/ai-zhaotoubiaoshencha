// 投标文档存储工具 — 将生成的投标文档写入 bidDocuments 表
//
// 职责：
// 1. 接收项目ID、章节内容和元数据
// 2. 写入 bidDocuments 表
// 3. 返回文档 ID

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { bidDocuments } from "@/lib/db/schema";

// 章节结构定义
const sectionSchema = z.object({
  sectionNo: z.string().describe("章节编号"),
  title: z.string().describe("章节标题"),
  content: z.string().describe("章节内容"),
  parentId: z.string().nullable().optional().describe("父章节编号"),
  linkedReviewItems: z.array(z.string()).default([]).describe("关联审查项ID"),
  linkedResponseItems: z.array(z.string()).default([]).describe("关联响应项ID"),
  scoringInfo: z
    .object({
      score: z.number().optional(),
      weight: z.number().optional(),
    })
    .nullable()
    .optional()
    .describe("评分信息"),
  status: z.enum(["generated", "edited", "empty"]).default("generated").describe("章节状态"),
});

export const bidDocumentStorageTool = createTool({
  id: "bid-document-storage",
  description:
    "存储投标文档到数据库。输入项目ID、章节内容数组和元数据，返回文档ID。支持存储生成文档和上传解析文档。",
  inputSchema: z.object({
    projectId: z.string().uuid().describe("项目ID"),
    title: z.string().describe("文档标题"),
    source: z.enum(["generated", "uploaded"]).default("generated").describe("文档来源：generated=生成的，uploaded=上传解析的"),
    documentFileId: z.string().uuid().optional().describe("关联的上传文档ID（source=uploaded时传入）"),
    sections: z.array(sectionSchema).describe("章节内容数组"),
    metadata: z
      .object({
        industry: z.string().optional(),
        templateType: z.string().optional(),
        templateId: z.string().optional(),
        generatedBy: z.string().optional(),
        totalReviewItems: z.number().optional(),
        totalResponseItems: z.number().optional(),
      })
      .nullable()
      .optional()
      .describe("文档元数据"),
    createdById: z.string().uuid().optional().describe("创建人ID"),
  }),
  outputSchema: z.object({
    documentId: z.string().uuid(),
    totalSections: z.number(),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ projectId, title, source, documentFileId, sections, metadata, createdById }) => {
    try {
      if (!sections || sections.length === 0) {
        return {
          documentId: "",
          totalSections: 0,
          success: false,
          message: "章节内容为空，无法创建投标文档",
        };
      }

      // 构建完整的 sections JSON（含 id）
      const sectionsWithIds = sections.map((section) => ({
        id: crypto.randomUUID(),
        sectionNo: section.sectionNo,
        title: section.title,
        content: section.content,
        parentId: section.parentId ?? null,
        linkedReviewItems: section.linkedReviewItems ?? [],
        linkedResponseItems: section.linkedResponseItems ?? [],
        scoringInfo: section.scoringInfo ?? null,
        status: section.status ?? "generated",
      }));

      // 写入 bidDocuments 表
      const [doc] = await db
        .insert(bidDocuments)
        .values({
          projectId,
          title,
          source: source ?? "generated",
          documentFileId: documentFileId ?? null,
          sections: sectionsWithIds,
          metadata: metadata ?? {},
          version: 1,
          status: "draft",
          createdById: createdById ?? null,
        })
        .returning();

      return {
        documentId: doc.id,
        totalSections: sectionsWithIds.length,
        success: true,
        message: `投标文档创建成功，共 ${sectionsWithIds.length} 个章节`,
      };
    } catch (error) {
      console.error("[BidDocumentStorage] 文档存储失败:", error);
      return {
        documentId: "",
        totalSections: 0,
        success: false,
        message: `文档存储失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
});
