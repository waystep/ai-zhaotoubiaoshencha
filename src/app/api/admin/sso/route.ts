/**
 * SSO Configuration CRUD API
 *
 * GET  /api/admin/sso          — List all SSO configs (optionally filtered by org)
 * POST /api/admin/sso          — Create a new SSO config
 *
 * Both endpoints require system_admin role.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { ssoConfigurations } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_PROTOCOLS = ["saml", "oidc"] as const;
type SSOProtocol = (typeof VALID_PROTOCOLS)[number];

interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  certificate: string;
  nameIdFormat?: string;
}

interface OIDCConfig {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri?: string;
  clientId: string;
  clientSecret: string;
}

interface SSOConfigInput {
  name: string;
  protocol: SSOProtocol;
  config: SAMLConfig | OIDCConfig;
  fieldMappings?: Record<string, string>;
  organizationId?: string;
  isActive?: boolean;
}

function validateSSOConfig(body: Partial<SSOConfigInput>): {
  valid: boolean;
  error?: string;
} {
  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return { valid: false, error: "name is required" };
  }

  if (!body.protocol || !VALID_PROTOCOLS.includes(body.protocol as SSOProtocol)) {
    return {
      valid: false,
      error: `protocol must be one of: ${VALID_PROTOCOLS.join(", ")}`,
    };
  }

  if (!body.config || typeof body.config !== "object") {
    return { valid: false, error: "config object is required" };
  }

  // Protocol-specific validation
  if (body.protocol === "saml") {
    const cfg = body.config as Partial<SAMLConfig>;
    if (!cfg.entityId || !cfg.ssoUrl || !cfg.certificate) {
      return {
        valid: false,
        error: "SAML config requires: entityId, ssoUrl, certificate",
      };
    }
  } else if (body.protocol === "oidc") {
    const cfg = body.config as Partial<OIDCConfig>;
    if (!cfg.issuer || !cfg.authorizationEndpoint || !cfg.tokenEndpoint || !cfg.clientId || !cfg.clientSecret) {
      return {
        valid: false,
        error: "OIDC config requires: issuer, authorizationEndpoint, tokenEndpoint, clientId, clientSecret",
      };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// GET — List SSO configurations
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "system_admin") {
      return NextResponse.json({ error: "Forbidden: system_admin required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("organizationId");

    let configs;

    if (orgId) {
      configs = await db
        .select()
        .from(ssoConfigurations)
        .where(eq(ssoConfigurations.organizationId, orgId));
    } else {
      configs = await db.select().from(ssoConfigurations);
    }

    // Strip sensitive fields (clientSecret etc.) for listing
    const safeConfigs = configs.map((c) => ({
      ...c,
      config: maskSensitiveConfig(c.protocol, c.config as Record<string, unknown>),
    }));

    return NextResponse.json({ data: safeConfigs });
  } catch (error) {
    console.error("[sso] GET /api/admin/sso error:", error);
    return NextResponse.json(
      { error: "Failed to fetch SSO configurations" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create SSO configuration
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "system_admin") {
      return NextResponse.json({ error: "Forbidden: system_admin required" }, { status: 403 });
    }

    const body: Partial<SSOConfigInput> = await request.json();

    const validation = validateSSOConfig(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const [created] = await db
      .insert(ssoConfigurations)
      .values({
        name: body.name!.trim(),
        protocol: body.protocol!,
        config: body.config as unknown as Record<string, unknown>,
        fieldMappings: (body.fieldMappings as Record<string, string>) || {},
        organizationId: body.organizationId || null,
        isActive: body.isActive !== undefined ? body.isActive : true,
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("[sso] POST /api/admin/sso error:", error);
    return NextResponse.json(
      { error: "Failed to create SSO configuration" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskSensitiveConfig(
  protocol: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  if (protocol === "oidc") {
    return {
      ...config,
      clientSecret: config.clientSecret ? "********" : undefined,
    };
  }
  // For SAML, the certificate is needed by the SP but is not a "secret" per se
  // Mask it anyway in the listing for security
  if (protocol === "saml") {
    return {
      ...config,
      certificate: config.certificate ? `${String(config.certificate).substring(0, 20)}...` : undefined,
    };
  }
  return config;
}
