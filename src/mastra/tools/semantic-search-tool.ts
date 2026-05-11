// 语义搜索工具 - 在文档页面嵌入中进行语义检索
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { documentPageEmbeddings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateEmbeddings, cosineSimilarity } from "@/lib/ai/embedding";

export const semanticSearchTool = createTool({
  id: "semantic-search",
  description: `语义搜索工具。根据查询文本在文档的页面级嵌入中查找最相关的内容。

使用场景：
- 替代全文遍历，快速定位包含特定要求/条款的页面
- 搜索特定主题（如"工期"、"资质"、"标准规范"）在文档中的位置
- 返回匹配页面的文本内容和关联的 block ID 列表

与 documentReaderTool 配合使用：
1. 先用本工具搜索，定位相关页面（返回 pageNumber + blockIds）
2. 再用 documentReaderTool(startPage=N, endPage=N) 读取具体 blocks
3. 从 blocks 中提取详细的条款信息`,

  inputSchema: z.object({
    documentId: z.string().uuid().describe("文档ID"),
    query: z.string().describe("语义搜索查询文本（如：'工期要求 日历天 竣工日期'）"),
    topK: z.number().int().min(1).max(20).default(5).describe("返回最相关的前K个结果"),
  }),

  outputSchema: z.object({
    results: z.array(
      z.object({
        pageNumber: z.number(),
        pageText: z.string(),
        blockIds: z.array(z.string()),
        similarity: z.number(),
      })
    ),
    query: z.string(),
    totalResults: z.number(),
  }),

  execute: async ({ documentId, query, topK }) => {
    try {
      // 1. 查询该文档的所有页面嵌入
      const pages = await db.query.documentPageEmbeddings.findMany({
        where: eq(documentPageEmbeddings.documentId, documentId),
      });

      if (pages.length === 0) {
        return {
          results: [],
          query,
          totalResults: 0,
        };
      }

      // 2. 生成查询向量
      const [queryEmbedding] = await generateEmbeddings([query]);

      // 3. 计算余弦相似度并排序
      const scored = pages
        .map((page) => ({
          pageNumber: page.pageNumber,
          pageText: page.pageText,
          blockIds: (page.blockIds as string[]) || [],
          similarity: cosineSimilarity(queryEmbedding, page.embedding as number[]),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .filter((r) => r.similarity > 0.3); // 只返回有意义的匹配

      return {
        results: scored,
        query,
        totalResults: scored.length,
      };
    } catch (error) {
      console.error("[SemanticSearch] 搜索失败:", error);
      return {
        results: [],
        query,
        totalResults: 0,
      };
    }
  },
});
