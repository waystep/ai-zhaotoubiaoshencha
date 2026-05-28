/**
 * Agent Model Bindings REST API
 *
 * GET  /api/admin/agent-bindings  — List all agents + current model bindings
 * PUT  /api/admin/agent-bindings  — Batch update bindings { agentKey: { modelId, isPrimary } }
 *
 * All endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { agentBindingService } from "@/lib/services/agent-binding-service";

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
// GET — List all agents with current model bindings
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

    const bindings = await agentBindingService.listBindingsWithModels(orgId);

    return NextResponse.json({ data: bindings });
  } catch (error) {
    console.error("[agent-bindings] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent bindings" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Batch update bindings
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  try {
    const body = await request.json();

    const { organizationId, updates } = body as {
      organizationId?: string;
      updates?: Record<string, { modelId: string; isPrimary: boolean }>;
    };

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "updates must be a non-empty object mapping agentKey to { modelId, isPrimary }" },
        { status: 400 },
      );
    }

    // Validate each entry
    for (const [agentKey, config] of Object.entries(updates)) {
      if (!config.modelId || typeof config.modelId !== "string") {
        return NextResponse.json(
          { error: `Invalid modelId for agent "${agentKey}"` },
          { status: 400 },
        );
      }
      if (typeof config.isPrimary !== "boolean") {
        return NextResponse.json(
          { error: `isPrimary must be boolean for agent "${agentKey}"` },
          { status: 400 },
        );
      }
    }

    await agentBindingService.batchSetBindings(updates, organizationId);

    // Return updated bindings
    const refreshed = await agentBindingService.listBindingsWithModels(organizationId);

    return NextResponse.json({ data: refreshed });
  } catch (error) {
    console.error("[agent-bindings] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update agent bindings" },
      { status: 500 },
    );
  }
}
