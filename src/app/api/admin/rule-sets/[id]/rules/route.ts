/**
 * Rule Item Collection Endpoints
 *
 * POST /api/admin/rule-sets/:id/rules   — Add a rule to a rule set
 *
 * All endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { ruleService } from "@/lib/services/rule-service";
import type { AddRuleInput } from "@/lib/services/rule-service";

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
// POST — Add rule to set
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id: setId } = await params;

  try {
    const body: Partial<AddRuleInput> = await request.json();

    // Validate required fields
    if (!body.ruleNo || typeof body.ruleNo !== "string" || body.ruleNo.trim().length === 0) {
      return NextResponse.json({ error: "ruleNo is required" }, { status: 400 });
    }

    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (!body.severity || typeof body.severity !== "string" || body.severity.trim().length === 0) {
      return NextResponse.json({ error: "severity is required" }, { status: 400 });
    }

    if (!body.description || typeof body.description !== "string" || body.description.trim().length === 0) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    // Validate detectionType if provided
    const validDetectionTypes = ["keyword", "comparison", "semantic", "existence"];
    if (body.detectionType && !validDetectionTypes.includes(body.detectionType)) {
      return NextResponse.json(
        { error: `detectionType must be one of: ${validDetectionTypes.join(", ")}` },
        { status: 400 },
      );
    }

    const created = await ruleService.addRule(setId, {
      ruleNo: body.ruleNo!.trim(),
      name: body.name!.trim(),
      detectionType: body.detectionType,
      severity: body.severity!.trim(),
      description: body.description!.trim(),
      parameters: body.parameters,
      isEnabled: body.isEnabled,
      sortOrder: body.sortOrder,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    // Handle known business errors
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("[rule-sets] POST /api/admin/rule-sets/:id/rules error:", error);
    return NextResponse.json(
      { error: "Failed to add rule" },
      { status: 500 },
    );
  }
}
