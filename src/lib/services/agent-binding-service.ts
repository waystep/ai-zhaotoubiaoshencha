/**
 * Agent Binding Service
 *
 * Manages the binding between AI agents and models, plus preset modes
 * that allow batch-switching all agent bindings at once.
 *
 * All methods operate via Drizzle ORM against the PostgreSQL database.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  agentDefinitions,
  agentModelBindings,
  presetModes,
  aiModels,
} from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentDefinition = InferSelectModel<typeof agentDefinitions>;
type AgentModelBinding = InferSelectModel<typeof agentModelBindings>;
type PresetMode = InferSelectModel<typeof presetModes>;
type AiModel = InferSelectModel<typeof aiModels>;

export interface AgentBindingWithModel {
  agent: AgentDefinition;
  binding: AgentModelBinding | null;
  model: AiModel | null;
}

export interface SetBindingInput {
  agentKey: string;
  modelId: string;
  isPrimary: boolean;
}

export interface SeedModelIds {
  local27b: string;
  vl7b: string;
  glm51: string;
  deepseekV4: string;
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class AgentBindingService {
  // -----------------------------------------------------------------------
  // List all agents with their currently bound models
  // -----------------------------------------------------------------------

  async listBindingsWithModels(orgId: string): Promise<AgentBindingWithModel[]> {
    // Fetch all agent definitions for this org
    const agents = await db
      .select()
      .from(agentDefinitions)
      .where(eq(agentDefinitions.organizationId, orgId))
      .orderBy(agentDefinitions.agentKey);

    if (agents.length === 0) {
      return [];
    }

    // Fetch all primary bindings for these agents in this org
    const bindings = await db
      .select({
        binding: agentModelBindings,
        model: aiModels,
      })
      .from(agentModelBindings)
      .innerJoin(aiModels, eq(agentModelBindings.modelId, aiModels.id))
      .where(
        and(
          eq(agentModelBindings.organizationId, orgId),
          eq(agentModelBindings.isPrimary, true),
        ),
      );

    // Build a lookup map: agentId -> { binding, model }
    const bindingMap = new Map<string, { binding: AgentModelBinding; model: AiModel }>();
    for (const row of bindings) {
      bindingMap.set(row.binding.agentId, { binding: row.binding, model: row.model });
    }

    // Combine agents with their bindings
    return agents.map((agent) => {
      const entry = bindingMap.get(agent.id);
      return {
        agent,
        binding: entry?.binding ?? null,
        model: entry?.model ?? null,
      };
    });
  }

  // -----------------------------------------------------------------------
  // Set a single agent's model binding
  // -----------------------------------------------------------------------

  async setBinding(
    agentKey: string,
    modelId: string,
    isPrimary: boolean,
    orgId: string,
  ): Promise<void> {
    // Look up the agent definition by key
    const [agent] = await db
      .select()
      .from(agentDefinitions)
      .where(
        and(
          eq(agentDefinitions.agentKey, agentKey),
          eq(agentDefinitions.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!agent) {
      throw new Error(`Agent not found: ${agentKey}`);
    }

    // Verify the model exists
    const [model] = await db
      .select()
      .from(aiModels)
      .where(eq(aiModels.id, modelId))
      .limit(1);

    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // If this is a primary binding, deactivate any existing primary binding for this agent
    if (isPrimary) {
      await db
        .update(agentModelBindings)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(agentModelBindings.agentId, agent.id),
            eq(agentModelBindings.organizationId, orgId),
            eq(agentModelBindings.isPrimary, true),
          ),
        );
    }

    // Upsert the binding: check if a binding already exists for this agent+model combo
    const [existing] = await db
      .select()
      .from(agentModelBindings)
      .where(
        and(
          eq(agentModelBindings.agentId, agent.id),
          eq(agentModelBindings.modelId, modelId),
          eq(agentModelBindings.organizationId, orgId),
        ),
      )
      .limit(1);

    if (existing) {
      // Update existing binding
      await db
        .update(agentModelBindings)
        .set({ isPrimary, updatedAt: new Date() })
        .where(eq(agentModelBindings.id, existing.id));
    } else {
      // Insert new binding
      await db.insert(agentModelBindings).values({
        agentId: agent.id,
        modelId,
        isPrimary,
        organizationId: orgId,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Batch set bindings (for direct API batch update)
  // -----------------------------------------------------------------------

  async batchSetBindings(
    updates: Record<string, { modelId: string; isPrimary: boolean }>,
    orgId: string,
  ): Promise<void> {
    for (const [agentKey, config] of Object.entries(updates)) {
      await this.setBinding(agentKey, config.modelId, config.isPrimary, orgId);
    }
  }

  // -----------------------------------------------------------------------
  // Activate a preset mode (updates all agentModelBindings to match)
  // -----------------------------------------------------------------------

  async activatePresetMode(modeId: string, orgId: string): Promise<void> {
    // Fetch the preset mode
    const [mode] = await db
      .select()
      .from(presetModes)
      .where(
        and(
          eq(presetModes.id, modeId),
          eq(presetModes.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!mode) {
      throw new Error(`Preset mode not found: ${modeId}`);
    }

    const bindings = mode.bindings as Record<string, string>;

    // Batch update all agent bindings
    await this.batchSetBindings(
      Object.fromEntries(
        Object.entries(bindings).map(([agentKey, modelId]) => ({
          [agentKey]: { modelId, isPrimary: true },
        })).flatMap(Object.entries),
      ),
      orgId,
    );

    // Deactivate all other preset modes for this org, activate this one
    await db
      .update(presetModes)
      .set({ isActive: false })
      .where(eq(presetModes.organizationId, orgId));

    await db
      .update(presetModes)
      .set({ isActive: true })
      .where(eq(presetModes.id, modeId));
  }

  // -----------------------------------------------------------------------
  // List preset modes for an org
  // -----------------------------------------------------------------------

  async listPresetModes(orgId: string): Promise<PresetMode[]> {
    return db
      .select()
      .from(presetModes)
      .where(eq(presetModes.organizationId, orgId))
      .orderBy(presetModes.createdAt);
  }

  // -----------------------------------------------------------------------
  // Create a new preset mode
  // -----------------------------------------------------------------------

  async createPresetMode(
    name: string,
    description: string | null,
    bindings: Record<string, string>,
    orgId: string,
  ): Promise<PresetMode> {
    const [created] = await db
      .insert(presetModes)
      .values({
        name,
        description,
        bindings,
        isActive: false,
        organizationId: orgId,
      })
      .returning();

    return created;
  }

  // -----------------------------------------------------------------------
  // Get a single preset mode by ID
  // -----------------------------------------------------------------------

  async getPresetModeById(modeId: string, orgId: string): Promise<PresetMode | null> {
    const [mode] = await db
      .select()
      .from(presetModes)
      .where(
        and(
          eq(presetModes.id, modeId),
          eq(presetModes.organizationId, orgId),
        ),
      )
      .limit(1);

    return mode ?? null;
  }

  // -----------------------------------------------------------------------
  // Delete a preset mode
  // -----------------------------------------------------------------------

  async deletePresetMode(modeId: string, orgId: string): Promise<void> {
    await db
      .delete(presetModes)
      .where(
        and(
          eq(presetModes.id, modeId),
          eq(presetModes.organizationId, orgId),
        ),
      );
  }

  // -----------------------------------------------------------------------
  // Seed default preset modes if they don't exist
  // -----------------------------------------------------------------------

  async seedPresetModes(orgId: string, modelIds: SeedModelIds): Promise<void> {
    // Check if modes already exist for this org
    const existing = await db
      .select()
      .from(presetModes)
      .where(eq(presetModes.organizationId, orgId));

    if (existing.length > 0) {
      return; // Already seeded
    }

    // Economy mode (省钱模式): favor local models where possible
    // A1->local, A2->cloud, A3->local, A4->local_multimodal, A5->local, A6->cloud, A7->local
    const economyBindings: Record<string, string> = {
      A1: modelIds.local27b,
      A2: modelIds.deepseekV4,
      A3: modelIds.local27b,
      A4: modelIds.vl7b,
      A5: modelIds.local27b,
      A6: modelIds.glm51,
      A7: modelIds.local27b,
    };

    // Demo mode (演示模式): all agents use cloud models
    const demoBindings: Record<string, string> = {
      A1: modelIds.deepseekV4,
      A2: modelIds.deepseekV4,
      A3: modelIds.deepseekV4,
      A4: modelIds.deepseekV4,
      A5: modelIds.deepseekV4,
      A6: modelIds.deepseekV4,
      A7: modelIds.deepseekV4,
    };

    await db.insert(presetModes).values([
      {
        name: "省钱模式",
        description: "优先使用本地模型，仅在必要时使用云端模型，降低运行成本",
        bindings: economyBindings,
        isActive: false,
        organizationId: orgId,
      },
      {
        name: "演示模式",
        description: "全部使用云端模型，确保最佳输出质量，适合演示和评审场景",
        bindings: demoBindings,
        isActive: false,
        organizationId: orgId,
      },
    ]);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const agentBindingService = new AgentBindingService();
