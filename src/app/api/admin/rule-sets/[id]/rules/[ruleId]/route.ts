/**
 * Single Rule Item Operations
 *
 * PUT    /api/admin/rule-sets/:id/rules/:ruleId   — Update a rule
 * DELETE /api/admin/rule-sets/:id/rules/:ruleId   — Delete a rule
 *
 * All endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { ruleService } from "@/lib/services/rule-service";
import type { UpdateRuleInput } from "@/lib/services/rule-service";

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
// PUT — Update rule
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id: _setId, ruleId } = await params;

  try {
    const body = await request.json();

    const updates: UpdateRuleInput = {};

    if (body.ruleNo !== undefined) {
      if (typeof body.ruleNo !== "string" || body.ruleNo.trim().length === 0) {
        return NextResponse.json({ error: "ruleNo must be a non-empty string" }, { status: 400 });
      }
      updates.ruleNo = body.ruleNo.trim();
    }

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.detectionType !== undefined) {
      const validDetectionTypes = ["keyword", "comparison", "semantic", "existence"];
      if (body.detectionType && !validDetectionTypes.includes(body.detectionType)) {
        return NextResponse.json(
          { error: `detectionType must be one of: ${validDetectionTypes.join(", ")}` },
          { status: 400 },
        );
      }
      updates.detectionType = body.detectionType;
    }

    if (body.severity !== undefined) {
      if (typeof body.severity !== "string" || body.severity.trim().length === 0) {
        return NextResponse.json({ error: "severity must be a non-empty string" }, { status: 400 });
      }
      updates.severity = body.severity.trim();
    }

    if (body.description !== undefined) {
      if (typeof body.description !== "string" || body.description.trim().length === 0) {
        return NextResponse.json({ error: "description must be a non-empty string" }, { status: 400 });
      }
      updates.description = body.description.trim();
    }

    if (body.parameters !== undefined) {
      updates.parameters = body.parameters;
    }

    if (body.isEnabled !== undefined) {
      updates.isEnabled = Boolean(body.isEnabled);
    }

    if (body.sortOrder !== undefined) {
      if (typeof body.sortOrder !== "number") {
        return NextResponse.json({ error: "sortOrder must be a number" }, { status: 400 });
      }
      updates.sortOrder = body.sortOrder;
    }

    const updated = await ruleService.updateRule(ruleId, updates);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[rule-sets] PUT /api/admin/rule-sets/:id/rules/:ruleId error:", error);
    return NextResponse.json(
      { error: "Failed to update rule" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete rule
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id: _setId, ruleId } = await params;

  try {
    await ruleService.deleteRule(ruleId);

    return NextResponse.json({ data: { deleted: true, id: ruleId } });
  } catch (error) {
    console.error("[rule-sets] DELETE /api/admin/rule-sets/:id/rules/:ruleId error:", error);
    return NextResponse.json(
      { error: "Failed to delete rule" },
      { status: 500 },
    );
  }
}
