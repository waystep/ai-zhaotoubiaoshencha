/**
 * NextAuth Feishu (飞书/Lark) OAuth Provider
 *
 * A custom CredentialsProvider (id: "feishu") that implements the Feishu
 * OAuth flow. Because Feishu's token exchange is two-step (app_access_token
 * then user_access_token) and does not follow standard OAuth2, we wrap it
 * inside a CredentialsProvider where the frontend passes the authorization
 * code obtained from the Feishu redirect.
 *
 * Flow:
 *   1. Frontend redirects user to Feishu authorization URL
 *   2. Feishu redirects back with an authorization `code`
 *   3. Frontend sends `code` to the NextAuth credentials endpoint (id: "feishu")
 *   4. This provider:
 *      a. Exchanges app_id + app_secret for app_access_token
 *      b. Exchanges authorization code + app_access_token for user_access_token
 *      c. Calls /authen/v1/user_info with user_access_token
 *      d. Finds or creates user, records OAuth identity and login log
 */

import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  users,
  userOAuthIdentities,
  loginLogs,
  organizationMembers,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Feishu API helpers
// ---------------------------------------------------------------------------

const FEISHU_BASE = "https://open.feishu.cn/open-apis";

interface AppTokenResponse {
  code: number;
  msg: string;
  app_access_token: string;
  expire: number;
}

interface UserTokenResponse {
  code: number;
  msg: string;
  data: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
}

interface UserInfoResponse {
  code: number;
  msg: string;
  data: {
    name: string;
    open_id: string;
    union_id: string;
    email: string;
    mobile: string;
    user_id: string;
    avatar_url: string;
    avatar_thumb: string;
    avatar_middle: string;
    avatar_big: string;
    tenant_key: string;
  };
}

/** Step 1: obtain app_access_token using app_id + app_secret */
async function getAppAccessToken(): Promise<string> {
  const res = await fetch(`${FEISHU_BASE}/auth/v3/app_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    }),
  });

  const json = (await res.json()) as AppTokenResponse;

  if (json.code !== 0) {
    throw new Error(
      `Feishu app_access_token error: code=${json.code}, msg=${json.msg}`,
    );
  }

  return json.app_access_token;
}

/** Step 2: exchange authorization code for user_access_token */
async function getUserAccessToken(
  code: string,
  appAccessToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch(
    `${FEISHU_BASE}/authen/v1/oidc/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${appAccessToken}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
      }),
    },
  );

  const json = (await res.json()) as UserTokenResponse;

  if (json.code !== 0) {
    throw new Error(
      `Feishu user_access_token error: code=${json.code}, msg=${json.msg}`,
    );
  }

  return {
    accessToken: json.data.access_token,
    refreshToken: json.data.refresh_token,
    expiresIn: json.data.expires_in,
  };
}

/** Step 3: fetch user profile with user_access_token */
async function getUserInfo(
  userAccessToken: string,
): Promise<UserInfoResponse["data"]> {
  const res = await fetch(`${FEISHU_BASE}/authen/v1/user_info`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
    },
  });

  const json = (await res.json()) as UserInfoResponse;

  if (json.code !== 0) {
    throw new Error(
      `Feishu user_info error: code=${json.code}, msg=${json.msg}`,
    );
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// Provider definition
// ---------------------------------------------------------------------------

export const FeishuOAuthProvider = Credentials({
  id: "feishu",
  name: "feishu_oauth",
  credentials: {
    code: { label: "Authorization Code", type: "text" },
  },
  async authorize(credentials) {
    if (!credentials?.code) {
      return null;
    }

    const code = credentials.code as string;

    try {
      // 1. Get app_access_token
      const appAccessToken = await getAppAccessToken();

      // 2. Exchange code for user_access_token
      const { accessToken, refreshToken, expiresIn } =
        await getUserAccessToken(code, appAccessToken);

      // 3. Get user info from Feishu
      const feishuUser = await getUserInfo(accessToken);

      const openId = feishuUser.open_id;

      if (!openId) {
        console.error("[feishu] No open_id returned from Feishu user_info");
        return null;
      }

      // 4. Look up existing OAuth identity
      const existingIdentity = await db.query.userOAuthIdentities.findFirst({
        where: eq(userOAuthIdentities.providerAccountId, openId),
      });

      let userId: string;

      if (existingIdentity) {
        // Existing user — update tokens
        userId = existingIdentity.userId;

        await db
          .update(userOAuthIdentities)
          .set({
            accessToken,
            refreshToken,
            expiresAt: new Date(Date.now() + expiresIn * 1000),
            profileData: feishuUser as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(userOAuthIdentities.id, existingIdentity.id));
      } else {
        // New user — auto-create account
        // Use email from Feishu if available; otherwise generate a placeholder
        const email =
          feishuUser.email ||
          `${openId}@feishu.placeholder`;

        const [newUser] = await db
          .insert(users)
          .values({
            email,
            name: feishuUser.name || "飞书用户",
            avatar:
              feishuUser.avatar_url ||
              feishuUser.avatar_big ||
              feishuUser.avatar_middle ||
              feishuUser.avatar_thumb ||
              null,
            phone: feishuUser.mobile || null,
            phoneVerified: feishuUser.mobile ? new Date() : null,
            lastLoginMethod: "feishu_oauth",
            lastLoginAt: new Date(),
          })
          .returning({ id: users.id });

        userId = newUser!.id;

        // Create OAuth identity record
        await db.insert(userOAuthIdentities).values({
          userId,
          provider: "feishu",
          providerAccountId: openId,
          accessToken,
          refreshToken,
          profileData: feishuUser as unknown as Record<string, unknown>,
          expiresAt: new Date(Date.now() + expiresIn * 1000),
        });
      }

      // 5. Update last login info on user
      await db
        .update(users)
        .set({
          lastLoginAt: new Date(),
          lastLoginMethod: "feishu_oauth",
          ...(existingIdentity
            ? {}
            : {}),
          // If user has no avatar yet and Feishu provides one, set it
          avatar: feishuUser.avatar_url || feishuUser.avatar_big || undefined,
          name: feishuUser.name || undefined,
        })
        .where(eq(users.id, userId));

      // 6. Record login log
      await db.insert(loginLogs).values({
        userId,
        loginMethod: "feishu_oauth",
        success: true,
      });

      // 7. Look up membership for role / orgId
      const membership = await db.query.organizationMembers.findFirst({
        where: eq(organizationMembers.userId, userId),
      });

      // 8. Fetch the user row for the response
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatar,
        role: user.role || membership?.role || "supplier_staff",
        orgId: membership?.orgId || undefined,
      };
    } catch (err) {
      console.error("[feishu] OAuth authorize error:", err);

      // Record failed login attempt if we can identify the user
      try {
        await db.insert(loginLogs).values({
          loginMethod: "feishu_oauth",
          success: false,
          failureReason:
            err instanceof Error ? err.message : "Unknown error",
        });
      } catch {
        // Silently ignore logging failures
      }

      return null;
    }
  },
});
