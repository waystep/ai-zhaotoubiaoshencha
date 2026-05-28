/**
 * Rule Set Collection Endpoints
 *
 * GET  /api/admin/rule-sets   — List rule sets
 * POST /api/admin/rule-sets   — Create a rule set
 *
 * All endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
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

    return NextResponse.json({ data: sets });
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
