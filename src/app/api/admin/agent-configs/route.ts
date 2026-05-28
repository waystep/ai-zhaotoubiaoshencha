/**
 * Agent Configuration Collection API
 *
 * GET  /api/admin/agent-configs  — All agents full config (model + knowledge bases + rule set + params)
 *
 * Requires system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import {
  agentDefinitions,
  agentModelBindings,
  aiModels,
  knowledgeBases,
  ruleSets,
  ruleItems,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Helper: require system_admin
// ---------------------------------------------------------------------------

async function requireSystemAdmin() {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (session.user.role !== "system_admin") {
    return { error: NextResponse.json({ error: "Forbidden: system_admin required" }, { status: 403 }) };
  }

  return { session };
}

// ---------------------------------------------------------------------------
// GET — All agents full config
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("organizationId");

    if (!orgId) {
      return NextResponse.json(
        { error: "organizationId query parameter is required" },
        { status: 400 },
      );
    }

    // 1. Fetch all agent definitions for this org
    const agents = await db
      .select()
      .from(agentDefinitions)
      .where(eq(agentDefinitions.organizationId, orgId))
      .orderBy(agentDefinitions.agentKey);

    if (agents.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 2. Fetch all primary model bindings for this org
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

    // Build lookup: agentId -> model
    const modelMap = new Map<string, { id: string; name: string; provider: string; modelType: string }>();
    for (const row of bindings) {
      modelMap.set(row.binding.agentId, {
        id: row.model.id,
        name: row.model.name,
        provider: row.model.provider,
        modelType: row.model.modelType,
      });
    }

    // 3. Fetch all knowledge bases for this org (for resolution)
    const allKnowledgeBases = await db
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.organizationId, orgId));

    const kbMap = new Map<string, { id: string; name: string; type: string }>();
    for (const kb of allKnowledgeBases) {
      kbMap.set(kb.id, { id: kb.id, name: kb.name, type: kb.type });
    }

    // 4. Fetch all rule sets for this org (with rule counts)
    const allRuleSets = await db
      .select()
      .from(ruleSets)
      .where(eq(ruleSets.organizationId, orgId));

    // Get rule counts per set
    const ruleCounts = await db
      .select({
        ruleSetId: ruleItems.ruleSetId,
        count: ruleItems.id,
      })
      .from(ruleItems)
      .innerJoin(ruleSets, eq(ruleItems.ruleSetId, ruleSets.id))
      .where(eq(ruleSets.organizationId, orgId));

    // Build lookup: ruleSetId -> count
    const ruleCountMap = new Map<string, number>();
    for (const rc of ruleCounts) {
      ruleCountMap.set(rc.ruleSetId, (ruleCountMap.get(rc.ruleSetId) ?? 0) + 1);
    }

    // Build lookup: ruleSetId -> rule set info
    const rsMap = new Map<string, { id: string; name: string; ruleCount: number }>();
    for (const rs of allRuleSets) {
      rsMap.set(rs.id, {
        id: rs.id,
        name: rs.name,
        ruleCount: ruleCountMap.get(rs.id) ?? 0,
      });
    }

    // 5. Assemble full configs
    const configs = agents.map((agent) => {
      // Parse defaultConfig JSONB
      const defaultConfig = (agent.defaultConfig as Record<string, unknown>) ?? {};

      // Resolve knowledge bases
      const knowledgeBaseIds = (defaultConfig.knowledgeBaseIds as string[]) ?? [];
      const resolvedKBs = knowledgeBaseIds
        .map((id) => kbMap.get(id))
        .filter(Boolean) as { id: string; name: string; type: string }[];

      // Resolve rule set
      const ruleSetId = (defaultConfig.ruleSetId as string) ?? null;
      const resolvedRuleSet = ruleSetId ? (rsMap.get(ruleSetId) ?? null) : null;

      // Get custom config (temperature, maxTokens, etc.)
      const customConfig = (defaultConfig.customConfig as Record<string, unknown>) ?? {
        temperature: 0.1,
        maxTokens: 4096,
      };

      return {
        agentKey: agent.agentKey,
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        category: agent.category,
        model: modelMap.get(agent.id) ?? null,
        knowledgeBases: resolvedKBs,
        ruleSet: resolvedRuleSet,
        customConfig,
      };
    });

    return NextResponse.json({ data: configs });
  } catch (error) {
    console.error("[agent-configs] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent configurations" },
      { status: 500 },
    );
  }
}
