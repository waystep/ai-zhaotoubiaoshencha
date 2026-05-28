/**
 * Semantic search within a knowledge base
 *
 * POST /api/admin/knowledge-bases/:id/search
 * Body: { query: string, topK?: number }
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
// POST — Semantic search
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id: baseId } = await params;

  try {
    const body = await request.json();

    if (!body.query || typeof body.query !== "string" || body.query.trim().length === 0) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 },
      );
    }

    const topK = Math.min(100, Math.max(1, body.topK ?? 5));

    const results = await knowledgeService.search(baseId, body.query.trim(), topK);

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("[knowledge-bases] POST /:id/search error:", error);
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
