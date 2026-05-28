/**
 * Embedding Service — Document Chunking + Vectorization Pipeline
 *
 * Provides text chunking, embedding generation (Ollama local with cloud fallback),
 * item vectorization, and semantic vector search via pgvector cosine similarity.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  knowledgeItems,
  knowledgeItemChunks,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  itemId: string;
  chunkId: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface OllamaEmbedResponse {
  embedding: number[];
}

interface CloudEmbedResponse {
  data: Array<{ embedding: number[] }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const EMBEDDING_MODEL = "nomic-embed-text";

/** Approximate characters per token for Chinese / mixed content */
const CHARS_PER_TOKEN = 1.5;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class EmbeddingService {
  private chunkSize = 500; // max tokens per chunk
  private chunkOverlap = 50; // overlap tokens between chunks

  // -----------------------------------------------------------------------
  // Split text into overlapping chunks
  // -----------------------------------------------------------------------

  chunkText(text: string): string[] {
    if (!text || text.trim().length === 0) return [];

    const maxChars = Math.floor(this.chunkSize * CHARS_PER_TOKEN);
    const overlapChars = Math.floor(this.chunkOverlap * CHARS_PER_TOKEN);

    // First, split into paragraphs (double newline or single newline)
    const paragraphs = text
      .split(/\n{2,}|\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const chunks: string[] = [];
    let currentChunk = "";

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed the limit
      if (
        currentChunk.length > 0 &&
        currentChunk.length + paragraph.length + 1 > maxChars
      ) {
        chunks.push(currentChunk.trim());
        // Keep overlap from the end of the current chunk
        currentChunk = currentChunk.slice(-overlapChars);
      }

      // If a single paragraph exceeds maxChars, split it by sentences
      if (paragraph.length > maxChars) {
        // Flush current chunk first
        if (currentChunk.trim().length > overlapChars) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = "";

        const sentences = paragraph.split(
          /(?<=[。！？.!?\n])\s*/
        );
        let sentenceChunk = "";

        for (const sentence of sentences) {
          if (
            sentenceChunk.length > 0 &&
            sentenceChunk.length + sentence.length > maxChars
          ) {
            chunks.push(sentenceChunk.trim());
            sentenceChunk = sentenceChunk.slice(-overlapChars);
          }

          // If a single sentence is still too long, hard-split by character
          if (sentence.length > maxChars) {
            if (sentenceChunk.trim().length > 0) {
              chunks.push(sentenceChunk.trim());
              sentenceChunk = "";
            }
            for (let i = 0; i < sentence.length; i += maxChars) {
              chunks.push(sentence.slice(i, i + maxChars).trim());
            }
          } else {
            sentenceChunk += (sentenceChunk ? " " : "") + sentence;
          }
        }

        if (sentenceChunk.trim().length > 0) {
          currentChunk = sentenceChunk;
        }
      } else {
        currentChunk += (currentChunk ? "\n" : "") + paragraph;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter((c) => c.length > 0);
  }

  // -----------------------------------------------------------------------
  // Generate embedding for a single text (Ollama local first, cloud fallback)
  // -----------------------------------------------------------------------

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error("Cannot embed empty text");
    }

    // 1. Try local Ollama first
    try {
      const embedding = await this.embedViaOllama(text);
      if (embedding.length > 0) return embedding;
    } catch {
      // Local failed, fall through to cloud
    }

    // 2. Try cloud: GLM first, then DeepSeek
    try {
      const embedding = await this.embedViaGLM(text);
      if (embedding.length > 0) return embedding;
    } catch {
      // GLM failed, try DeepSeek
    }

    try {
      const embedding = await this.embedViaDeepSeek(text);
      if (embedding.length > 0) return embedding;
    } catch {
      // All providers failed
    }

    throw new Error(
      "All embedding providers failed (Ollama, GLM, DeepSeek). " +
        "Ensure at least one embedding service is configured."
    );
  }

  // -----------------------------------------------------------------------
  // Vectorize a knowledge item: chunk -> embed -> store
  // -----------------------------------------------------------------------

  async vectorizeItem(itemId: string): Promise<{ chunks: number }> {
    // 1. Read the knowledge item
    const [item] = await db
      .select({
        id: knowledgeItems.id,
        content: knowledgeItems.content,
      })
      .from(knowledgeItems)
      .where(eq(knowledgeItems.id, itemId))
      .limit(1);

    if (!item) {
      throw new Error(`Knowledge item not found: ${itemId}`);
    }

    // 2. Split into chunks
    const textChunks = this.chunkText(item.content);
    if (textChunks.length === 0) {
      throw new Error(`No content to vectorize for item: ${itemId}`);
    }

    // 3. Delete existing chunks for this item (re-vectorization support)
    await db
      .delete(knowledgeItemChunks)
      .where(eq(knowledgeItemChunks.itemId, itemId));

    // 4. Embed each chunk and collect results
    const chunkRows = await Promise.all(
      textChunks.map(async (content, index) => {
        const embedding = await this.embed(content);
        const tokenCount = Math.ceil(content.length / CHARS_PER_TOKEN);

        return {
          itemId,
          chunkIndex: index,
          content,
          embedding,
          tokenCount,
        };
      })
    );

    // 5. Insert all chunks
    await db.insert(knowledgeItemChunks).values(chunkRows);

    // 6. Update the knowledge item metadata
    await db
      .update(knowledgeItems)
      .set({
        isVectorized: true,
        chunkCount: chunkRows.length,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeItems.id, itemId));

    return { chunks: chunkRows.length };
  }

  // -----------------------------------------------------------------------
  // Semantic search within a knowledge base
  // -----------------------------------------------------------------------

  async search(
    knowledgeBaseId: string,
    query: string,
    topK: number = 5
  ): Promise<SearchResult[]> {
    // 1. Embed the query
    const queryEmbedding = await this.embed(query);

    // 2. Use raw SQL for cosine similarity search (pgvector <=> operator)
    //    Join chunks -> items -> filter by knowledgeBaseId
    const vectorAvailable = process.env.VECTOR_AVAILABLE === "true";

    let results: SearchResult[];

    if (vectorAvailable) {
      // Use pgvector cosine distance operator
      const embeddingStr = `[${queryEmbedding.join(",")}]`;
      results = await this.searchWithPgvector(
        knowledgeBaseId,
        embeddingStr,
        topK
      );
    } else {
      // Fallback: use jsonb storage with in-memory cosine similarity
      results = await this.searchWithJsonb(
        knowledgeBaseId,
        queryEmbedding,
        topK
      );
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Private: Ollama local embedding
  // -----------------------------------------------------------------------

  private async embedViaOllama(text: string): Promise<number[]> {
    const url = `${OLLAMA_BASE_URL}/api/embeddings`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama embedding failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as OllamaEmbedResponse;
    return data.embedding;
  }

  // -----------------------------------------------------------------------
  // Private: GLM cloud embedding
  // -----------------------------------------------------------------------

  private async embedViaGLM(text: string): Promise<number[]> {
    const apiKey = process.env.GLM_API_KEY;
    const baseUrl = process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4";

    if (!apiKey) {
      throw new Error("GLM_API_KEY not configured");
    }

    const url = `${baseUrl}/embeddings`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "embedding-3",
        input: [text],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(
        `GLM embedding failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as CloudEmbedResponse;
    return data.data[0].embedding;
  }

  // -----------------------------------------------------------------------
  // Private: DeepSeek cloud embedding
  // -----------------------------------------------------------------------

  private async embedViaDeepSeek(text: string): Promise<number[]> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1";

    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY not configured");
    }

    const url = `${baseUrl}/embeddings`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-embed",
        input: [text],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(
        `DeepSeek embedding failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as CloudEmbedResponse;
    return data.data[0].embedding;
  }

  // -----------------------------------------------------------------------
  // Private: pgvector similarity search using <=> cosine distance operator
  // -----------------------------------------------------------------------

  private async searchWithPgvector(
    knowledgeBaseId: string,
    embeddingStr: string,
    topK: number
  ): Promise<SearchResult[]> {
    // Use sql.raw() for pgvector operators — same pattern as semantic-search-tool.ts
    const safeKbId = knowledgeBaseId.replace(/'/g, "''");
    const safeEmbedding = embeddingStr.replace(/'/g, "''");
    const safeLimit = Math.max(1, Math.min(topK, 100));

    const query = sql.raw(`
      SELECT
        c.id    AS chunk_id,
        c.item_id,
        c.content,
        (c.embedding <=> '${safeEmbedding}'::vector) AS distance
      FROM knowledge_item_chunks c
      INNER JOIN knowledge_items i ON c.item_id = i.id
      WHERE i.knowledge_base_id = '${safeKbId}'
      ORDER BY c.embedding <=> '${safeEmbedding}'::vector
      LIMIT ${safeLimit}
    `);

    const results = await db.execute(query);

    return results.map((row: Record<string, unknown>) => ({
      itemId: row.item_id as string,
      chunkId: row.chunk_id as string,
      content: row.content as string,
      // cosine distance: 0 = identical, 2 = opposite; convert to similarity score
      score: 1 - Number(row.distance),
    }));
  }

  // -----------------------------------------------------------------------
  // Private: jsonb fallback similarity search (in-memory cosine similarity)
  // -----------------------------------------------------------------------

  private async searchWithJsonb(
    knowledgeBaseId: string,
    queryEmbedding: number[],
    topK: number
  ): Promise<SearchResult[]> {
    // Fetch all chunks for this knowledge base (jsonb mode requires in-memory scoring)
    const chunks = await db
      .select({
        chunkId: knowledgeItemChunks.id,
        itemId: knowledgeItemChunks.itemId,
        content: knowledgeItemChunks.content,
        embedding: knowledgeItemChunks.embedding,
      })
      .from(knowledgeItemChunks)
      .innerJoin(
        knowledgeItems,
        eq(knowledgeItemChunks.itemId, knowledgeItems.id)
      )
      .where(eq(knowledgeItems.knowledgeBaseId, knowledgeBaseId));

    // Compute cosine similarity for each chunk
    const scored = chunks
      .map((chunk) => {
        const embedding = chunk.embedding ?? [];
        const score = cosineSimilarity(queryEmbedding, embedding);
        return {
          itemId: chunk.itemId,
          chunkId: chunk.chunkId,
          content: chunk.content,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }
}

// ---------------------------------------------------------------------------
// Utility: Cosine similarity between two vectors
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const embeddingService = new EmbeddingService();
