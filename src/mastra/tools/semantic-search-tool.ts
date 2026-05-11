// 语义搜索工具 — 在文档页面嵌入中进行语义检索
// 支持 pgvector (<=> operator) 和 JS cosine similarity 两种模式
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { documentPageEmbeddings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateEmbeddings, cosineSimilarity } from "@/lib/ai/embedding";

const USE_PGVECTOR = process.env.VECTOR_AVAILABLE === "true";

export const semanticSearchTool = createTool({
  id: "semantic-search",
  description: `语义搜索工具。根据查询文本在文档的页面级嵌入中查找最相关的内容。

使用场景：
- 替代全文遍历，快速定位包含特定要求/条款的页面
- 搜索特定主题（如"工期"、"资质"、"标准规范"）在文档中的位置
- 返回匹配页面的文本内容和关联的 block ID 列表

与 documentReaderTool 配合：
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
      const pages = await db.query.documentPageEmbeddings.findMany({
        where: eq(documentPageEmbeddings.documentId, documentId),
      });

      if (pages.length === 0) {
        return { results: [], query, totalResults: 0 };
      }

      const embeddings = await generateEmbeddings([query]);
      const queryEmbedding = embeddings[0]!;
      if (!queryEmbedding || queryEmbedding.length === 0) {
        return { results: [], query, totalResults: 0 };
      }

      let scored: { pageNumber: number; pageText: string; blockIds: string[]; similarity: number }[];

      if (USE_PGVECTOR) {
        scored = await pgvectorSearch(documentId, queryEmbedding as number[], topK);
      } else {
        // JS 降级模式：内存中计算余弦相似度
        scored = pages
          .map((page) => ({
            pageNumber: page.pageNumber,
            pageText: page.pageText,
            blockIds: (page.blockIds as string[]) || [],
            similarity: cosineSimilarity(queryEmbedding, page.embedding as number[]),
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, topK)
          .filter((r) => r.similarity > 0.3);
      }

      return { results: scored, query, totalResults: scored.length };
    } catch (error) {
      console.error("[SemanticSearch] 搜索失败:", error);
      return { results: [], query, totalResults: 0 };
    }
  },
});

/**
 * pgvector 模式搜索（需要 VECTOR_AVAILABLE=true 且 pgvector 扩展已安装）
 */
async function pgvectorSearch(
  documentId: string,
  queryEmbedding: number[],
  topK: number = 5
): Promise<{ pageNumber: number; pageText: string; blockIds: string[]; similarity: number }[]> {
  const queryVec = JSON.stringify(queryEmbedding);
  // pgvector <=> 是余弦距离，1 - 距离 = 余弦相似度
  const rows = await db.execute(
    `SELECT page_number, page_text, block_ids,
            1 - (embedding <=> '${queryVec}'::vector) AS similarity
     FROM document_page_embeddings
     WHERE document_id = '${documentId}'
       AND embedding IS NOT NULL
     ORDER BY embedding <=> '${queryVec}'::vector
     LIMIT ${topK}`
  );

  return (rows as any[]).map((row: any) => ({
    pageNumber: row.page_number,
    pageText: row.page_text,
    blockIds: row.block_ids || [],
    similarity: row.similarity,
  }));
}
