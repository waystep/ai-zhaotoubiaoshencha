/**
 * Single Rule Set Operations
 *
 * GET    /api/admin/rule-sets/:id   — Get rule set detail with rules
 * PUT    /api/admin/rule-sets/:id   — Update rule set
 * DELETE /api/admin/rule-sets/:id   — Delete rule set (cascade deletes rules)
 *
 * All endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { ruleService } from "@/lib/services/rule-service";
import type { UpdateSetInput } from "@/lib/services/rule-service";

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
// GET — Get rule set with rules
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    const set = await ruleService.getSet(id);

    if (!set) {
      return NextResponse.json(
        { error: "Rule set not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: set });
  } catch (error) {
    console.error("[rule-sets] GET /api/admin/rule-sets/:id error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rule set" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Update rule set
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    const existing = await ruleService.getSet(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Rule set not found" },
        { status: 404 },
      );
    }

    const body = await request.json();

    const updates: UpdateSetInput = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description;
    }

    if (body.industry !== undefined) {
      updates.industry = body.industry;
    }

    if (body.agentId !== undefined) {
      updates.agentId = body.agentId;
    }

    if (body.organizationId !== undefined) {
      updates.organizationId = body.organizationId;
    }

    if (body.isActive !== undefined) {
      updates.isActive = Boolean(body.isActive);
    }

    const updated = await ruleService.updateSet(id, updates);

    // Re-fetch with rules for the response
    const refreshed = await ruleService.getSet(id);

    return NextResponse.json({ data: refreshed });
  } catch (error) {
    console.error("[rule-sets] PUT /api/admin/rule-sets/:id error:", error);
    return NextResponse.json(
      { error: "Failed to update rule set" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete rule set
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    const existing = await ruleService.getSet(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Rule set not found" },
        { status: 404 },
      );
    }

    await ruleService.deleteSet(id);

    return NextResponse.json({ data: { deleted: true, id } });
  } catch (error) {
    console.error("[rule-sets] DELETE /api/admin/rule-sets/:id error:", error);
    return NextResponse.json(
      { error: "Failed to delete rule set" },
      { status: 500 },
    );
  }
}
