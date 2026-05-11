// 嵌入向量生成与页面合并工具
import { db } from "@/lib/db/client";
import { documentPageEmbeddings, documentParsedResults } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface EmbeddingConfig {
  model?: string;
  dimensions?: number;
}

const DEFAULT_CONFIG: EmbeddingConfig = {
  model: "text-embedding-3-small",
  dimensions: 1536,
};

/**
 * 调用 OpenAI 兼容的 embeddings API 生成向量
 */
export async function generateEmbeddings(
  texts: string[],
  config: EmbeddingConfig = {}
): Promise<number[][]> {
  const { model, dimensions } = { ...DEFAULT_CONFIG, ...config };
  const apiBase = process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await fetch(`${apiBase}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts, dimensions }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Embedding API error: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((item: any) => item.embedding);
}

/**
 * 按页合并 blocks 文本
 */
export function mergeBlocksByPage(
  blocks: { id: string; pageNumber: number; blockIndex: number; content: string | null; blockType: string | null }[]
): Map<number, { text: string; blockIds: string[] }> {
  const pages = new Map<number, { textParts: string[]; blockIds: string[] }>();

  for (const block of blocks) {
    if (!pages.has(block.pageNumber)) {
      pages.set(block.pageNumber, { textParts: [], blockIds: [] });
    }
    const page = pages.get(block.pageNumber)!;
    if (block.content?.trim()) {
      page.textParts.push(`[${block.blockType || "text"} #${block.blockIndex}] ${block.content}`);
    }
    page.blockIds.push(block.id);
  }

  const result = new Map<number, { text: string; blockIds: string[] }>();
  for (const [pageNum, data] of pages) {
    result.set(pageNum, {
      text: data.textParts.join("\n\n"),
      blockIds: data.blockIds,
    });
  }
  return result;
}

/**
 * 计算两个向量的余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * 为文档生成并存储页面级嵌入
 */
export async function generatePageEmbeddings(documentId: string): Promise<number> {
  // 获取解析结果和blocks
  const parsedResult = await db.query.documentParsedResults.findFirst({
    where: eq(documentParsedResults.documentId, documentId),
    with: { blocks: true },
  });

  if (!parsedResult || parsedResult.blocks.length === 0) {
    console.log(`[Embedding] No blocks found for document ${documentId}`);
    return 0;
  }

  // 合并blocks按页
  const pages = mergeBlocksByPage(parsedResult.blocks);
  console.log(`[Embedding] Document ${documentId}: ${pages.size} pages to embed`);

  // 生成嵌入
  const pageEntries = Array.from(pages.entries());
  const texts = pageEntries.map(([, data]) => data.text);
  const embeddings = await generateEmbeddings(texts);

  // 存储
  let count = 0;
  for (let i = 0; i < pageEntries.length; i++) {
    const [pageNumber, data] = pageEntries[i];
    // 检查是否已存在，存在则跳过
    const existing = await db.query.documentPageEmbeddings.findFirst({
      where: (fields, { and }) =>
        and(
          eq(fields.documentId, documentId),
          eq(fields.pageNumber, pageNumber)
        ),
    });
    if (existing) continue;

    await db.insert(documentPageEmbeddings).values({
      documentId,
      parsedResultId: parsedResult.id,
      pageNumber,
      pageText: data.text,
      blockIds: data.blockIds,
      embedding: embeddings[i] as any,
    });
    count++;
  }

  console.log(`[Embedding] Stored ${count} new page embeddings for document ${documentId}`);
  return count;
}
