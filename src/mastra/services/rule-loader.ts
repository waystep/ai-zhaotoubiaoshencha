/**
 * Rule Loader
 *
 * Resolves the active rule set and rule items for an agent at runtime.
 *
 * Resolution path:
 *   1. Read agentDefinitions.defaultConfig.ruleSetId.
 *   2. Join ruleSets (must be active) → ruleItems (must be enabled).
 *   3. Return ordered list of applicable rules.
 */

import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  agentDefinitions,
  ruleSets,
  ruleItems,
} from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RuleItem = InferSelectModel<typeof ruleItems>;

export interface ResolvedRuleItem {
  id: string;
  ruleNo: string;
  name: string;
  detectionType: string | null;
  severity: string;
  description: string;
  parameters: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class RuleLoader {
  /**
   * Resolve all active rules for a given agent.
   *
   * Two resolution strategies:
   *   a) If defaultConfig.ruleSetId is set → load that specific rule set.
   *   b) Otherwise → load all active rule sets whose agentId matches
   *      the agent definition (fallback, matches RuleService.getActiveRulesForAgent).
   */
  async resolve(
    agentKey: string,
    orgId?: string,
  ): Promise<ResolvedRuleItem[]> {
    const agent = await this.findAgent(agentKey, orgId);
    if (!agent) return [];

    const defaultConfig = agent.defaultConfig as Record<string, unknown> ?? {};
    const ruleSetId = defaultConfig.ruleSetId as string | undefined;

    if (ruleSetId) {
      // Strategy A: specific rule set from config
      return this.loadRulesFromSet(ruleSetId);
    }

    // Strategy B: all active rule sets bound to this agent
    return this.loadRulesFromAgentId(agent.id);
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

  private async loadRulesFromSet(
    setId: string,
  ): Promise<ResolvedRuleItem[]> {
    // Verify the rule set is active
    const [set] = await db
      .select({ id: ruleSets.id })
      .from(ruleSets)
      .where(
        and(
          eq(ruleSets.id, setId),
          eq(ruleSets.isActive, true),
        ),
      )
      .limit(1);

    if (!set) return [];

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

    return rules.map((r) => this.toResolved(r));
  }

  private async loadRulesFromAgentId(
    agentId: string,
  ): Promise<ResolvedRuleItem[]> {
    // Find active rule sets for this agent
    const activeSets = await db
      .select({ id: ruleSets.id })
      .from(ruleSets)
      .where(
        and(
          eq(ruleSets.agentId, agentId),
          eq(ruleSets.isActive, true),
        ),
      );

    if (activeSets.length === 0) return [];

    const allRules: ResolvedRuleItem[] = [];

    for (const set of activeSets) {
      const rules = await db
        .select()
        .from(ruleItems)
        .where(
          and(
            eq(ruleItems.ruleSetId, set.id),
            eq(ruleItems.isEnabled, true),
          ),
        )
        .orderBy(asc(ruleItems.sortOrder));

      allRules.push(...rules.map((r) => this.toResolved(r)));
    }

    return allRules;
  }

  private toResolved(r: RuleItem): ResolvedRuleItem {
    return {
      id: r.id,
      ruleNo: r.ruleNo,
      name: r.name,
      detectionType: r.detectionType,
      severity: r.severity,
      description: r.description,
      parameters: r.parameters as Record<string, unknown> | null,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const ruleLoader = new RuleLoader();
