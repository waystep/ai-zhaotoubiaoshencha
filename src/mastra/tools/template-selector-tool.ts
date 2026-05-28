// 模板选择工具 — 从企业模板知识库中语义搜索匹配的投标文件模板
//
// 职责：
// 1. 根据行业、模板类型和招标要求搜索 bid_template 类型知识库
// 2. 使用语义搜索找到最佳匹配模板
// 3. 返回模板内容和大纲结构

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeBases, knowledgeItems } from "@/lib/db/schema";
import { embeddingService } from "@/lib/services/embedding-service";

export const templateSelectorTool = createTool({
  id: "template-selector",
  description:
    "从企业模板知识库中选择与招标要求最匹配的投标文件模板。输入行业、模板类型和招标要求，返回最佳匹配模板及其大纲结构。",
  inputSchema: z.object({
    organizationId: z.string().uuid().describe("组织ID，用于定位企业模板知识库"),
    industry: z.string().optional().describe("行业类型（如：建筑工程、市政工程等）"),
    templateType: z.string().optional().describe("模板类型（如：施工标、监理标、设计标等）"),
    tenderRequirements: z.string().describe("招标要求的摘要文本，用于语义匹配"),
    topK: z.number().int().min(1).max(10).default(3).describe("返回候选模板数量"),
  }),
  outputSchema: z.object({
    templates: z.array(
      z.object({
        id: z.string(),
        title: z.string().nullable(),
        content: z.string(),
        source: z.string().nullable(),
        metadata: z.any().nullable(),
        score: z.number(),
      })
    ),
    knowledgeBaseId: z.string().nullable(),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ organizationId, industry, templateType, tenderRequirements, topK }) => {
    try {
      // 1. 查找组织下的 bid_template 类型知识库
      const conditions = [
        eq(knowledgeBases.organizationId, organizationId),
        eq(knowledgeBases.type, "bid_template"),
        eq(knowledgeBases.isActive, true),
      ];

      const templateKBs = await db
        .select()
        .from(knowledgeBases)
        .where(and(...conditions));

      if (templateKBs.length === 0) {
        return {
          templates: [],
          knowledgeBaseId: null,
          success: false,
          message: "未找到企业投标模板知识库，请先创建 bid_template 类型的知识库",
        };
      }

      // 2. 构建语义搜索查询
      const searchQuery = [
        templateType ? `${templateType}投标文件模板` : "投标文件模板",
        industry ? `${industry}行业` : "",
        tenderRequirements,
      ]
        .filter(Boolean)
        .join(" ");

      // 3. 在所有匹配的知识库中搜索（取第一个活跃的知识库）
      const kbId = templateKBs[0].id;
      const searchResults = await embeddingService.search(kbId, searchQuery, topK);

      // 4. 补充搜索：如果有更多知识库，也在其中搜索
      let allResults = [...searchResults];
      for (let i = 1; i < templateKBs.length; i++) {
        const extraResults = await embeddingService.search(
          templateKBs[i].id,
          searchQuery,
          Math.max(1, Math.floor((topK ?? 3) / 2))
        );
        allResults = [...allResults, ...extraResults];
      }

      // 5. 按分数排序，取 topK
      allResults.sort((a, b) => b.score - a.score);
      allResults = allResults.slice(0, topK);

      // 6. 获取每个结果的完整条目信息（含 metadata）
      const templates = await Promise.all(
        allResults.map(async (result) => {
          const [item] = await db
            .select({
              id: knowledgeItems.id,
              title: knowledgeItems.title,
              content: knowledgeItems.content,
              source: knowledgeItems.source,
              metadata: knowledgeItems.metadata,
            })
            .from(knowledgeItems)
            .where(eq(knowledgeItems.id, result.itemId))
            .limit(1);

          return {
            id: result.itemId,
            title: item?.title ?? null,
            content: result.content,
            source: item?.source ?? null,
            metadata: item?.metadata ?? null,
            score: result.score,
          };
        })
      );

      return {
        templates,
        knowledgeBaseId: kbId,
        success: true,
        message: templates.length > 0
          ? `找到 ${templates.length} 个匹配模板`
          : "未找到匹配的投标模板",
      };
    } catch (error) {
      console.error("[TemplateSelector] 模板搜索失败:", error);
      return {
        templates: [],
        knowledgeBaseId: null,
        success: false,
        message: `模板搜索失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
});
