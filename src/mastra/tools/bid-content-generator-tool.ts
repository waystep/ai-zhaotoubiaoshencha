// 投标文件内容生成工具 — 为每个章节生成 v1.0 内容
//
// 职责：
// 1. 接收大纲、章节索引和知识库内容
// 2. 根据章节关联的审查项和响应项生成初稿内容
// 3. 引用招标要求和法规验证结果

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reviewItems, responseItems } from "@/lib/db/schema";

export const bidContentGeneratorTool = createTool({
  id: "bid-content-generator",
  description:
    "根据投标文件大纲的指定章节，生成 v1.0 初稿内容。会查询关联的审查项和响应项要求，结合知识库参考内容生成符合招标要求的章节文本。",
  inputSchema: z.object({
    projectId: z.string().uuid().describe("项目ID"),
    sectionNo: z.string().describe("章节编号（如 1, 4.2, 6.3 等）"),
    sectionTitle: z.string().describe("章节标题"),
    sectionDescription: z.string().describe("章节内容描述"),
    linkedReviewItemIds: z.array(z.string()).describe("关联的审查项ID列表"),
    linkedResponseItemIds: z.array(z.string()).describe("关联的响应项ID列表"),
    templateContent: z.string().optional().describe("模板参考内容（如有）"),
    knowledgeBaseContent: z.string().optional().describe("知识库检索的相关内容"),
  }),
  outputSchema: z.object({
    sectionNo: z.string(),
    title: z.string(),
    content: z.string(),
    linkedReviewItems: z.array(z.string()),
    linkedResponseItems: z.array(z.string()),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({
    projectId,
    sectionNo,
    sectionTitle,
    sectionDescription,
    linkedReviewItemIds,
    linkedResponseItemIds,
    templateContent,
    knowledgeBaseContent,
  }) => {
    try {
      // 1. 查询关联的审查项详情
      const reviewItemDetails: Array<{
        id: string;
        title: string;
        description: string;
        itemType: string;
        requirements: unknown;
        consequence: string | null;
        legalReference: string | null;
      }> = [];

      for (const itemId of linkedReviewItemIds) {
        const [item] = await db
          .select({
            id: reviewItems.id,
            title: reviewItems.title,
            description: reviewItems.description,
            itemType: reviewItems.itemType,
            requirements: reviewItems.requirements,
            consequence: reviewItems.consequence,
            legalReference: reviewItems.legalReference,
          })
          .from(reviewItems)
          .where(eq(reviewItems.id, itemId))
          .limit(1);
        if (item) reviewItemDetails.push(item);
      }

      // 2. 查询关联的响应项详情
      const responseItemDetails: Array<{
        id: string;
        title: string;
        description: string;
        responseType: string;
        responseRequirements: unknown;
        scoringInfo: unknown;
      }> = [];

      for (const itemId of linkedResponseItemIds) {
        const [item] = await db
          .select({
            id: responseItems.id,
            title: responseItems.title,
            description: responseItems.description,
            responseType: responseItems.responseType,
            responseRequirements: responseItems.responseRequirements,
            scoringInfo: responseItems.scoringInfo,
          })
          .from(responseItems)
          .where(eq(responseItems.id, itemId))
          .limit(1);
        if (item) responseItemDetails.push(item);
      }

      // 3. 构建内容生成上下文
      const reviewContext = reviewItemDetails.length > 0
        ? reviewItemDetails
            .map(
              (item) =>
                `【审查项】${item.title}\n类型: ${item.itemType}\n要求: ${item.description}\n${
                  item.legalReference ? `法律依据: ${item.legalReference}\n` : ""
                }${
                  item.consequence ? `不满足后果: ${item.consequence}\n` : ""
                }`
            )
            .join("\n")
        : "无关联审查项";

      const responseContext = responseItemDetails.length > 0
        ? responseItemDetails
            .map(
              (item) =>
                `【响应项】${item.title}\n类型: ${item.responseType}\n要求: ${item.description}`
            )
            .join("\n")
        : "无关联响应项";

      // 4. 生成章节内容
      // 注意：实际内容由 Agent 的 LLM 生成，这里提供的是结构化数据和上下文
      // 工具返回的是审查项和响应项的详细信息，Agent 会根据这些信息指导内容生成
      const content = buildSectionContent(
        sectionNo,
        sectionTitle,
        sectionDescription,
        reviewItemDetails,
        responseItemDetails,
        templateContent,
        knowledgeBaseContent
      );

      return {
        sectionNo,
        title: sectionTitle,
        content,
        linkedReviewItems: linkedReviewItemIds,
        linkedResponseItems: linkedResponseItemIds,
        success: true,
        message: `章节 ${sectionNo} ${sectionTitle} 内容生成成功`,
      };
    } catch (error) {
      console.error("[BidContentGenerator] 内容生成失败:", error);
      return {
        sectionNo,
        title: sectionTitle,
        content: "",
        linkedReviewItems: linkedReviewItemIds,
        linkedResponseItems: linkedResponseItemIds,
        success: false,
        message: `内容生成失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
});

// ---------------------------------------------------------------------------
// Helper: 构建章节内容框架
// ---------------------------------------------------------------------------

function buildSectionContent(
  sectionNo: string,
  sectionTitle: string,
  sectionDescription: string,
  reviewItemDetails: Array<{
    id: string;
    title: string;
    description: string;
    itemType: string;
    requirements: unknown;
    consequence: string | null;
    legalReference: string | null;
  }>,
  responseItemDetails: Array<{
    id: string;
    title: string;
    description: string;
    responseType: string;
    responseRequirements: unknown;
    scoringInfo: unknown;
  }>,
  templateContent?: string,
  knowledgeBaseContent?: string
): string {
  const parts: string[] = [];

  // 章节标题
  parts.push(`# ${sectionNo} ${sectionTitle}`);
  parts.push("");

  // 章节概述
  parts.push(sectionDescription);
  parts.push("");

  // 如果有模板参考内容，包含模板结构
  if (templateContent) {
    parts.push("## 参考模板结构");
    parts.push(templateContent.substring(0, 2000));
    parts.push("");
  }

  // 如果有知识库内容，包含参考材料
  if (knowledgeBaseContent) {
    parts.push("## 参考资料要点");
    parts.push(knowledgeBaseContent.substring(0, 2000));
    parts.push("");
  }

  // 列出需要响应的审查项
  if (reviewItemDetails.length > 0) {
    parts.push("## 需要响应的审查要求");
    parts.push("");
    for (const item of reviewItemDetails) {
      parts.push(`### ${item.title}（${item.itemType}）`);
      parts.push(item.description);
      if (item.legalReference) {
        parts.push(`> 法律依据：${item.legalReference}`);
      }
      if (item.consequence) {
        parts.push(`> 不满足后果：${item.consequence}`);
      }
      parts.push("");
    }
  }

  // 列出需要响应的响应项
  if (responseItemDetails.length > 0) {
    parts.push("## 需要响应的具体要求");
    parts.push("");
    for (const item of responseItemDetails) {
      parts.push(`### ${item.title}（${item.responseType}）`);
      parts.push(item.description);
      parts.push("");
    }
  }

  // 生成占位内容
  parts.push("---");
  parts.push(`> 以上为章节 ${sectionNo}「${sectionTitle}」的内容生成框架。`);
  parts.push(`> 请根据上述审查要求和响应要求，生成完整的投标文件章节内容。`);
  parts.push(`> 确保所有强制性审查项均得到明确响应。`);

  return parts.join("\n");
}
