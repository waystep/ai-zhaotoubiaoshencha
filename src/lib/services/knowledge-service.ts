/**
 * Knowledge Base Service
 *
 * CRUD + vectorization + semantic search for knowledge bases and items.
 * Uses Drizzle ORM for DB queries and delegates embedding/vectorization
 * to EmbeddingService.
 */

import { eq, and, count, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  knowledgeBases,
  knowledgeItems,
  knowledgeItemChunks,
} from "@/lib/db/schema";
import { embeddingService } from "@/lib/services/embedding-service";
import type { InferSelectModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KnowledgeBase = InferSelectModel<typeof knowledgeBases>;
export type KnowledgeItem = InferSelectModel<typeof knowledgeItems>;

export const VALID_KB_TYPES = [
  "legal_regulation",
  "bid_template",
  "risk_item",
  "custom",
] as const;
export type KnowledgeBaseType = (typeof VALID_KB_TYPES)[number];

export interface CreateBaseInput {
  name: string;
  type: KnowledgeBaseType;
  description?: string | null;
  icon?: string | null;
  organizationId: string;
}

export interface UpdateBaseInput {
  name?: string;
  type?: KnowledgeBaseType;
  description?: string | null;
  icon?: string | null;
  isActive?: boolean;
}

export interface AddItemInput {
  title?: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdBy?: string;
}

export interface UpdateItemInput {
  title?: string;
  content?: string;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
  tags?: string[];
}

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface PaginatedItems {
  data: KnowledgeItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BaseStats {
  itemCount: number;
  vectorizedCount: number;
  totalChunks: number;
  coverage: number; // percentage 0-100
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class KnowledgeService {
  // -----------------------------------------------------------------------
  // List knowledge bases (optionally filtered by org and type)
  // -----------------------------------------------------------------------

  async listBases(
    organizationId?: string,
    filters?: { type?: KnowledgeBaseType },
  ): Promise<KnowledgeBase[]> {
    const conditions = [];

    if (organizationId) {
      conditions.push(eq(knowledgeBases.organizationId, organizationId));
    }

    if (filters?.type) {
      conditions.push(eq(knowledgeBases.type, filters.type));
    }

    const query = db
      .select()
      .from(knowledgeBases)
      .orderBy(knowledgeBases.createdAt);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  }

  // -----------------------------------------------------------------------
  // Get single knowledge base by ID (with stats)
  // -----------------------------------------------------------------------

  async getBase(id: string): Promise<(KnowledgeBase & { stats: BaseStats }) | null> {
    const base = await db.query.knowledgeBases.findFirst({
      where: eq(knowledgeBases.id, id),
    });

    if (!base) return null;

    const stats = await this.getStats(id);

    return { ...base, stats };
  }

  // -----------------------------------------------------------------------
  // Create a knowledge base
  // -----------------------------------------------------------------------

  async createBase(data: CreateBaseInput): Promise<KnowledgeBase> {
    if (!VALID_KB_TYPES.includes(data.type)) {
      throw new Error(
        `Invalid knowledge base type: ${data.type}. Must be one of: ${VALID_KB_TYPES.join(", ")}`,
      );
    }

    const [created] = await db
      .insert(knowledgeBases)
      .values({
        name: data.name,
        type: data.type,
        description: data.description ?? null,
        icon: data.icon ?? null,
        organizationId: data.organizationId,
        isActive: true,
        documentCount: 0,
        totalChunks: 0,
      })
      .returning();

    return created;
  }

  // -----------------------------------------------------------------------
  // Update a knowledge base
  // -----------------------------------------------------------------------

  async updateBase(id: string, data: UpdateBaseInput): Promise<KnowledgeBase> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.type !== undefined) updates.type = data.type;
    if (data.description !== undefined) updates.description = data.description;
    if (data.icon !== undefined) updates.icon = data.icon;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    const [updated] = await db
      .update(knowledgeBases)
      .set(updates)
      .where(eq(knowledgeBases.id, id))
      .returning();

    return updated;
  }

  // -----------------------------------------------------------------------
  // Delete a knowledge base (cascade deletes items and chunks)
  // -----------------------------------------------------------------------

  async deleteBase(id: string): Promise<void> {
    await db
      .delete(knowledgeBases)
      .where(eq(knowledgeBases.id, id));
  }

  // -----------------------------------------------------------------------
  // List items in a knowledge base (paginated)
  // -----------------------------------------------------------------------

  async listItems(
    baseId: string,
    pagination?: PaginationInput,
  ): Promise<PaginatedItems> {
    const page = Math.max(1, pagination?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, pagination?.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    // Total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(knowledgeItems)
      .where(eq(knowledgeItems.knowledgeBaseId, baseId));

    // Paginated data
    const data = await db
      .select()
      .from(knowledgeItems)
      .where(eq(knowledgeItems.knowledgeBaseId, baseId))
      .orderBy(knowledgeItems.createdAt)
      .limit(pageSize)
      .offset(offset);

    return { data, total, page, pageSize };
  }

  // -----------------------------------------------------------------------
  // Get single knowledge item
  // -----------------------------------------------------------------------

  async getItem(itemId: string): Promise<KnowledgeItem | null> {
    const item = await db.query.knowledgeItems.findFirst({
      where: eq(knowledgeItems.id, itemId),
    });

    return item ?? null;
  }

  // -----------------------------------------------------------------------
  // Add an item to a knowledge base
  // -----------------------------------------------------------------------

  async addItem(baseId: string, data: AddItemInput): Promise<KnowledgeItem> {
    // Verify the knowledge base exists
    const base = await db.query.knowledgeBases.findFirst({
      where: eq(knowledgeBases.id, baseId),
    });

    if (!base) {
      throw new Error(`Knowledge base not found: ${baseId}`);
    }

    // Validate metadata by KB type
    this.validateItemMetadata(base.type, data.metadata);

    const [created] = await db
      .insert(knowledgeItems)
      .values({
        knowledgeBaseId: baseId,
        title: data.title ?? null,
        content: data.content,
        source: data.source ?? null,
        metadata: data.metadata ?? null,
        tags: data.tags ?? [],
        isVectorized: false,
        chunkCount: 0,
        createdBy: data.createdBy ?? null,
      })
      .returning();

    // Update document count on the base
    await db
      .update(knowledgeBases)
      .set({
        documentCount: sql`document_count + 1`,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBases.id, baseId));

    return created;
  }

  // -----------------------------------------------------------------------
  // Update a knowledge item
  // -----------------------------------------------------------------------

  async updateItem(itemId: string, data: UpdateItemInput): Promise<KnowledgeItem> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updates.title = data.title;
    if (data.content !== undefined) updates.content = data.content;
    if (data.source !== undefined) updates.source = data.source;
    if (data.metadata !== undefined) updates.metadata = data.metadata;
    if (data.tags !== undefined) updates.tags = data.tags;

    // If content changed, mark as unvectorized so it can be re-vectorized
    if (data.content !== undefined) {
      updates.isVectorized = false;
      updates.chunkCount = 0;
    }

    const [updated] = await db
      .update(knowledgeItems)
      .set(updates)
      .where(eq(knowledgeItems.id, itemId))
      .returning();

    return updated;
  }

  // -----------------------------------------------------------------------
  // Delete a knowledge item (cascade deletes chunks)
  // -----------------------------------------------------------------------

  async deleteItem(itemId: string): Promise<void> {
    // Get the item to find its base for count update
    const item = await db.query.knowledgeItems.findFirst({
      where: eq(knowledgeItems.id, itemId),
    });

    if (!item) return;

    // Delete the item (cascades to chunks)
    await db
      .delete(knowledgeItems)
      .where(eq(knowledgeItems.id, itemId));

    // Update document count on the base
    await db
      .update(knowledgeBases)
      .set({
        documentCount: sql`GREATEST(document_count - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBases.id, item.knowledgeBaseId));
  }

  // -----------------------------------------------------------------------
  // Vectorize a single item via EmbeddingService
  // -----------------------------------------------------------------------

  async vectorizeItem(itemId: string): Promise<{ chunks: number }> {
    const result = await embeddingService.vectorizeItem(itemId);

    // Update the base's totalChunks counter
    const item = await this.getItem(itemId);
    if (item) {
      await this.recalculateBaseStats(item.knowledgeBaseId);
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Batch vectorize all unvectorized items in a knowledge base
  // -----------------------------------------------------------------------

  async vectorizeBase(baseId: string): Promise<{ processed: number; errors: string[] }> {
    // Find all unvectorized items
    const unvectorized = await db
      .select({ id: knowledgeItems.id })
      .from(knowledgeItems)
      .where(
        and(
          eq(knowledgeItems.knowledgeBaseId, baseId),
          eq(knowledgeItems.isVectorized, false),
        ),
      );

    let processed = 0;
    const errors: string[] = [];

    for (const item of unvectorized) {
      try {
        await embeddingService.vectorizeItem(item.id);
        processed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Item ${item.id}: ${msg}`);
      }
    }

    // Recalculate base stats
    await this.recalculateBaseStats(baseId);

    return { processed, errors };
  }

  // -----------------------------------------------------------------------
  // Semantic search within a knowledge base
  // -----------------------------------------------------------------------

  async search(
    baseId: string,
    query: string,
    topK: number = 5,
  ) {
    return embeddingService.search(baseId, query, topK);
  }

  // -----------------------------------------------------------------------
  // Get statistics for a knowledge base
  // -----------------------------------------------------------------------

  async getStats(baseId: string): Promise<BaseStats> {
    const [itemStats] = await db
      .select({
        itemCount: count(),
        vectorizedCount: sql<number>`COUNT(*) FILTER (WHERE ${knowledgeItems.isVectorized} = true)`,
      })
      .from(knowledgeItems)
      .where(eq(knowledgeItems.knowledgeBaseId, baseId));

    const [chunkStats] = await db
      .select({
        totalChunks: sql<number>`COALESCE(SUM(${knowledgeItems.chunkCount}), 0)`,
      })
      .from(knowledgeItems)
      .where(eq(knowledgeItems.knowledgeBaseId, baseId));

    const itemCount = Number(itemStats?.itemCount ?? 0);
    const vectorizedCount = Number(itemStats?.vectorizedCount ?? 0);
    const totalChunks = Number(chunkStats?.totalChunks ?? 0);
    const coverage = itemCount > 0 ? Math.round((vectorizedCount / itemCount) * 100) : 0;

    return { itemCount, vectorizedCount, totalChunks, coverage };
  }

  // -----------------------------------------------------------------------
  // Private: Validate item metadata by knowledge base type
  // -----------------------------------------------------------------------

  private validateItemMetadata(
    type: string,
    metadata?: Record<string, unknown>,
  ): void {
    // For legal_regulation, expect fields like lawName, articleNo, effectiveDate
    if (type === "legal_regulation" && metadata) {
      // Soft validation — just ensure metadata is a plain object
      if (typeof metadata !== "object" || Array.isArray(metadata)) {
        throw new Error("metadata must be a JSON object");
      }
    }

    // For bid_template, expect fields like templateName, category
    if (type === "bid_template" && metadata) {
      if (typeof metadata !== "object" || Array.isArray(metadata)) {
        throw new Error("metadata must be a JSON object");
      }
    }

    // For risk_item, expect fields like riskLevel, category
    if (type === "risk_item" && metadata) {
      if (typeof metadata !== "object" || Array.isArray(metadata)) {
        throw new Error("metadata must be a JSON object");
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private: Recalculate totalChunks on the base after vectorization
  // -----------------------------------------------------------------------

  private async recalculateBaseStats(baseId: string): Promise<void> {
    const stats = await this.getStats(baseId);

    await db
      .update(knowledgeBases)
      .set({
        documentCount: stats.itemCount,
        totalChunks: stats.totalChunks,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBases.id, baseId));
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const knowledgeService = new KnowledgeService();
