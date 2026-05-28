/**
 * Preset Modes REST API — Collection endpoints
 *
 * GET  /api/admin/preset-modes           — List preset modes
 * POST /api/admin/preset-modes           — Create a preset mode
 * POST /api/admin/preset-modes/seed      — Seed default preset modes
 *
 * All endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { agentBindingService } from "@/lib/services/agent-binding-service";
import type { SeedModelIds } from "@/lib/services/agent-binding-service";

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
// GET — List preset modes
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

    const modes = await agentBindingService.listPresetModes(orgId);

    return NextResponse.json({ data: modes });
  } catch (error) {
    console.error("[preset-modes] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch preset modes" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create a preset mode (or seed defaults)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  try {
    const body = await request.json();

    // Handle seed request
    if (body.action === "seed") {
      const { organizationId, modelIds } = body as {
        organizationId?: string;
        modelIds?: SeedModelIds;
      };

      if (!organizationId) {
        return NextResponse.json(
          { error: "organizationId is required for seeding" },
          { status: 400 },
        );
      }

      if (!modelIds || !modelIds.local27b || !modelIds.vl7b || !modelIds.glm51 || !modelIds.deepseekV4) {
        return NextResponse.json(
          { error: "modelIds must include: local27b, vl7b, glm51, deepseekV4" },
          { status: 400 },
        );
      }

      await agentBindingService.seedPresetModes(organizationId, modelIds);

      const modes = await agentBindingService.listPresetModes(organizationId);

      return NextResponse.json({ data: modes }, { status: 201 });
    }

    // Handle normal create request
    const { organizationId, name, description, bindings } = body as {
      organizationId?: string;
      name?: string;
      description?: string;
      bindings?: Record<string, string>;
    };

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      );
    }

    if (!bindings || typeof bindings !== "object" || Object.keys(bindings).length === 0) {
      return NextResponse.json(
        { error: "bindings must be a non-empty object mapping agentKey to modelId" },
        { status: 400 },
      );
    }

    const created = await agentBindingService.createPresetMode(
      name.trim(),
      description ?? null,
      bindings,
      organizationId,
    );

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("[preset-modes] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create preset mode" },
      { status: 500 },
    );
  }
}
