/**
 * Knowledge Retriever
 *
 * Resolves the knowledge bases linked to an agent and performs
 * RAG (Retrieval-Augmented Generation) semantic searches against them.
 *
 * Resolution path:
 *   1. Read agentDefinitions.defaultConfig.knowledgeBaseIds (string[]).
 *   2. Fetch the corresponding knowledgeBases rows.
 *   3. Delegate semantic search to EmbeddingService.
 */

import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  agentDefinitions,
  knowledgeBases,
} from "@/lib/db/schema";
import { embeddingService } from "@/lib/services/embedding-service";
import type { InferSelectModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KnowledgeBase = InferSelectModel<typeof knowledgeBases>;

export interface KnowledgeSearchResult {
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  results: Array<{
    itemId: string;
    chunkId: string;
    content: string;
    score: number;
  }>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class KnowledgeRetriever {
  /**
   * Resolve all knowledge bases linked to an agent.
   *
   * Reads agentDefinitions.defaultConfig.knowledgeBaseIds and joins
   * the knowledgeBases table to get full KB metadata.
   */
  async resolveKnowledgeBases(
    agentKey: string,
    orgId?: string,
  ): Promise<KnowledgeBase[]> {
    const agent = await this.findAgent(agentKey, orgId);
    if (!agent) return [];

    const defaultConfig = agent.defaultConfig as Record<string, unknown> ?? {};
    const kbIds = defaultConfig.knowledgeBaseIds as string[] | undefined;

    if (!kbIds || kbIds.length === 0) return [];

    const bases = await db
      .select()
      .from(knowledgeBases)
      .where(
        and(
          inArray(knowledgeBases.id, kbIds),
          eq(knowledgeBases.isActive, true),
        ),
      );

    return bases;
  }

  /**
   * Perform a RAG search across all knowledge bases linked to an agent.
   *
   * Returns results grouped by knowledge base.
   */
  async search(
    agentKey: string,
    query: string,
    topK: number = 5,
    orgId?: string,
  ): Promise<KnowledgeSearchResult[]> {
    const bases = await this.resolveKnowledgeBases(agentKey, orgId);

    if (bases.length === 0) return [];

    const results: KnowledgeSearchResult[] = [];

    for (const base of bases) {
      try {
        const searchResults = await embeddingService.search(
          base.id,
          query,
          topK,
        );

        results.push({
          knowledgeBaseId: base.id,
          knowledgeBaseName: base.name,
          results: searchResults.map((r) => ({
            itemId: r.itemId,
            chunkId: r.chunkId,
            content: r.content,
            score: r.score,
          })),
        });
      } catch (err) {
        // If one KB fails, continue with the rest
        console.error(
          `[KnowledgeRetriever] search failed for KB ${base.id}:`,
          err,
        );
        results.push({
          knowledgeBaseId: base.id,
          knowledgeBaseName: base.name,
          results: [],
        });
      }
    }

    return results;
  }

  /**
   * Convenience: return all matching chunks flat (not grouped by KB).
   * Useful when you just want the top-K results across all linked KBs.
   */
  async searchFlat(
    agentKey: string,
    query: string,
    topK: number = 5,
    orgId?: string,
  ): Promise<Array<{ itemId: string; chunkId: string; content: string; score: number }>> {
    const grouped = await this.search(agentKey, query, topK, orgId);

    return grouped
      .flatMap((g) => g.results)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private async findAgent(agentKey: string, orgId?: string) {
    const conditions = [eq(agentDefinitions.agentKey, agentKey)];
    if (orgId) {
      conditions.push(eq(agentDefinitions.organizationId, orgId));
    }

    const [agent] = await db
      .select()
      .from(agentDefinitions)
      .where(and(...conditions))
      .limit(1);

    return agent ?? null;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const knowledgeRetriever = new KnowledgeRetriever();
