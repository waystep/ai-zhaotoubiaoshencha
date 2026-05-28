/**
 * Trigger vectorization for a single knowledge item
 *
 * POST /api/admin/knowledge-bases/:id/items/:itemId/vectorize
 *
 * Requires system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { knowledgeService } from "@/lib/services/knowledge-service";

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
// POST — Trigger vectorization
// ---------------------------------------------------------------------------

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { itemId } = await params;

  try {
    const existing = await knowledgeService.getItem(itemId);

    if (!existing) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 },
      );
    }

    const result = await knowledgeService.vectorizeItem(itemId);

    return NextResponse.json({
      data: {
        itemId,
        vectorized: true,
        chunks: result.chunks,
      },
    });
  } catch (error) {
    console.error("[knowledge-bases] POST /:id/items/:itemId/vectorize error:", error);
    const message = error instanceof Error ? error.message : "Vectorization failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
