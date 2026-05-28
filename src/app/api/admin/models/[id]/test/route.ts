/**
 * Test Model Connection
 *
 * POST /api/admin/models/:id/test  — Test connectivity to the model endpoint
 *
 * Requires system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { modelService } from "@/lib/services/model-service";

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
// POST — Test connection
// ---------------------------------------------------------------------------

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    const result = await modelService.testConnection(id);

    if (!result.ok) {
      return NextResponse.json({
        data: {
          ok: false,
          latencyMs: result.latencyMs,
          error: result.error,
        },
      });
    }

    return NextResponse.json({
      data: {
        ok: true,
        latencyMs: result.latencyMs,
      },
    });
  } catch (error) {
    console.error("[models] POST /api/admin/models/:id/test error:", error);
    return NextResponse.json(
      { error: "Failed to test model connection" },
      { status: 500 },
    );
  }
}
