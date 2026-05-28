/**
 * SSO Callback Handler
 *
 * GET /api/auth/sso/:providerId
 *
 * Handles the IdP callback after SSO authentication:
 *   - Validates SAML assertion or OIDC authorization code
 *   - Maps IdP fields to local fields using fieldMappings
 *   - Finds or creates user + OAuth identity
 *   - Records login in loginLogs
 *   - Redirects to dashboard or phone binding page
 *
 * Flow (SAML):
 *   1. IdP redirects user here with a SAMLResponse parameter
 *   2. We parse and validate the SAML assertion
 *   3. Map attributes, find/create user, establish session
 *   4. Redirect
 *
 * Flow (OIDC):
 *   1. IdP redirects user here with a `code` parameter
 *   2. We exchange the code for tokens using the OIDC config
 *   3. Map claims, find/create user, establish session
 *   4. Redirect
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  users,
  userOAuthIdentities,
  loginLogs,
  organizationMembers,
  ssoConfigurations,
} from "@/lib/db/schema";
import { findOrCreateSSOUser, mapFields } from "@/lib/auth/providers/sso";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Parse and validate a SAML assertion.
 * Skeleton — see src/lib/auth/providers/sso.ts for details.
 */
async function handleSAMLCallback(
  _samlConfig: SAMLConfig,
  _samlResponse: string,
  _fieldMappings: Record<string, string> | null,
): Promise<{ providerAccountId: string; email?: string; name?: string; department?: string; raw: Record<string, unknown> }> {
  // TODO: Production SAML handling with @boxyhq/saml-jackson
  //
  // const apiController = await jackson.controller({ ... });
  // const result = await apiController.samlResponse({ SAMLResponse, ... });
  // const attributes = result.response.getRawAttributes();
  // const nameId = result.response.nameId;
  //
  // This skeleton returns a structured error for now.
  throw new Error(
    "SAML callback handling requires @boxyhq/saml-jackson integration with a real IdP. " +
    "This is a framework skeleton.",
  );
}

/**
 * Exchange OIDC authorization code for tokens and validate.
 * Skeleton — see src/lib/auth/providers/sso.ts for details.
 */
async function handleOIDCCallback(
  _oidcConfig: OIDCConfig,
  _code: string,
  _fieldMappings: Record<string, string> | null,
): Promise<{ providerAccountId: string; email?: string; name?: string; department?: string; raw: Record<string, unknown> }> {
  // TODO: Production OIDC handling with openid-client
  //
  // const issuer = await client.discovery(
  //   new URL(oidcConfig.issuer),
  //   oidcConfig.clientId,
  //   oidcConfig.clientSecret,
  // );
  // const tokens = await client.authorizationCodeGrant(issuer, callbackUrl, ...);
  // const claims = tokens.claims();
  //
  // This skeleton returns a structured error for now.
  throw new Error(
    "OIDC callback handling requires openid-client integration with a real IdP. " +
    "This is a framework skeleton.",
  );
}

/**
 * Create a session for the user by signing in through NextAuth.
 *
 * Since we handle the callback ourselves (not through the standard NextAuth
 * callback), we create the session by calling the internal signIn or
 * redirecting to a callback URL that establishes the session.
 */
function buildRedirectUrl(
  baseUrl: string,
  userId: string,
  needsPhoneBinding: boolean,
): string {
  if (needsPhoneBinding) {
    // Redirect to phone binding page
    const params = new URLSearchParams({
      userId,
      method: "sso",
    });
    return `${baseUrl}/bind-phone?${params.toString()}`;
  }

  // Redirect to dashboard
  return `${baseUrl}/dashboard`;
}

// ---------------------------------------------------------------------------
// GET — SSO Callback
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const { providerId } = await params;
  const { searchParams } = new URL(request.url);

  try {
    // 1. Look up the SSO configuration by ID
    const ssoConfig = await db.query.ssoConfigurations.findFirst({
      where: eq(ssoConfigurations.id, providerId),
    });

    if (!ssoConfig || !ssoConfig.isActive) {
      console.error(`[sso:callback] Config not found or inactive: ${providerId}`);
      return NextResponse.redirect(
        new URL("/login?error=sso_config_not_found", request.url),
      );
    }

    const providerKey = ssoConfig.protocol === "saml" ? "sso_saml" : "sso_oidc";

    // 2. Extract parameters from IdP callback
    let profile: {
      providerAccountId: string;
      email?: string;
      name?: string;
      department?: string;
      raw: Record<string, unknown>;
    };

    if (ssoConfig.protocol === "saml") {
      // SAML: IdP sends SAMLResponse as a query or POST parameter
      const samlResponse = searchParams.get("SAMLResponse");
      if (!samlResponse) {
        console.error(`[sso:callback] No SAMLResponse in callback`);
        return NextResponse.redirect(
          new URL("/login?error=sso_no_response", request.url),
        );
      }

      const samlConfig = ssoConfig.config as unknown as SAMLConfig;
      profile = await handleSAMLCallback(
        samlConfig,
        samlResponse,
        ssoConfig.fieldMappings as Record<string, string> | null,
      );
    } else if (ssoConfig.protocol === "oidc") {
      // OIDC: IdP sends `code` and `state` parameters
      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (!code) {
        console.error(`[sso:callback] No authorization code in OIDC callback`);
        return NextResponse.redirect(
          new URL("/login?error=sso_no_code", request.url),
        );
      }

      // Verify state matches config ID (CSRF protection)
      if (state && state !== providerId) {
        console.error(`[sso:callback] State mismatch: ${state} !== ${providerId}`);
        return NextResponse.redirect(
          new URL("/login?error=sso_state_mismatch", request.url),
        );
      }

      const oidcConfig = ssoConfig.config as unknown as OIDCConfig;
      profile = await handleOIDCCallback(
        oidcConfig,
        code,
        ssoConfig.fieldMappings as Record<string, string> | null,
      );
    } else {
      console.error(`[sso:callback] Unknown protocol: ${ssoConfig.protocol}`);
      return NextResponse.redirect(
        new URL("/login?error=sso_unknown_protocol", request.url),
      );
    }

    // 3. Find or create user
    const { userId, needsPhoneBinding } = await findOrCreateSSOUser(
      profile,
      providerKey,
    );

    // 4. Determine redirect URL
    const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
    const redirectUrl = buildRedirectUrl(baseUrl, userId, needsPhoneBinding);

    // 5. Redirect to the appropriate page
    // NOTE: In production, you would also set the NextAuth session cookie here
    // using signIn() or by directly setting the session token. For the framework
    // skeleton, we redirect and let the frontend handle session establishment
    // via a callback endpoint.
    //
    // Example production flow:
    //   await signIn(providerKey, { callbackUrl: redirectUrl });
    //
    // For now, append a session token hint to the redirect URL
    const finalUrl = new URL(redirectUrl);
    finalUrl.searchParams.set("ssoUserId", userId);
    finalUrl.searchParams.set("ssoMethod", providerKey);

    return NextResponse.redirect(finalUrl);
  } catch (error) {
    console.error(`[sso:callback] Error processing SSO callback:`, error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown SSO error";

    // Record failed login attempt (without userId since we couldn't identify the user)
    try {
      await db.insert(loginLogs).values({
        loginMethod: "sso_saml", // Default; we may not know the protocol at this point
        success: false,
        failureReason: errorMessage,
      });
    } catch {
      // Silently ignore logging failures
    }

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("sso_callback_error")}`, request.url),
    );
  }
}
