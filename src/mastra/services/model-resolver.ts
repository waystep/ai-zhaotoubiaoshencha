/**
 * Model Resolver
 *
 * Resolves the model configuration for an agent at runtime.
 * Reads from agentModelBindings (primary) joined with aiModels
 * to produce a usable model config with endpoint, apiKey, etc.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  agentDefinitions,
  agentModelBindings,
  aiModels,
} from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AiModel = InferSelectModel<typeof aiModels>;

export interface ResolvedModelConfig {
  id: string;
  name: string;
  modelType: string;
  provider: string;
  modelId: string;
  endpoint: string;
  apiKey: string | null;
  capabilities: string[];
  maxTokens: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ModelResolver {
  /**
   * Resolve the primary model for a given agentKey + orgId.
   *
   * Resolution path:
   *   1. Find agentDefinitions row by agentKey (optionally scoped to orgId).
   *   2. Find the primary agentModelBindings row for that agent.
   *   3. Join aiModels to get the full model config.
   *
   * Returns null if no binding or model is found.
   */
  async resolve(
    agentKey: string,
    orgId?: string,
  ): Promise<ResolvedModelConfig | null> {
    // 1. Find the agent definition
    const agentConditions = [eq(agentDefinitions.agentKey, agentKey)];
    if (orgId) {
      agentConditions.push(eq(agentDefinitions.organizationId, orgId));
    }

    const [agent] = await db
      .select({ id: agentDefinitions.id })
      .from(agentDefinitions)
      .where(and(...agentConditions))
      .limit(1);

    if (!agent) return null;

    // 2. Find primary binding + join aiModels
    const bindingConditions = [
      eq(agentModelBindings.agentId, agent.id),
      eq(agentModelBindings.isPrimary, true),
    ];
    if (orgId) {
      bindingConditions.push(eq(agentModelBindings.organizationId, orgId));
    }

    const [row] = await db
      .select({
        model: aiModels,
      })
      .from(agentModelBindings)
      .innerJoin(aiModels, eq(agentModelBindings.modelId, aiModels.id))
      .where(and(...bindingConditions))
      .limit(1);

    if (!row) return null;

    return this.toResolvedConfig(row.model);
  }

  /**
   * Build a Mastra-compatible model identifier string.
   *
   * The Mastra framework routes model requests via a provider/modelId pattern.
   * This helper constructs the identifier that Mastra's ModelsDevGateway can use.
   *
   * Examples:
   *   - Ollama local: the model config already carries endpoint + modelId
   *   - Cloud providers: "provider-name/model-id" string
   */
  toMastraModelString(config: ResolvedModelConfig): string {
    if (config.modelType === "local" || config.provider === "ollama") {
      // For Ollama / local models the endpoint itself carries the base URL;
      // Mastra uses a custom provider registration.  Return the modelId as-is.
      return config.modelId;
    }

    // Cloud providers — return "provider/modelId" format
    return `${config.provider}/${config.modelId}`;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private toResolvedConfig(model: AiModel): ResolvedModelConfig {
    return {
      id: model.id,
      name: model.name,
      modelType: model.modelType,
      provider: model.provider,
      modelId: model.modelId,
      endpoint: model.endpoint,
      apiKey: model.apiKey,
      capabilities: (model.capabilities as string[]) ?? [],
      maxTokens: model.maxTokens ?? 4096,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const modelResolver = new ModelResolver();
