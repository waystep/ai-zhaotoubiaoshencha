/**
 * V1 Project Output API — Structured JSON outputs
 *
 * GET /api/v1/projects/[id]/outputs/[type]
 *
 * Returns structured JSON data for a specific output type.
 * Supported types: analysis, draft, risks, report
 *
 * Authentication: x-api-key header required
 * Query params:
 *   - format: "full" (default) | "minimal" — omit large fields in minimal mode
 */

import { NextRequest, NextResponse } from "next/server";
import { integrationService } from "@/lib/services/integration-service";
import { OUTPUT_TYPES, type OutputType } from "@/lib/schemas/output-schemas";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireApiKey(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return {
      error: NextResponse.json(
        { error: "Missing x-api-key header" },
        { status: 401 },
      ),
    };
  }

  const result = await integrationService.validateApiKey(apiKey);

  if (!result) {
    return {
      error: NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 },
      ),
    };
  }

  return { organizationId: result.organizationId };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  // Authenticate
  const authCheck = await requireApiKey(request);
  if ("error" in authCheck) return authCheck.error;

  const { id: projectId, type } = await params;

  // Validate output type
  const outputType = OUTPUT_TYPES.find((t) => t === type) as
    | OutputType
    | undefined;

  if (!outputType) {
    return NextResponse.json(
      {
        error: `Invalid output type: "${type}". Supported types: ${OUTPUT_TYPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") === "minimal" ? "minimal" : "full";

    const output = await integrationService.getOutput(projectId, outputType, {
      format: format as "full" | "minimal",
    });

    if (!output) {
      return NextResponse.json(
        { error: `No ${outputType} output found for project ${projectId}` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      type: outputType,
      projectId,
      data: output,
    });
  } catch (error) {
    console.error(
      `[v1] GET /api/v1/projects/${projectId}/outputs/${type} error:`,
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
