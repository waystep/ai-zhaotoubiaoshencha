/**
 * Knowledge Base Collection API
 *
 * GET  /api/admin/knowledge-bases  — List knowledge bases (optional ?type= filter)
 * POST /api/admin/knowledge-bases  — Create a new knowledge base
 *
 * All endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { knowledgeService } from "@/lib/services/knowledge-service";
import type { CreateBaseInput } from "@/lib/services/knowledge-service";
import { VALID_KB_TYPES } from "@/lib/services/knowledge-service";
import type { KnowledgeBaseType } from "@/lib/services/knowledge-service";

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
// GET — List knowledge bases
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as KnowledgeBaseType | null;
    const organizationId = searchParams.get("organizationId") ?? undefined;

    const bases = await knowledgeService.listBases(organizationId, {
      type: type ?? undefined,
    });

    return NextResponse.json({ data: bases });
  } catch (error) {
    console.error("[knowledge-bases] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge bases" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create knowledge base
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (!body.type || !VALID_KB_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_KB_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    if (!body.organizationId || typeof body.organizationId !== "string") {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const input: CreateBaseInput = {
      name: body.name.trim(),
      type: body.type,
      description: body.description ?? null,
      icon: body.icon ?? null,
      organizationId: body.organizationId,
    };

    const created = await knowledgeService.createBase(input);

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("[knowledge-bases] POST error:", error);
    const message = error instanceof Error ? error.message : "Failed to create knowledge base";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
