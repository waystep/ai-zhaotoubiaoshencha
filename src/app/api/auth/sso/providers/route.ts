/**
 * Public SSO Providers List API
 *
 * GET /api/auth/sso/providers
 *
 * Returns a list of active SSO configurations for the login page.
 * Unlike the admin endpoint, this does NOT require authentication
 * and strips all sensitive configuration details.
 */

import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { ssoConfigurations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const configs = await db
      .select({
        id: ssoConfigurations.id,
        name: ssoConfigurations.name,
        protocol: ssoConfigurations.protocol,
        organizationId: ssoConfigurations.organizationId,
      })
      .from(ssoConfigurations)
      .where(eq(ssoConfigurations.isActive, true));

    return NextResponse.json({ data: configs });
  } catch (error) {
    console.error("[sso:providers] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch SSO providers" },
      { status: 500 },
    );
  }
}
