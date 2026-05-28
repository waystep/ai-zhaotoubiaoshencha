/**
 * Knowledge Base Items — Collection endpoints
 *
 * GET  /api/admin/knowledge-bases/:id/items  — List items (paginated)
 * POST /api/admin/knowledge-bases/:id/items  — Add item
 *
 * All endpoints require system_admin role.
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
// GET — List items (paginated)
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id: baseId } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);

    const result = await knowledgeService.listItems(baseId, { page, pageSize });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[knowledge-bases] GET /:id/items error:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Add item
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

    if (!body.content || typeof body.content !== "string" || body.content.trim().length === 0) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const item = await knowledgeService.addItem(baseId, {
      title: body.title,
      content: body.content.trim(),
      source: body.source,
      metadata: body.metadata,
      tags: body.tags,
      createdBy: body.createdBy,
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error("[knowledge-bases] POST /:id/items error:", error);
    const message = error instanceof Error ? error.message : "Failed to add item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
