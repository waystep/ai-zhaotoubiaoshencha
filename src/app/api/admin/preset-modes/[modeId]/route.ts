/**
 * Single Preset Mode Operations + Activate
 *
 * POST   /api/admin/preset-modes/:modeId/activate  — Activate a preset mode
 * GET    /api/admin/preset-modes/:modeId            — Get single preset mode
 * DELETE /api/admin/preset-modes/:modeId            — Delete a preset mode
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
// GET — Get single preset mode
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ modeId: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { modeId } = await params;

  try {
    const { searchParams } = new URL(_request.url);
    const orgId = searchParams.get("organizationId");

    if (!orgId) {
      return NextResponse.json(
        { error: "organizationId query parameter is required" },
        { status: 400 },
      );
    }

    const mode = await agentBindingService.getPresetModeById(modeId, orgId);

    if (!mode) {
      return NextResponse.json(
        { error: "Preset mode not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: mode });
  } catch (error) {
    console.error("[preset-modes] GET /:modeId error:", error);
    return NextResponse.json(
      { error: "Failed to fetch preset mode" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Activate a preset mode
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ modeId: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { modeId } = await params;

  try {
    const body = await request.json();
    const { organizationId } = body as { organizationId?: string };

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "organizationId is required in request body" },
        { status: 400 },
      );
    }

    await agentBindingService.activatePresetMode(modeId, organizationId);

    // Return the updated preset modes and the new agent bindings
    const [modes, bindings] = await Promise.all([
      agentBindingService.listPresetModes(organizationId),
      agentBindingService.listBindingsWithModels(organizationId),
    ]);

    return NextResponse.json({
      data: {
        activeModeId: modeId,
        presetModes: modes,
        agentBindings: bindings,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to activate preset mode";
    console.error("[preset-modes] POST /:modeId/activate error:", error);

    // Return 404 if the mode wasn't found
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to activate preset mode" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete a preset mode
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ modeId: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { modeId } = await params;

  try {
    const { searchParams } = new URL(_request.url);
    const orgId = searchParams.get("organizationId");

    if (!orgId) {
      return NextResponse.json(
        { error: "organizationId query parameter is required" },
        { status: 400 },
      );
    }

    // Verify the mode exists
    const mode = await agentBindingService.getPresetModeById(modeId, orgId);

    if (!mode) {
      return NextResponse.json(
        { error: "Preset mode not found" },
        { status: 404 },
      );
    }

    await agentBindingService.deletePresetMode(modeId, orgId);

    return NextResponse.json({ data: { deleted: true, id: modeId } });
  } catch (error) {
    console.error("[preset-modes] DELETE /:modeId error:", error);
    return NextResponse.json(
      { error: "Failed to delete preset mode" },
      { status: 500 },
    );
  }
}
