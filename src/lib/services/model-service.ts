/**
 * Model Management Service
 *
 * CRUD + connection-testing for AI models registered in ai_models table.
 * All methods operate via Drizzle ORM against the PostgreSQL database.
 */

import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiModels } from "@/lib/db/schema";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiModel = InferSelectModel<typeof aiModels>;

export interface CreateModelInput {
  name: string;
  modelType: "local" | "cloud" | "multimodal";
  provider: string;
  modelId: string;
  endpoint: string;
  apiKey?: string | null;
  capabilities?: string[] | null;
  costPerKInputTokens?: number | null;
  costPerKOutputTokens?: number | null;
  maxTokens?: number | null;
  organizationId?: string | null;
}

export interface UpdateModelInput {
  name?: string;
  modelType?: "local" | "cloud" | "multimodal";
  provider?: string;
  modelId?: string;
  endpoint?: string;
  apiKey?: string | null;
  capabilities?: string[] | null;
  costPerKInputTokens?: number | null;
  costPerKOutputTokens?: number | null;
  maxTokens?: number | null;
  organizationId?: string | null;
  isActive?: boolean;
}

export interface TestConnectionResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class ModelService {
  // -----------------------------------------------------------------------
  // List models (optionally filtered by organization and model type)
  // -----------------------------------------------------------------------

  async list(
    organizationId: string,
    filters?: { type?: string },
  ): Promise<AiModel[]> {
    const conditions = [
      eq(aiModels.organizationId, organizationId),
      // Only return active models by default
      eq(aiModels.isActive, true),
    ];

    if (filters?.type) {
      conditions.push(eq(aiModels.modelType, filters.type as "local" | "cloud" | "multimodal"));
    }

    const rows = await db
      .select()
      .from(aiModels)
      .where(and(...conditions))
      .orderBy(aiModels.createdAt);

    return rows;
  }

  // -----------------------------------------------------------------------
  // List ALL models (including inactive) for admin management
  // -----------------------------------------------------------------------

  async listAll(
    filters?: { type?: string; organizationId?: string },
  ): Promise<AiModel[]> {
    const conditions = [];

    if (filters?.type) {
      conditions.push(eq(aiModels.modelType, filters.type as "local" | "cloud" | "multimodal"));
    }

    if (filters?.organizationId) {
      conditions.push(eq(aiModels.organizationId, filters.organizationId));
    }

    const rows = db
      .select()
      .from(aiModels)
      .orderBy(aiModels.createdAt);

    if (conditions.length > 0) {
      return rows.where(and(...conditions));
    }

    return rows;
  }

  // -----------------------------------------------------------------------
  // Get single model by ID
  // -----------------------------------------------------------------------

  async getById(id: string): Promise<AiModel | null> {
    const model = await db.query.aiModels.findFirst({
      where: eq(aiModels.id, id),
    });

    return model ?? null;
  }

  // -----------------------------------------------------------------------
  // Create a new model
  // -----------------------------------------------------------------------

  async create(data: CreateModelInput): Promise<AiModel> {
    const [created] = await db
      .insert(aiModels)
      .values({
        name: data.name,
        modelType: data.modelType,
        provider: data.provider,
        modelId: data.modelId,
        endpoint: data.endpoint,
        apiKey: data.apiKey ?? null,
        capabilities: data.capabilities ?? [],
        costPerKInputTokens: data.costPerKInputTokens ?? null,
        costPerKOutputTokens: data.costPerKOutputTokens ?? null,
        maxTokens: data.maxTokens ?? 4096,
        organizationId: data.organizationId ?? null,
        isActive: true,
      })
      .returning();

    return created;
  }

  // -----------------------------------------------------------------------
  // Update an existing model
  // -----------------------------------------------------------------------

  async update(id: string, data: UpdateModelInput): Promise<AiModel> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.modelType !== undefined) updates.modelType = data.modelType;
    if (data.provider !== undefined) updates.provider = data.provider;
    if (data.modelId !== undefined) updates.modelId = data.modelId;
    if (data.endpoint !== undefined) updates.endpoint = data.endpoint;
    if (data.apiKey !== undefined) updates.apiKey = data.apiKey;
    if (data.capabilities !== undefined) updates.capabilities = data.capabilities;
    if (data.costPerKInputTokens !== undefined) updates.costPerKInputTokens = data.costPerKInputTokens;
    if (data.costPerKOutputTokens !== undefined) updates.costPerKOutputTokens = data.costPerKOutputTokens;
    if (data.maxTokens !== undefined) updates.maxTokens = data.maxTokens;
    if (data.organizationId !== undefined) updates.organizationId = data.organizationId;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    const [updated] = await db
      .update(aiModels)
      .set(updates)
      .where(eq(aiModels.id, id))
      .returning();

    return updated;
  }

  // -----------------------------------------------------------------------
  // Soft delete (set isActive = false)
  // -----------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    await db
      .update(aiModels)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(aiModels.id, id));
  }

  // -----------------------------------------------------------------------
  // Toggle active/inactive
  // -----------------------------------------------------------------------

  async toggleActive(id: string, active: boolean): Promise<void> {
    await db
      .update(aiModels)
      .set({ isActive: active, updatedAt: new Date() })
      .where(eq(aiModels.id, id));
  }

  // -----------------------------------------------------------------------
  // Test connection to the model endpoint
  // -----------------------------------------------------------------------

  async testConnection(id: string): Promise<TestConnectionResult> {
    const model = await this.getById(id);

    if (!model) {
      return { ok: false, latencyMs: 0, error: "Model not found" };
    }

    const start = Date.now();

    try {
      switch (model.modelType) {
        case "local":
          return await this.testLocalConnection(model, start);
        case "cloud":
          return await this.testCloudConnection(model, start);
        case "multimodal":
          return await this.testMultimodalConnection(model, start);
        default:
          return {
            ok: false,
            latencyMs: Date.now() - start,
            error: `Unknown model type: ${model.modelType}`,
          };
      }
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  // -----------------------------------------------------------------------
  // Private: test local (Ollama) connection
  // -----------------------------------------------------------------------

  private async testLocalConnection(
    model: AiModel,
    startTime: number,
  ): Promise<TestConnectionResult> {
    try {
      const url = `${model.endpoint}/api/tags`;
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(10_000), // 10s timeout
      });

      if (!response.ok) {
        return {
          ok: false,
          latencyMs: Date.now() - startTime,
          error: `Endpoint returned ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      const models: Array<{ name: string }> = data.models ?? [];

      const found = models.some((m) => m.name === model.modelId);

      if (!found) {
        const available = models.map((m) => m.name).join(", ");
        return {
          ok: false,
          latencyMs: Date.now() - startTime,
          error: `Model "${model.modelId}" not found at endpoint. Available: ${available || "(none)"}`,
        };
      }

      return { ok: true, latencyMs: Date.now() - startTime };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }

  // -----------------------------------------------------------------------
  // Private: test cloud API connection
  // -----------------------------------------------------------------------

  private async testCloudConnection(
    model: AiModel,
    startTime: number,
  ): Promise<TestConnectionResult> {
    try {
      if (!model.apiKey) {
        return {
          ok: false,
          latencyMs: Date.now() - startTime,
          error: "API key is required for cloud models",
        };
      }

      // Use OpenAI-compatible chat completions endpoint
      const url = `${model.endpoint}/chat/completions`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${model.apiKey}`,
        },
        body: JSON.stringify({
          model: model.modelId,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          ok: false,
          latencyMs: Date.now() - startTime,
          error: `Endpoint returned ${response.status}: ${text.slice(0, 200)}`,
        };
      }

      return { ok: true, latencyMs: Date.now() - startTime };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }

  // -----------------------------------------------------------------------
  // Private: test multimodal connection (Ollama with vision support)
  // -----------------------------------------------------------------------

  private async testMultimodalConnection(
    model: AiModel,
    startTime: number,
  ): Promise<TestConnectionResult> {
    try {
      // First, check if the model is listed in Ollama tags
      const tagsUrl = `${model.endpoint}/api/tags`;
      const tagsResponse = await fetch(tagsUrl, {
        method: "GET",
        signal: AbortSignal.timeout(10_000),
      });

      if (!tagsResponse.ok) {
        return {
          ok: false,
          latencyMs: Date.now() - startTime,
          error: `Endpoint returned ${tagsResponse.status} ${tagsResponse.statusText}`,
        };
      }

      const data = await tagsResponse.json();
      const models: Array<{ name: string }> = data.models ?? [];

      const found = models.some((m) => m.name === model.modelId);

      if (!found) {
        const available = models.map((m) => m.name).join(", ");
        return {
          ok: false,
          latencyMs: Date.now() - startTime,
          error: `Model "${model.modelId}" not found at endpoint. Available: ${available || "(none)"}`,
        };
      }

      // Optionally: try a minimal generation to verify multimodal capability
      // For now, just confirming the model exists is sufficient
      return { ok: true, latencyMs: Date.now() - startTime };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const modelService = new ModelService();
