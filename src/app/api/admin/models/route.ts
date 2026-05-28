/**
 * Model Management REST API — Collection endpoints
 *
 * GET  /api/admin/models          — List models (optionally filtered by type/org)
 * POST /api/admin/models          — Create a new model
 *
 * All endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { modelService } from "@/lib/services/model-service";
import type { CreateModelInput } from "@/lib/services/model-service";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_MODEL_TYPES = ["local", "cloud", "multimodal"] as const;
type ModelType = (typeof VALID_MODEL_TYPES)[number];

function validateCreateInput(body: Partial<CreateModelInput>): {
  valid: boolean;
  error?: string;
} {
  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return { valid: false, error: "name is required" };
  }

  if (!body.modelType || !VALID_MODEL_TYPES.includes(body.modelType as ModelType)) {
    return {
      valid: false,
      error: `modelType must be one of: ${VALID_MODEL_TYPES.join(", ")}`,
    };
  }

  if (!body.provider || typeof body.provider !== "string" || body.provider.trim().length === 0) {
    return { valid: false, error: "provider is required" };
  }

  if (!body.modelId || typeof body.modelId !== "string" || body.modelId.trim().length === 0) {
    return { valid: false, error: "modelId is required" };
  }

  if (!body.endpoint || typeof body.endpoint !== "string" || body.endpoint.trim().length === 0) {
    return { valid: false, error: "endpoint is required" };
  }

  // Validate endpoint is a valid URL
  try {
    new URL(body.endpoint);
  } catch {
    return { valid: false, error: "endpoint must be a valid URL" };
  }

  return { valid: true };
}

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
// GET — List models
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? undefined;
    const organizationId = searchParams.get("organizationId") ?? undefined;

    const models = await modelService.listAll({
      type: type,
      organizationId,
    });

    // Strip API keys from listing response
    const safeModels = models.map((m) => ({
      ...m,
      apiKey: m.apiKey ? "********" : null,
    }));

    return NextResponse.json({ data: safeModels });
  } catch (error) {
    console.error("[models] GET /api/admin/models error:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create model
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authCheck = await requireSystemAdmin();
  if ("error" in authCheck) return authCheck.error;

  try {
    const body: Partial<CreateModelInput> = await request.json();

    const validation = validateCreateInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const created = await modelService.create({
      name: body.name!.trim(),
      modelType: body.modelType!,
      provider: body.provider!.trim(),
      modelId: body.modelId!.trim(),
      endpoint: body.endpoint!.trim().replace(/\/+$/, ""), // strip trailing slashes
      apiKey: body.apiKey ?? null,
      capabilities: body.capabilities ?? null,
      costPerKInputTokens: body.costPerKInputTokens ?? null,
      costPerKOutputTokens: body.costPerKOutputTokens ?? null,
      maxTokens: body.maxTokens ?? null,
      organizationId: body.organizationId ?? null,
    });

    // Strip API key from response
    const safeResult = {
      ...created,
      apiKey: created.apiKey ? "********" : null,
    };

    return NextResponse.json({ data: safeResult }, { status: 201 });
  } catch (error) {
    console.error("[models] POST /api/admin/models error:", error);
    return NextResponse.json(
      { error: "Failed to create model" },
      { status: 500 },
    );
  }
}
