/**
 * NextAuth WeChat (微信) OAuth Provider
 *
 * A custom CredentialsProvider (id: "wechat") that implements the WeChat
 * Website Application OAuth flow. Because WeChat's authorization URL is a
 * QR-code page and the token exchange is a single-step GET (not standard
 * OAuth2 POST), we wrap it inside a CredentialsProvider where the frontend
 * passes the authorization code obtained from the WeChat redirect.
 *
 * Flow:
 *   1. Frontend redirects user to WeChat QR-connect authorization URL
 *   2. User scans QR code with WeChat mobile app
 *   3. WeChat redirects back with an authorization `code`
 *   4. Frontend sends `code` to the NextAuth credentials endpoint (id: "wechat")
 *   5. This provider:
 *      a. Exchanges code + appid + secret for access_token + openid (single GET)
 *      b. Calls /sns/userinfo with access_token + openid
 *      c. Finds or creates user, records OAuth identity and login log
 *      d. Returns needsPhoneBinding flag if user has no phone number
 *
 * Env vars required:
 *   WECHAT_APP_ID        — 公众号/移动应用的 AppID
 *   WECHAT_APP_SECRET    — 公众号/移动应用的 AppSecret
 *   WECHAT_REDIRECT_URI  — OAuth 回调地址
 */

import Credentials from "next-auth/providers/credentials";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  users,
  userOAuthIdentities,
  loginLogs,
  organizationMembers,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// WeChat API helpers
// ---------------------------------------------------------------------------

const WECHAT_BASE = "https://api.weixin.qq.com";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface UserInfoResponse {
  openid: string;
  nickname: string;
  sex: number;
  language: string;
  city: string;
  province: string;
  country: string;
  headimgurl: string;
  privilege: string[];
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

/** Step 1: exchange authorization code for access_token + openid */
async function getAccessToken(
  code: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    appid: process.env.WECHAT_APP_ID!,
    secret: process.env.WECHAT_APP_SECRET!,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch(
    `${WECHAT_BASE}/sns/oauth2/access_token?${params.toString()}`,
    { method: "GET" },
  );

  const json = (await res.json()) as TokenResponse;

  if (json.errcode) {
    throw new Error(
      `WeChat access_token error: errcode=${json.errcode}, errmsg=${json.errmsg}`,
    );
  }

  return json;
}

/** Step 2: fetch user profile with access_token + openid */
async function getUserInfo(
  accessToken: string,
  openid: string,
): Promise<UserInfoResponse> {
  const params = new URLSearchParams({
    access_token: accessToken,
    openid,
    lang: "zh_CN",
  });

  const res = await fetch(
    `${WECHAT_BASE}/sns/userinfo?${params.toString()}`,
    { method: "GET" },
  );

  const json = (await res.json()) as UserInfoResponse;

  if (json.errcode) {
    throw new Error(
      `WeChat userinfo error: errcode=${json.errcode}, errmsg=${json.errmsg}`,
    );
  }

  return json;
}

// ---------------------------------------------------------------------------
// Provider definition
// ---------------------------------------------------------------------------

export const WeChatOAuthProvider = Credentials({
  id: "wechat",
  name: "wechat_oauth",
  credentials: {
    code: { label: "Authorization Code", type: "text" },
  },
  async authorize(credentials) {
    if (!credentials?.code) {
      return null;
    }

    const code = credentials.code as string;

    try {
      // 1. Exchange code for access_token + openid (single step)
      const tokenData = await getAccessToken(code);

      const openid = tokenData.openid;

      if (!openid) {
        console.error("[wechat] No openid returned from WeChat token exchange");
        return null;
      }

      // 2. Get user info from WeChat
      const wechatUser = await getUserInfo(tokenData.access_token, openid);

      // 3. Look up existing OAuth identity by provider + openid
      const existingIdentity = await db.query.userOAuthIdentities.findFirst({
        where: and(
          eq(userOAuthIdentities.provider, "wechat"),
          eq(userOAuthIdentities.providerAccountId, openid),
        ),
      });

      let userId: string;

      if (existingIdentity) {
        // Existing user — update tokens
        userId = existingIdentity.userId;

        await db
          .update(userOAuthIdentities)
          .set({
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
            profileData: wechatUser as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(userOAuthIdentities.id, existingIdentity.id));
      } else {
        // New user — auto-create account
        // WeChat does NOT provide email or phone; use placeholder email
        const email = `${openid}@wechat.placeholder`;

        const [newUser] = await db
          .insert(users)
          .values({
            email,
            name: wechatUser.nickname || "微信用户",
            avatar: wechatUser.headimgurl || null,
            phone: null,
            phoneVerified: null,
            lastLoginMethod: "wechat_oauth",
            lastLoginAt: new Date(),
          })
          .returning({ id: users.id });

        userId = newUser!.id;

        // Create OAuth identity record
        await db.insert(userOAuthIdentities).values({
          userId,
          provider: "wechat",
          providerAccountId: openid,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          profileData: wechatUser as unknown as Record<string, unknown>,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        });
      }

      // 4. Update last login info on user
      await db
        .update(users)
        .set({
          lastLoginAt: new Date(),
          lastLoginMethod: "wechat_oauth",
          // Update avatar / name if WeChat provides newer values
          avatar: wechatUser.headimgurl || undefined,
          name: wechatUser.nickname || undefined,
        })
        .where(eq(users.id, userId));

      // 5. Record login log
      await db.insert(loginLogs).values({
        userId,
        loginMethod: "wechat_oauth",
        success: true,
      });

      // 6. Look up membership for role / orgId
      const membership = await db.query.organizationMembers.findFirst({
        where: eq(organizationMembers.userId, userId),
      });

      // 7. Fetch the user row for the response
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return null;
      }

      // 8. Determine if phone binding is required
      // WeChat does NOT provide phone number — first-time users need to bind
      const needsPhoneBinding = !user.phone;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatar,
        role: user.role || membership?.role || "supplier_staff",
        orgId: membership?.orgId || undefined,
        // Custom flag: frontend should redirect to phone binding if true
        needsPhoneBinding,
      } as unknown as Awaited<ReturnType<NonNullable<typeof credentials>>>;
    } catch (err) {
      console.error("[wechat] OAuth authorize error:", err);

      // Record failed login attempt
      try {
        await db.insert(loginLogs).values({
          loginMethod: "wechat_oauth",
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
