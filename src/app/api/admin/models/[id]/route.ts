/**
 * Single Model Operations
 *
 * GET    /api/admin/models/:id   — Get model detail
 * PUT    /api/admin/models/:id   — Update model
 * DELETE /api/admin/models/:id   — Soft delete (set isActive = false)
 *
 * All endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { modelService } from "@/lib/services/model-service";
import type { UpdateModelInput } from "@/lib/services/model-service";

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
// Helper: mask API key
// ---------------------------------------------------------------------------

function maskApiKey(model: Record<string, unknown>) {
  return {
    ...model,
    apiKey: model.apiKey ? "********" : null,
  };
}

// ---------------------------------------------------------------------------
// GET — Get single model
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    const model = await modelService.getById(id);

    if (!model) {
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: maskApiKey(model) });
  } catch (error) {
    console.error("[models] GET /api/admin/models/:id error:", error);
    return NextResponse.json(
      { error: "Failed to fetch model" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Update model
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    // Verify the model exists
    const existing = await modelService.getById(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 },
      );
    }

    const body = await request.json();

    // Build validated update object
    const updates: UpdateModelInput = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.modelType !== undefined) {
      if (!["local", "cloud", "multimodal"].includes(body.modelType)) {
        return NextResponse.json({ error: "modelType must be local, cloud, or multimodal" }, { status: 400 });
      }
      updates.modelType = body.modelType;
    }

    if (body.provider !== undefined) {
      if (typeof body.provider !== "string" || body.provider.trim().length === 0) {
        return NextResponse.json({ error: "provider must be a non-empty string" }, { status: 400 });
      }
      updates.provider = body.provider.trim();
    }

    if (body.modelId !== undefined) {
      if (typeof body.modelId !== "string" || body.modelId.trim().length === 0) {
        return NextResponse.json({ error: "modelId must be a non-empty string" }, { status: 400 });
      }
      updates.modelId = body.modelId.trim();
    }

    if (body.endpoint !== undefined) {
      if (typeof body.endpoint !== "string" || body.endpoint.trim().length === 0) {
        return NextResponse.json({ error: "endpoint must be a non-empty string" }, { status: 400 });
      }
      try {
        new URL(body.endpoint);
      } catch {
        return NextResponse.json({ error: "endpoint must be a valid URL" }, { status: 400 });
      }
      updates.endpoint = body.endpoint.trim().replace(/\/+$/, "");
    }

    if (body.apiKey !== undefined) {
      updates.apiKey = body.apiKey;
    }

    if (body.capabilities !== undefined) {
      updates.capabilities = body.capabilities;
    }

    if (body.costPerKInputTokens !== undefined) {
      updates.costPerKInputTokens = body.costPerKInputTokens;
    }

    if (body.costPerKOutputTokens !== undefined) {
      updates.costPerKOutputTokens = body.costPerKOutputTokens;
    }

    if (body.maxTokens !== undefined) {
      if (typeof body.maxTokens !== "number" || body.maxTokens < 1) {
        return NextResponse.json({ error: "maxTokens must be a positive integer" }, { status: 400 });
      }
      updates.maxTokens = body.maxTokens;
    }

    if (body.organizationId !== undefined) {
      updates.organizationId = body.organizationId;
    }

    if (body.isActive !== undefined) {
      updates.isActive = Boolean(body.isActive);
    }

    const updated = await modelService.update(id, updates);

    return NextResponse.json({ data: maskApiKey(updated) });
  } catch (error) {
    console.error("[models] PUT /api/admin/models/:id error:", error);
    return NextResponse.json(
      { error: "Failed to update model" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Soft delete (set isActive = false)
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  const { id } = await params;

  try {
    // Verify the model exists
    const existing = await modelService.getById(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 },
      );
    }

    await modelService.delete(id);

    return NextResponse.json({ data: { deleted: true, id } });
  } catch (error) {
    console.error("[models] DELETE /api/admin/models/:id error:", error);
    return NextResponse.json(
      { error: "Failed to delete model" },
      { status: 500 },
    );
  }
}
