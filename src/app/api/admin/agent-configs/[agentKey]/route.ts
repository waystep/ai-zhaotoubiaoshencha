/**
 * Agent Configuration Detail API
 *
 * GET  /api/admin/agent-configs/[agentKey]  — Single agent config detail
 * PUT  /api/admin/agent-configs/[agentKey]  — Update config (knowledge bases, rule set, params)
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
// GET — Single agent config detail
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentKey: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  try {
    const { agentKey } = await params;
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("organizationId");

    if (!orgId) {
      return NextResponse.json(
        { error: "organizationId query parameter is required" },
        { status: 400 },
      );
    }

    // 1. Find the agent definition
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
      return NextResponse.json(
        { error: `Agent not found: ${agentKey}` },
        { status: 404 },
      );
    }

    // 2. Get primary model binding
    const [bindingRow] = await db
      .select({
        binding: agentModelBindings,
        model: aiModels,
      })
      .from(agentModelBindings)
      .innerJoin(aiModels, eq(agentModelBindings.modelId, aiModels.id))
      .where(
        and(
          eq(agentModelBindings.agentId, agent.id),
          eq(agentModelBindings.organizationId, orgId),
          eq(agentModelBindings.isPrimary, true),
        ),
      )
      .limit(1);

    const model = bindingRow
      ? {
          id: bindingRow.model.id,
          name: bindingRow.model.name,
          provider: bindingRow.model.provider,
          modelType: bindingRow.model.modelType,
        }
      : null;

    // 3. Parse defaultConfig and resolve references
    const defaultConfig = (agent.defaultConfig as Record<string, unknown>) ?? {};

    // Resolve knowledge bases
    const knowledgeBaseIds = (defaultConfig.knowledgeBaseIds as string[]) ?? [];
    let resolvedKBs: { id: string; name: string; type: string }[] = [];

    if (knowledgeBaseIds.length > 0) {
      const kbs = await db
        .select()
        .from(knowledgeBases)
        .where(eq(knowledgeBases.organizationId, orgId));

      const kbLookup = new Map(kbs.map((kb) => [kb.id, kb]));
      resolvedKBs = knowledgeBaseIds
        .map((id) => {
          const kb = kbLookup.get(id);
          return kb ? { id: kb.id, name: kb.name, type: kb.type } : null;
        })
        .filter(Boolean) as { id: string; name: string; type: string }[];
    }

    // Resolve rule set
    const ruleSetId = (defaultConfig.ruleSetId as string) ?? null;
    let resolvedRuleSet: { id: string; name: string; ruleCount: number } | null = null;

    if (ruleSetId) {
      const [rs] = await db
        .select()
        .from(ruleSets)
        .where(eq(ruleSets.id, ruleSetId))
        .limit(1);

      if (rs) {
        // Get rule count
        const rules = await db
          .select({ id: ruleItems.id })
          .from(ruleItems)
          .where(eq(ruleItems.ruleSetId, rs.id));

        resolvedRuleSet = {
          id: rs.id,
          name: rs.name,
          ruleCount: rules.length,
        };
      }
    }

    // Custom config
    const customConfig = (defaultConfig.customConfig as Record<string, unknown>) ?? {
      temperature: 0.1,
      maxTokens: 4096,
    };

    return NextResponse.json({
      data: {
        agentKey: agent.agentKey,
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        category: agent.category,
        model,
        knowledgeBases: resolvedKBs,
        ruleSet: resolvedRuleSet,
        customConfig,
      },
    });
  } catch (error) {
    console.error("[agent-configs] GET /[agentKey] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent configuration" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Update agent config (knowledge bases, rule set, params)
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ agentKey: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  try {
    const { agentKey } = await params;
    const body = await request.json();

    const { organizationId, knowledgeBaseIds, ruleSetId, customConfig } = body as {
      organizationId?: string;
      knowledgeBaseIds?: string[];
      ruleSetId?: string | null;
      customConfig?: Record<string, unknown>;
    };

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    // Find the agent definition
    const [agent] = await db
      .select()
      .from(agentDefinitions)
      .where(
        and(
          eq(agentDefinitions.agentKey, agentKey),
          eq(agentDefinitions.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!agent) {
      return NextResponse.json(
        { error: `Agent not found: ${agentKey}` },
        { status: 404 },
      );
    }

    // Validate knowledge base IDs if provided
    if (knowledgeBaseIds !== undefined) {
      if (!Array.isArray(knowledgeBaseIds)) {
        return NextResponse.json(
          { error: "knowledgeBaseIds must be an array" },
          { status: 400 },
        );
      }
      // Verify each KB exists
      for (const kbId of knowledgeBaseIds) {
        if (typeof kbId !== "string") {
          return NextResponse.json(
            { error: "Each knowledgeBaseId must be a string" },
            { status: 400 },
          );
        }
        const [kb] = await db
          .select({ id: knowledgeBases.id })
          .from(knowledgeBases)
          .where(
            and(
              eq(knowledgeBases.id, kbId),
              eq(knowledgeBases.organizationId, organizationId),
            ),
          )
          .limit(1);

        if (!kb) {
          return NextResponse.json(
            { error: `Knowledge base not found: ${kbId}` },
            { status: 400 },
          );
        }
      }
    }

    // Validate rule set ID if provided (null is allowed to clear binding)
    if (ruleSetId !== undefined && ruleSetId !== null) {
      if (typeof ruleSetId !== "string") {
        return NextResponse.json(
          { error: "ruleSetId must be a string or null" },
          { status: 400 },
        );
      }
      const [rs] = await db
        .select({ id: ruleSets.id })
        .from(ruleSets)
        .where(eq(ruleSets.id, ruleSetId))
        .limit(1);

      if (!rs) {
        return NextResponse.json(
          { error: `Rule set not found: ${ruleSetId}` },
          { status: 400 },
        );
      }
    }

    // Validate customConfig if provided
    if (customConfig !== undefined) {
      if (typeof customConfig !== "object" || customConfig === null) {
        return NextResponse.json(
          { error: "customConfig must be an object" },
          { status: 400 },
        );
      }
    }

    // Build updated defaultConfig by merging with existing
    const existingConfig = (agent.defaultConfig as Record<string, unknown>) ?? {};

    const updatedConfig: Record<string, unknown> = {
      ...existingConfig,
    };

    if (knowledgeBaseIds !== undefined) {
      updatedConfig.knowledgeBaseIds = knowledgeBaseIds;
    }

    if (ruleSetId !== undefined) {
      updatedConfig.ruleSetId = ruleSetId;
    }

    if (customConfig !== undefined) {
      updatedConfig.customConfig = customConfig;
    }

    // Update the agent definition
    await db
      .update(agentDefinitions)
      .set({ defaultConfig: updatedConfig })
      .where(eq(agentDefinitions.id, agent.id));

    // Return the updated config by re-fetching (reuse GET logic)
    const refreshedConfig = (updatedConfig) as Record<string, unknown>;

    // Resolve knowledge bases for response
    const kbIds = (refreshedConfig.knowledgeBaseIds as string[]) ?? [];
    let resolvedKBs: { id: string; name: string; type: string }[] = [];
    if (kbIds.length > 0) {
      const kbs = await db
        .select()
        .from(knowledgeBases)
        .where(eq(knowledgeBases.organizationId, organizationId));
      const kbLookup = new Map(kbs.map((kb) => [kb.id, kb]));
      resolvedKBs = kbIds
        .map((id) => {
          const kb = kbLookup.get(id);
          return kb ? { id: kb.id, name: kb.name, type: kb.type } : null;
        })
        .filter(Boolean) as { id: string; name: string; type: string }[];
    }

    // Resolve rule set for response
    const rsId = (refreshedConfig.ruleSetId as string) ?? null;
    let resolvedRuleSet: { id: string; name: string; ruleCount: number } | null = null;
    if (rsId) {
      const [rs] = await db
        .select()
        .from(ruleSets)
        .where(eq(ruleSets.id, rsId))
        .limit(1);
      if (rs) {
        const rules = await db
          .select({ id: ruleItems.id })
          .from(ruleItems)
          .where(eq(ruleItems.ruleSetId, rs.id));
        resolvedRuleSet = { id: rs.id, name: rs.name, ruleCount: rules.length };
      }
    }

    // Get current model
    const [bindingRow] = await db
      .select({
        model: aiModels,
      })
      .from(agentModelBindings)
      .innerJoin(aiModels, eq(agentModelBindings.modelId, aiModels.id))
      .where(
        and(
          eq(agentModelBindings.agentId, agent.id),
          eq(agentModelBindings.organizationId, organizationId),
          eq(agentModelBindings.isPrimary, true),
        ),
      )
      .limit(1);

    return NextResponse.json({
      data: {
        agentKey: agent.agentKey,
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        category: agent.category,
        model: bindingRow
          ? {
              id: bindingRow.model.id,
              name: bindingRow.model.name,
              provider: bindingRow.model.provider,
              modelType: bindingRow.model.modelType,
            }
          : null,
        knowledgeBases: resolvedKBs,
        ruleSet: resolvedRuleSet,
        customConfig: (refreshedConfig.customConfig as Record<string, unknown>) ?? {
          temperature: 0.1,
          maxTokens: 4096,
        },
      },
    });
  } catch (error) {
    console.error("[agent-configs] PUT /[agentKey] error:", error);
    return NextResponse.json(
      { error: "Failed to update agent configuration" },
      { status: 500 },
    );
  }
}
