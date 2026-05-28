/**
 * Knowledge Base Item — Single item operations
 *
 * PUT    /api/admin/knowledge-bases/:id/items/:itemId  — Update item
 * DELETE /api/admin/knowledge-bases/:id/items/:itemId  — Delete item
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
// PUT — Update item
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
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

    const body = await request.json();

    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) {
      if (typeof body.content !== "string" || body.content.trim().length === 0) {
        return NextResponse.json({ error: "content must be a non-empty string" }, { status: 400 });
      }
      updates.content = body.content.trim();
    }
    if (body.source !== undefined) updates.source = body.source;
    if (body.metadata !== undefined) updates.metadata = body.metadata;
    if (body.tags !== undefined) updates.tags = body.tags;

    const updated = await knowledgeService.updateItem(itemId, updates);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[knowledge-bases] PUT /:id/items/:itemId error:", error);
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete item (cascade deletes chunks)
// ---------------------------------------------------------------------------

export async function DELETE(
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

    await knowledgeService.deleteItem(itemId);

    return NextResponse.json({ data: { deleted: true, id: itemId } });
  } catch (error) {
    console.error("[knowledge-bases] DELETE /:id/items/:itemId error:", error);
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 },
    );
  }
}
