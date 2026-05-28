/**
 * Agent Config Resolver
 *
 * Central runtime resolution system that dynamically assembles the full
 * configuration for an AI agent from the database:
 *
 *   - Agent definition (name, description, category)
 *   - Model config (via agentModelBindings → aiModels)
 *   - Knowledge bases (via defaultConfig.knowledgeBaseIds)
 *   - Rules (via defaultConfig.ruleSetId → ruleSets → ruleItems)
 *   - Merged custom parameters (defaultConfig + binding customConfig)
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  agentDefinitions,
  agentModelBindings,
  aiModels,
  knowledgeBases,
  ruleSets,
  ruleItems,
} from "@/lib/db/schema";
import { modelResolver, type ResolvedModelConfig } from "./model-resolver";
import { ruleLoader, type ResolvedRuleItem } from "./rule-loader";
import type { KnowledgeBase } from "./knowledge-retriever";
import type { InferSelectModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentDefinition = InferSelectModel<typeof agentDefinitions>;

export interface AgentFullConfig {
  agentKey: string;
  name: string;
  description: string | null;
  category: string | null;
  model: ResolvedModelConfig | null;
  knowledgeBases: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  rules: ResolvedRuleItem[];
  customConfig: {
    temperature: number;
    maxTokens: number;
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AgentConfigResolver {
  /**
   * Resolve the complete configuration for an agent.
   *
   * Orchestrates all sub-resolvers and merges defaultConfig with
   * any per-binding customConfig overrides.
   */
  async resolveAll(
    agentKey: string,
    orgId?: string,
  ): Promise<AgentFullConfig> {
    // 1. Load agent definition
    const agent = await this.findAgent(agentKey, orgId);

    if (!agent) {
      throw new Error(`Agent not found: ${agentKey}`);
    }

    const defaultConfig = (agent.defaultConfig as Record<string, unknown>) ?? {};

    // 2. Resolve model (parallel-safe)
    const model = await modelResolver.resolve(agentKey, orgId);

    // 3. Resolve knowledge bases
    const kbs = await this.loadKnowledgeBases(agent, orgId);

    // 4. Resolve rules
    const rules = await ruleLoader.resolve(agentKey, orgId);

    // 5. Merge custom config from binding
    const customConfig = await this.mergeCustomConfig(agent.id, defaultConfig, orgId);

    return {
      agentKey: agent.agentKey,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      model,
      knowledgeBases: kbs.map((kb) => ({
        id: kb.id,
        name: kb.name,
        type: kb.type,
      })),
      rules,
      customConfig,
    };
  }

  /**
   * Resolve only the model config for an agent.
   */
  async resolveModel(
    agentKey: string,
    orgId?: string,
  ): Promise<ResolvedModelConfig | null> {
    return modelResolver.resolve(agentKey, orgId);
  }

  /**
   * Resolve only the knowledge bases for an agent.
   */
  async resolveKnowledgeBases(
    agentKey: string,
    orgId?: string,
  ): Promise<Array<{ id: string; name: string; type: string }>> {
    const agent = await this.findAgent(agentKey, orgId);
    if (!agent) return [];

    const kbs = await this.loadKnowledgeBases(agent, orgId);
    return kbs.map((kb) => ({ id: kb.id, name: kb.name, type: kb.type }));
  }

  /**
   * Resolve only the rule set for an agent.
   */
  async resolveRuleSet(
    agentKey: string,
    orgId?: string,
  ): Promise<ResolvedRuleItem[]> {
    return ruleLoader.resolve(agentKey, orgId);
  }

  // -------------------------------------------------------------------------
  // Private helpers
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

  /**
   * Load knowledge bases from agent's defaultConfig.knowledgeBaseIds.
   */
  private async loadKnowledgeBases(
    agent: AgentDefinition,
    _orgId?: string,
  ): Promise<KnowledgeBase[]> {
    const defaultConfig = (agent.defaultConfig as Record<string, unknown>) ?? {};
    const kbIds = defaultConfig.knowledgeBaseIds as string[] | undefined;

    if (!kbIds || kbIds.length === 0) return [];

    // Fetch only active KBs matching the IDs
    const bases = await db
      .select()
      .from(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.isActive, true),
          // inArray would be ideal but we use individual lookups for safety
        ),
      );

    // Filter in-memory to avoid importing inArray
    return bases.filter((b) => kbIds.includes(b.id));
  }

  /**
   * Merge defaultConfig with the binding's customConfig overlay.
   *
   * Precedence: binding.customConfig > agent.defaultConfig
   */
  private async mergeCustomConfig(
    agentId: string,
    defaultConfig: Record<string, unknown>,
    orgId?: string,
  ): Promise<{ temperature: number; maxTokens: number; [key: string]: unknown }> {
    // Defaults
    const base: Record<string, unknown> = {
      temperature: 0.1,
      maxTokens: 4096,
      ...defaultConfig,
    };

    // Look for a primary binding with a customConfig overlay
    const bindingConditions = [
      eq(agentModelBindings.agentId, agentId),
      eq(agentModelBindings.isPrimary, true),
    ];
    if (orgId) {
      bindingConditions.push(eq(agentModelBindings.organizationId, orgId));
    }

    const [binding] = await db
      .select({ customConfig: agentModelBindings.customConfig })
      .from(agentModelBindings)
      .where(and(...bindingConditions))
      .limit(1);

    if (binding?.customConfig) {
      const overlay = binding.customConfig as Record<string, unknown>;
      Object.assign(base, overlay);
    }

    return base as { temperature: number; maxTokens: number; [key: string]: unknown };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const agentConfigResolver = new AgentConfigResolver();
