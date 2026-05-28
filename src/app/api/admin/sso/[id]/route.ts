/**
 * Single SSO Configuration Operations
 *
 * GET    /api/admin/sso/:id   — Get config detail
 * PUT    /api/admin/sso/:id   — Update config
 * DELETE /api/admin/sso/:id   — Delete config
 *
 * All endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { ssoConfigurations } from "@/lib/db/schema";

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
// GET — Get single SSO config
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    const config = await db.query.ssoConfigurations.findFirst({
      where: eq(ssoConfigurations.id, id),
    });

    if (!config) {
      return NextResponse.json(
        { error: "SSO configuration not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: config });
  } catch (error) {
    console.error("[sso] GET /api/admin/sso/:id error:", error);
    return NextResponse.json(
      { error: "Failed to fetch SSO configuration" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Update SSO config
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    // Verify the config exists
    const existing = await db.query.ssoConfigurations.findFirst({
      where: eq(ssoConfigurations.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "SSO configuration not found" },
        { status: 404 },
      );
    }

    const body = await request.json();

    // Build update object — only allow updating specific fields
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.protocol !== undefined) {
      if (!["saml", "oidc"].includes(body.protocol)) {
        return NextResponse.json({ error: "protocol must be saml or oidc" }, { status: 400 });
      }
      updates.protocol = body.protocol;
    }

    if (body.config !== undefined) {
      if (typeof body.config !== "object" || body.config === null) {
        return NextResponse.json({ error: "config must be an object" }, { status: 400 });
      }
      updates.config = body.config;
    }

    if (body.fieldMappings !== undefined) {
      updates.fieldMappings = body.fieldMappings;
    }

    if (body.isActive !== undefined) {
      updates.isActive = Boolean(body.isActive);
    }

    if (body.organizationId !== undefined) {
      updates.organizationId = body.organizationId || null;
    }

    const [updated] = await db
      .update(ssoConfigurations)
      .set(updates)
      .where(eq(ssoConfigurations.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[sso] PUT /api/admin/sso/:id error:", error);
    return NextResponse.json(
      { error: "Failed to update SSO configuration" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete SSO config
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    // Verify the config exists
    const existing = await db.query.ssoConfigurations.findFirst({
      where: eq(ssoConfigurations.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "SSO configuration not found" },
        { status: 404 },
      );
    }

    await db
      .delete(ssoConfigurations)
      .where(eq(ssoConfigurations.id, id));

    return NextResponse.json({ data: { deleted: true, id } });
  } catch (error) {
    console.error("[sso] DELETE /api/admin/sso/:id error:", error);
    return NextResponse.json(
      { error: "Failed to delete SSO configuration" },
      { status: 500 },
    );
  }
}
