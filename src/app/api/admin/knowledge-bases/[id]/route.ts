/**
 * Single Knowledge Base Operations
 *
 * GET    /api/admin/knowledge-bases/:id  — Get base detail + stats
 * PUT    /api/admin/knowledge-bases/:id  — Update base
 * DELETE /api/admin/knowledge-bases/:id  — Delete base
 *
 * All endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { knowledgeService } from "@/lib/services/knowledge-service";
import type { UpdateBaseInput } from "@/lib/services/knowledge-service";
import { VALID_KB_TYPES } from "@/lib/services/knowledge-service";

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
// GET — Get knowledge base detail + stats
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    const base = await knowledgeService.getBase(id);

    if (!base) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: base });
  } catch (error) {
    console.error("[knowledge-bases] GET /:id error:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge base" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Update knowledge base
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    const existing = await knowledgeService.getBase(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 },
      );
    }

    const body = await request.json();

    const updates: UpdateBaseInput = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.type !== undefined) {
      if (!VALID_KB_TYPES.includes(body.type)) {
        return NextResponse.json(
          { error: `type must be one of: ${VALID_KB_TYPES.join(", ")}` },
          { status: 400 },
        );
      }
      updates.type = body.type;
    }

    if (body.description !== undefined) updates.description = body.description;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

    const updated = await knowledgeService.updateBase(id, updates);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[knowledge-bases] PUT /:id error:", error);
    return NextResponse.json(
      { error: "Failed to update knowledge base" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete knowledge base (cascade deletes items and chunks)
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    const existing = await knowledgeService.getBase(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 },
      );
    }

    await knowledgeService.deleteBase(id);

    return NextResponse.json({ data: { deleted: true, id } });
  } catch (error) {
    console.error("[knowledge-bases] DELETE /:id error:", error);
    return NextResponse.json(
      { error: "Failed to delete knowledge base" },
      { status: 500 },
    );
  }
}
