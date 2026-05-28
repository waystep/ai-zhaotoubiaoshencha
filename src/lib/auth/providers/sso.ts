/**
 * Dynamic SSO Provider Factory
 *
 * Reads an ssoConfiguration record from the database and returns a
 * NextAuth-compatible CredentialsProvider configured for the specified
 * protocol (SAML or OIDC).
 *
 * Because enterprise SSO callbacks are IdP-initiated or SP-initiated
 * redirects that do not follow the standard NextAuth credentials flow,
 * we wrap the logic inside a CredentialsProvider. The actual SSO callback
 * handling is done in /api/auth/sso/[providerId]/route.ts which then
 * creates the session.
 *
 * This factory is used to:
 *   1. Generate the SSO authorization URL for the frontend to redirect to
 *   2. Validate IdP responses (SAML assertions / OIDC tokens)
 *   3. Map IdP fields to local user fields using fieldMappings
 *   4. Find or create user + OAuth identity (same pattern as Feishu/WeChat)
 */

import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  users,
  userOAuthIdentities,
  loginLogs,
  organizationMembers,
  ssoConfigurations,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Types
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

interface SSOConfigRecord {
  id: string;
  organizationId: string | null;
  name: string;
  protocol: string;
  config: Record<string, unknown>;
  fieldMappings: Record<string, string> | null;
  isActive: boolean | null;
}

interface MappedProfile {
  email?: string;
  name?: string;
  department?: string;
  providerAccountId: string;
  raw: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// SAML assertion parser (skeleton)
// ---------------------------------------------------------------------------

/**
 * Parse and validate a SAML assertion from the IdP response.
 *
 * In production, this uses @boxyhq/saml-jackson to validate the assertion
 * against the configured certificate and extract attributes.
 *
 * This is a framework/skeleton — actual SAML integration requires a real
 * IdP (e.g., Azure AD, Okta, OneLogin) for testing.
 */
async function parseSAMLAssertion(
  _samlConfig: SAMLConfig,
  _samlResponse: string,
): Promise<{ nameId: string; attributes: Record<string, string> }> {
  // TODO: Integrate with @boxyhq/saml-jackson for production SAML parsing
  //
  // Production implementation:
  //   import jackson from '@boxyhq/saml-jackson';
  //   const apiController = await jackson.controller({ ... });
  //   const { response, session } = await apiController.samlResponse({
  //     SAMLResponse: samlResponse,
  //     ...
  //   });
  //
  // For now, throw an informative error indicating this needs a real IdP
  throw new Error(
    "SAML assertion parsing requires integration with @boxyhq/saml-jackson " +
    "and a real Identity Provider. This is a framework skeleton.",
  );
}

// ---------------------------------------------------------------------------
// OIDC token validation (skeleton)
// ---------------------------------------------------------------------------

/**
 * Validate an OIDC authorization code and exchange for tokens.
 *
 * In production, this uses the openid-client library to perform the
 * authorization code exchange and validate the ID token.
 */
async function validateOIDCToken(
  _oidcConfig: OIDCConfig,
  _code: string,
): Promise<{ sub: string; claims: Record<string, unknown> }> {
  // TODO: Integrate with openid-client for production OIDC validation
  //
  // Production implementation:
  //   import * as client from 'openid-client';
  //   const issuer = await client.discovery(
  //     new URL(oidcConfig.issuer),
  //     oidcConfig.clientId,
  //     oidcConfig.clientSecret,
  //   );
  //   const tokens = await client.authorizationCodeGrant(
  //     issuer,
  //     new URL(callbackUrl),
  //     { pkceCodeVerifier },
  //   );
  //   const claims = tokens.claims();
  //
  // For now, throw an informative error indicating this needs a real IdP
  throw new Error(
    "OIDC token validation requires integration with openid-client " +
    "and a real Identity Provider. This is a framework skeleton.",
  );
}

// ---------------------------------------------------------------------------
// Field mapping
// ---------------------------------------------------------------------------

/**
 * Map IdP attributes to local fields using the configured fieldMappings.
 *
 * Default mappings if none configured:
 *   email <- email / mail
 *   name  <- name / displayName
 *   department <- department
 */
function mapFields(
  attributes: Record<string, string>,
  fieldMappings: Record<string, string> | null,
): Pick<MappedProfile, "email" | "name" | "department"> {
  const mappings = fieldMappings || {};

  // Resolve each local field from attributes using mapping or defaults
  const email =
    attributes[mappings.email || "email"] ||
    attributes["mail"] ||
    undefined;

  const name =
    attributes[mappings.name || "name"] ||
    attributes["displayName"] ||
    undefined;

  const department =
    attributes[mappings.department || "department"] ||
    undefined;

  return { email, name, department };
}

// ---------------------------------------------------------------------------
// User provisioning (same pattern as Feishu/WeChat)
// ---------------------------------------------------------------------------

async function findOrCreateSSOUser(
  profile: MappedProfile,
  providerKey: string,
): Promise<{ userId: string; isNewUser: boolean; needsPhoneBinding: boolean }> {
  // 1. Look up existing OAuth identity
  const existingIdentity = await db.query.userOAuthIdentities.findFirst({
    where: eq(userOAuthIdentities.providerAccountId, profile.providerAccountId),
  });

  let userId: string;
  let isNewUser = false;

  if (existingIdentity) {
    // Existing user — update profile data
    userId = existingIdentity.userId;

    await db
      .update(userOAuthIdentities)
      .set({
        profileData: profile.raw as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(userOAuthIdentities.id, existingIdentity.id));
  } else {
    // New user — auto-create account
    const email = profile.email || `${profile.providerAccountId}@sso.placeholder`;

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        name: profile.name || "SSO用户",
        phone: null,
        phoneVerified: null,
        lastLoginMethod: providerKey as "sso_saml" | "sso_oidc",
        lastLoginAt: new Date(),
      })
      .returning({ id: users.id });

    userId = newUser!.id;
    isNewUser = true;

    // Create OAuth identity record
    await db.insert(userOAuthIdentities).values({
      userId,
      provider: providerKey,
      providerAccountId: profile.providerAccountId,
      profileData: profile.raw as Record<string, unknown>,
    });
  }

  // Update last login info
  await db
    .update(users)
    .set({
      lastLoginAt: new Date(),
      lastLoginMethod: providerKey as "sso_saml" | "sso_oidc",
      name: profile.name || undefined,
    })
    .where(eq(users.id, userId));

  // Record login log
  await db.insert(loginLogs).values({
    userId,
    loginMethod: providerKey as "sso_saml" | "sso_oidc",
    success: true,
  });

  // Check if phone binding is needed
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  return {
    userId,
    isNewUser,
    needsPhoneBinding: !user?.phone,
  };
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

/**
 * Create a NextAuth-compatible CredentialsProvider for an SSO configuration.
 *
 * @param ssoConfig - The ssoConfigurations record from the database
 * @returns A CredentialsProvider configured for the specified SSO protocol
 */
export function createSSOProvider(ssoConfig: SSOConfigRecord) {
  const providerKey = ssoConfig.protocol === "saml" ? "sso_saml" : "sso_oidc";
  const providerId = `sso_${ssoConfig.id}`;

  return Credentials({
    id: providerId,
    name: `sso_${ssoConfig.protocol}`,
    credentials: {
      /** For SAML: the base64-encoded SAMLResponse from the IdP */
      samlResponse: { label: "SAML Response", type: "text" },
      /** For OIDC: the authorization code from the IdP redirect */
      code: { label: "Authorization Code", type: "text" },
      /** The SSO config ID (for verification) */
      configId: { label: "Config ID", type: "text" },
    },
    async authorize(credentials) {
      if (!credentials) return null;

      try {
        let profile: MappedProfile;

        if (ssoConfig.protocol === "saml") {
          // --- SAML flow ---
          if (!credentials.samlResponse) {
            console.error(`[sso:${providerId}] No SAML response provided`);
            return null;
          }

          const samlConfig = ssoConfig.config as unknown as SAMLConfig;
          const { nameId, attributes } = await parseSAMLAssertion(
            samlConfig,
            credentials.samlResponse as string,
          );

          const mapped = mapFields(attributes, ssoConfig.fieldMappings);

          profile = {
            ...mapped,
            providerAccountId: nameId,
            raw: { nameId, attributes } as unknown as Record<string, unknown>,
          };
        } else if (ssoConfig.protocol === "oidc") {
          // --- OIDC flow ---
          if (!credentials.code) {
            console.error(`[sso:${providerId}] No authorization code provided`);
            return null;
          }

          const oidcConfig = ssoConfig.config as unknown as OIDCConfig;
          const { sub, claims } = await validateOIDCToken(
            oidcConfig,
            credentials.code as string,
          );

          // Flatten claims to string map for field mapping
          const claimAttributes: Record<string, string> = {};
          for (const [key, value] of Object.entries(claims)) {
            if (typeof value === "string") {
              claimAttributes[key] = value;
            }
          }

          const mapped = mapFields(claimAttributes, ssoConfig.fieldMappings);

          profile = {
            ...mapped,
            providerAccountId: sub,
            raw: claims as Record<string, unknown>,
          };
        } else {
          console.error(`[sso:${providerId}] Unknown protocol: ${ssoConfig.protocol}`);
          return null;
        }

        // Find or create user
        const { userId, needsPhoneBinding } = await findOrCreateSSOUser(
          profile,
          providerKey,
        );

        // Look up membership for role / orgId
        const membership = await db.query.organizationMembers.findFirst({
          where: eq(organizationMembers.userId, userId),
        });

        // Fetch the user row
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });

        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role || membership?.role || "supplier_staff",
          orgId: membership?.orgId || undefined,
          needsPhoneBinding,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      } catch (err) {
        console.error(`[sso:${providerId}] authorize error:`, err);

        // Record failed login attempt
        try {
          await db.insert(loginLogs).values({
            loginMethod: providerKey as "sso_saml" | "sso_oidc",
            success: false,
            failureReason: err instanceof Error ? err.message : "Unknown error",
          });
        } catch {
          // Silently ignore logging failures
        }

        return null;
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: build authorization URL for frontend redirect
// ---------------------------------------------------------------------------

/**
 * Generate the SSO authorization URL for the given configuration.
 * The frontend redirects the user to this URL to initiate SSO.
 *
 * @param ssoConfig - The SSO configuration record
 * @param callbackUrl - The URL to redirect back to after authentication
 * @returns The authorization URL to redirect the user to
 */
export function getSSOAuthorizationUrl(
  ssoConfig: SSOConfigRecord,
  callbackUrl: string,
): string {
  if (ssoConfig.protocol === "saml") {
    // For SAML SP-initiated flow, the user is redirected to the IdP SSO URL
    // with a SAMLRequest parameter. In production, @boxyhq/saml-jackson
    // generates the signed SAMLRequest.
    const samlConfig = ssoConfig.config as unknown as SAMLConfig;
    const params = new URLSearchParams({
      entityID: samlConfig.entityId,
      callback: callbackUrl,
    });
    return `${samlConfig.ssoUrl}?${params.toString()}`;
  }

  if (ssoConfig.protocol === "oidc") {
    // For OIDC authorization code flow, build the standard authorize URL
    const oidcConfig = ssoConfig.config as unknown as OIDCConfig;
    const params = new URLSearchParams({
      client_id: oidcConfig.clientId,
      response_type: "code",
      redirect_uri: callbackUrl,
      scope: "openid email profile",
      state: ssoConfig.id, // Use config ID as state for CSRF protection
    });
    return `${oidcConfig.authorizationEndpoint}?${params.toString()}`;
  }

  throw new Error(`Unsupported SSO protocol: ${ssoConfig.protocol}`);
}

// ---------------------------------------------------------------------------
// Helper: load active SSO configs
// ---------------------------------------------------------------------------

/**
 * Load all active SSO configurations, optionally filtered by organization.
 */
export async function getActiveSSOConfigs(
  organizationId?: string,
): Promise<SSOConfigRecord[]> {
  // Use raw select since ssoConfigurations may not have relations set up
  const configs = await db
    .select()
    .from(ssoConfigurations);

  return configs.filter((c) => {
    if (!c.isActive) return false;
    if (organizationId && c.organizationId && c.organizationId !== organizationId) return false;
    return true;
  }) as SSOConfigRecord[];
}

// Re-export the provider key helper for use in callback routes
export { findOrCreateSSOUser, mapFields };
