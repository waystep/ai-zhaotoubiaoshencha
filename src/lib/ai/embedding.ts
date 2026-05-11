// 嵌入向量生成与页面合并工具
// 使用本地 LM Studio 作为 embedding 服务
import { db } from "@/lib/db/client";
import { documentPageEmbeddings, documentParsedResults } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const EMBEDDING_API = (process.env.EMBEDDING_API_URL || "http://192.168.2.81:1234/v1") + "/embeddings";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-nomic-embed-text-v1.5";
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || "lm-studio";

/**
 * 调用 LM Studio 兼容的 embeddings API 生成向量
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch(EMBEDDING_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding API error: ${response.status} ${errText}`);
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
  blocks: {
    id: string;
    pageNumber: number;
    blockIndex: number;
    content: string | null;
    blockType: string | null;
  }[]
): Map<number, { text: string; blockIds: string[] }> {
  const pages = new Map<number, { textParts: string[]; blockIds: string[] }>();

  for (const block of blocks) {
    if (!pages.has(block.pageNumber)) {
      pages.set(block.pageNumber, { textParts: [], blockIds: [] });
    }
    const page = pages.get(block.pageNumber)!;
    if (block.content?.trim()) {
      page.textParts.push(
        `[${block.blockType || "text"} #${block.blockIndex}] ${block.content}`
      );
    }
    page.blockIds.push(block.id);
  }

  const result = new Map<number, { text: string; blockIds: string[] }>();
  for (const [pageNum, data] of pages) {
    result.set(pageNum, { text: data.textParts.join("\n\n"), blockIds: data.blockIds });
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
 * 为文档生成并存储页面级嵌入向量
 */
export async function generatePageEmbeddings(documentId: string): Promise<number> {
  const parsedResult = await db.query.documentParsedResults.findFirst({
    where: eq(documentParsedResults.documentId, documentId),
    with: { blocks: true },
  });

  if (!parsedResult || parsedResult.blocks.length === 0) {
    console.log(`[Embedding] Document ${documentId}: no blocks found`);
    return 0;
  }

  const pages = mergeBlocksByPage(parsedResult.blocks);
  console.log(`[Embedding] Document ${documentId}: ${pages.size} pages to embed via ${EMBEDDING_MODEL}`);

  const pageEntries = Array.from(pages.entries());
  const texts = pageEntries.map(([, data]) => data.text);
  const embeddings = await generateEmbeddings(texts);

  let count = 0;
  for (let i = 0; i < pageEntries.length; i++) {
    const [pageNumber, data] = pageEntries[i];
    const existing = await db.query.documentPageEmbeddings.findFirst({
      where: and(
        eq(documentPageEmbeddings.documentId, documentId),
        eq(documentPageEmbeddings.pageNumber, pageNumber)
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
      embeddingModel: EMBEDDING_MODEL,
    });
    count++;
  }

  console.log(`[Embedding] Stored ${count} new page embeddings for document ${documentId}`);
  return count;
}
