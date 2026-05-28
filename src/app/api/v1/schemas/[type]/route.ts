/**
 * V1 Schema API — JSON Schema Definitions
 *
 * GET /api/v1/schemas/[type]
 *
 * Returns the JSON Schema (Zod-based) definition for a specific output type.
 * Supported types: analysis, draft, risks, report
 *
 * This endpoint is public (no API key required) — it only serves schema definitions,
 * not actual data.
 */

import { NextRequest, NextResponse } from "next/server";
import { integrationService } from "@/lib/services/integration-service";
import { OUTPUT_TYPES } from "@/lib/schemas/output-schemas";

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;

  // "all" returns a map of all schemas
  if (type === "all") {
    const allSchemas: Record<string, object> = {};
    for (const t of OUTPUT_TYPES) {
      const schema = await integrationService.getSchema(t);
      if (schema) {
        allSchemas[t] = schema;
      }
    }

    return NextResponse.json({
      schemas: allSchemas,
      availableTypes: OUTPUT_TYPES,
    });
  }

  // Validate type
  if (!OUTPUT_TYPES.includes(type as (typeof OUTPUT_TYPES)[number])) {
    return NextResponse.json(
      {
        error: `Invalid schema type: "${type}". Supported types: ${OUTPUT_TYPES.join(", ")}, all`,
      },
      { status: 400 },
    );
  }

  try {
    const schema = await integrationService.getSchema(type);

    if (!schema) {
      return NextResponse.json(
        { error: `Schema not found for type: ${type}` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      type,
      schema,
    });
  } catch (error) {
    console.error(`[v1] GET /api/v1/schemas/${type} error:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
