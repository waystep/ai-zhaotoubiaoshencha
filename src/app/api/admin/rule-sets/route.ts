/**
 * Rule Set Collection Endpoints
 *
 * GET  /api/admin/rule-sets   — List rule sets
 * POST /api/admin/rule-sets   — Create a rule set
 *
 * All endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { ruleSets, ruleItems, agentDefinitions } from "@/lib/db/schema";
import { ruleService } from "@/lib/services/rule-service";
import type { CreateSetInput } from "@/lib/services/rule-service";

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
// GET — List rule sets
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") ?? undefined;

    const sets = await ruleService.listSets(organizationId);

    // Fetch rule counts per set
    const ruleCounts = await db
      .select({
        ruleSetId: ruleItems.ruleSetId,
        count: sql<number>`count(*)::int`,
      })
      .from(ruleItems)
      .groupBy(ruleItems.ruleSetId);

    const countMap = new Map<string, number>();
    for (const rc of ruleCounts) {
      countMap.set(rc.ruleSetId, rc.count);
    }

    // Fetch agent names for all referenced agents
    const agentIds = [...new Set(sets.map((s) => s.agentId).filter(Boolean))] as string[];
    const agentMap = new Map<string, { agentKey: string; name: string }>();

    if (agentIds.length > 0) {
      const agents = await db
        .select({ id: agentDefinitions.id, agentKey: agentDefinitions.agentKey, name: agentDefinitions.name })
        .from(agentDefinitions)
        .where(sql`${agentDefinitions.id} IN ${agentIds}`);

      for (const a of agents) {
        agentMap.set(a.id, { agentKey: a.agentKey, name: a.name });
      }
    }

    // Enrich the response
    const enriched = sets.map((s) => ({
      ...s,
      ruleCount: countMap.get(s.id) ?? 0,
      agentName: s.agentId ? (agentMap.get(s.agentId)?.name ?? null) : null,
      agentKey: s.agentId ? (agentMap.get(s.agentId)?.agentKey ?? null) : null,
    }));

    return NextResponse.json({ data: enriched });
  } catch (error) {
    console.error("[rule-sets] GET /api/admin/rule-sets error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rule sets" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create rule set
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  try {
    const body: Partial<CreateSetInput> = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const created = await ruleService.createSet({
      name: body.name!.trim(),
      description: body.description,
      industry: body.industry,
      agentId: body.agentId,
      organizationId: body.organizationId,
      isActive: body.isActive,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("[rule-sets] POST /api/admin/rule-sets error:", error);
    return NextResponse.json(
      { error: "Failed to create rule set" },
      { status: 500 },
    );
  }
}
