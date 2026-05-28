/**
 * Rule Set Service
 *
 * CRUD for rule sets and rule items (detection rules).
 * Uses Drizzle ORM for DB queries.
 */

import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ruleSets, ruleItems, agentDefinitions } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RuleSet = InferSelectModel<typeof ruleSets>;
export type RuleItem = InferSelectModel<typeof ruleItems>;

export interface RuleSetWithRules extends RuleSet {
  rules: RuleItem[];
}

export interface CreateSetInput {
  name: string;
  description?: string | null;
  industry?: string | null;
  agentId?: string | null;
  organizationId?: string | null;
  isActive?: boolean;
}

export interface UpdateSetInput {
  name?: string;
  description?: string | null;
  industry?: string | null;
  agentId?: string | null;
  organizationId?: string | null;
  isActive?: boolean;
}

export interface AddRuleInput {
  ruleNo: string;
  name: string;
  detectionType?: "keyword" | "comparison" | "semantic" | "existence" | null;
  severity: string;
  description: string;
  parameters?: Record<string, unknown> | null;
  isEnabled?: boolean;
  sortOrder?: number;
}

export interface UpdateRuleInput {
  ruleNo?: string;
  name?: string;
  detectionType?: "keyword" | "comparison" | "semantic" | "existence" | null;
  severity?: string;
  description?: string;
  parameters?: Record<string, unknown> | null;
  isEnabled?: boolean;
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class RuleService {
  // -----------------------------------------------------------------------
  // List rule sets (optionally filtered by org)
  // -----------------------------------------------------------------------

  async listSets(organizationId?: string): Promise<RuleSet[]> {
    const conditions = [];

    if (organizationId) {
      conditions.push(eq(ruleSets.organizationId, organizationId));
    }

    const query = db
      .select()
      .from(ruleSets)
      .orderBy(ruleSets.createdAt);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  }

  // -----------------------------------------------------------------------
  // Create a rule set
  // -----------------------------------------------------------------------

  async createSet(data: CreateSetInput): Promise<RuleSet> {
    const [created] = await db
      .insert(ruleSets)
      .values({
        name: data.name,
        description: data.description ?? null,
        industry: data.industry ?? null,
        agentId: data.agentId ?? null,
        organizationId: data.organizationId ?? null,
        isActive: data.isActive ?? true,
      })
      .returning();

    return created;
  }

  // -----------------------------------------------------------------------
  // Get a single rule set with its rules
  // -----------------------------------------------------------------------

  async getSet(id: string): Promise<RuleSetWithRules | null> {
    const set = await db.query.ruleSets.findFirst({
      where: eq(ruleSets.id, id),
      with: {
        rules: {
          orderBy: asc(ruleItems.sortOrder),
        },
      },
    });

    return (set as RuleSetWithRules) ?? null;
  }

  // -----------------------------------------------------------------------
  // Update a rule set
  // -----------------------------------------------------------------------

  async updateSet(id: string, data: UpdateSetInput): Promise<RuleSet> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.industry !== undefined) updates.industry = data.industry;
    if (data.agentId !== undefined) updates.agentId = data.agentId;
    if (data.organizationId !== undefined) updates.organizationId = data.organizationId;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    const [updated] = await db
      .update(ruleSets)
      .set(updates)
      .where(eq(ruleSets.id, id))
      .returning();

    return updated;
  }

  // -----------------------------------------------------------------------
  // Delete a rule set (cascade deletes rules)
  // -----------------------------------------------------------------------

  async deleteSet(id: string): Promise<void> {
    await db
      .delete(ruleSets)
      .where(eq(ruleSets.id, id));
  }

  // -----------------------------------------------------------------------
  // Add a rule to a rule set
  // -----------------------------------------------------------------------

  async addRule(setId: string, data: AddRuleInput): Promise<RuleItem> {
    // Verify the rule set exists
    const set = await db.query.ruleSets.findFirst({
      where: eq(ruleSets.id, setId),
    });

    if (!set) {
      throw new Error(`Rule set not found: ${setId}`);
    }

    const [created] = await db
      .insert(ruleItems)
      .values({
        ruleSetId: setId,
        ruleNo: data.ruleNo,
        name: data.name,
        detectionType: data.detectionType ?? null,
        severity: data.severity,
        description: data.description,
        parameters: data.parameters ?? null,
        isEnabled: data.isEnabled ?? true,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    return created;
  }

  // -----------------------------------------------------------------------
  // Update a rule item
  // -----------------------------------------------------------------------

  async updateRule(ruleId: string, data: UpdateRuleInput): Promise<RuleItem> {
    const updates: Record<string, unknown> = {};

    if (data.ruleNo !== undefined) updates.ruleNo = data.ruleNo;
    if (data.name !== undefined) updates.name = data.name;
    if (data.detectionType !== undefined) updates.detectionType = data.detectionType;
    if (data.severity !== undefined) updates.severity = data.severity;
    if (data.description !== undefined) updates.description = data.description;
    if (data.parameters !== undefined) updates.parameters = data.parameters;
    if (data.isEnabled !== undefined) updates.isEnabled = data.isEnabled;
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;

    const [updated] = await db
      .update(ruleItems)
      .set(updates)
      .where(eq(ruleItems.id, ruleId))
      .returning();

    return updated;
  }

  // -----------------------------------------------------------------------
  // Delete a rule item
  // -----------------------------------------------------------------------

  async deleteRule(ruleId: string): Promise<void> {
    await db
      .delete(ruleItems)
      .where(eq(ruleItems.id, ruleId));
  }

  // -----------------------------------------------------------------------
  // Toggle rule enabled/disabled
  // -----------------------------------------------------------------------

  async toggleRule(ruleId: string, enabled: boolean): Promise<void> {
    await db
      .update(ruleItems)
      .set({ isEnabled: enabled })
      .where(eq(ruleItems.id, ruleId));
  }

  // -----------------------------------------------------------------------
  // Get active rules for a given agent key (runtime call)
  // Used during review to load applicable rules for an agent.
  // -----------------------------------------------------------------------

  async getActiveRulesForAgent(agentKey: string): Promise<RuleItem[]> {
    // Find the agent definition by key
    const agent = await db.query.agentDefinitions.findFirst({
      where: eq(agentDefinitions.agentKey, agentKey),
    });

    if (!agent) return [];

    // Find active rule sets bound to this agent
    const activeSets = await db
      .select({ id: ruleSets.id })
      .from(ruleSets)
      .where(
        and(
          eq(ruleSets.agentId, agent.id),
          eq(ruleSets.isActive, true),
        ),
      );

    if (activeSets.length === 0) return [];

    // Collect all enabled rules from those sets, ordered by sortOrder
    const setIds = activeSets.map((s) => s.id);

    const allRules: RuleItem[] = [];

    for (const setId of setIds) {
      const rules = await db
        .select()
        .from(ruleItems)
        .where(
          and(
            eq(ruleItems.ruleSetId, setId),
            eq(ruleItems.isEnabled, true),
          ),
        )
        .orderBy(asc(ruleItems.sortOrder));

      allRules.push(...rules);
    }

    return allRules;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const ruleService = new RuleService();
