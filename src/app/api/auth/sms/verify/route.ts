import { NextResponse } from "next/server";
import { and, eq, isNull, gt, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  smsVerificationCodes,
  loginLogs,
  loginLockouts,
  users,
  organizationMembers,
} from "@/lib/db/schema";
import { signIn } from "@/lib/auth/config";

// ---------------------------------------------------------------------------
// POST /api/auth/sms/verify
// Body: { phone: string, code: string }
// ---------------------------------------------------------------------------

const MAX_FAIL_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, code } = body;

    if (!phone || !code) {
      return NextResponse.json(
        { ok: false, error: "phone and code are required" },
        { status: 400 },
      );
    }

    // ---- check lockout ----
    const lockout = await db.query.loginLockouts.findFirst({
      where: eq(loginLockouts.identifier, phone),
    });

    if (lockout?.lockedUntil && new Date(lockout.lockedUntil) > new Date()) {
      return NextResponse.json(
        { ok: false, error: "验证次数过多，该手机号已被锁定，请30分钟后再试" },
        { status: 423 },
      );
    }

    // ---- find latest unused non-expired code ----
    const now = new Date();
    const records = await db
      .select()
      .from(smsVerificationCodes)
      .where(
        and(
          eq(smsVerificationCodes.phone, phone),
          eq(smsVerificationCodes.code, code),
          isNull(smsVerificationCodes.usedAt),
          gt(smsVerificationCodes.expiresAt, now),
        ),
      )
      .orderBy(sql`${smsVerificationCodes.createdAt} DESC`)
      .limit(1);

    if (records.length === 0) {
      // Record failed attempt
      await recordFailedAttempt(phone);

      return NextResponse.json(
        { ok: false, error: "验证码无效或已过期" },
        { status: 400 },
      );
    }

    // ---- mark code as used ----
    const verification = records[0];
    await db
      .update(smsVerificationCodes)
      .set({ usedAt: new Date() })
      .where(eq(smsVerificationCodes.id, verification!.id));

    // ---- look up user by phone ----
    const user = await db.query.users.findFirst({
      where: eq(users.phone, phone),
    });

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null;
    const ua = request.headers.get("user-agent") ?? null;

    if (!user) {
      // No account associated with this phone number
      await db.insert(loginLogs).values({
        userId: null,
        loginMethod: "phone_sms",
        ipAddress: ip,
        userAgent: ua,
        success: false,
        failureReason: "手机号未注册",
      });

      return NextResponse.json({
        ok: false,
        needsRegistration: true,
      });
    }

    // ---- clear lockout on success ----
    if (lockout) {
      await db
        .update(loginLockouts)
        .set({ failCount: 0, lockedUntil: null, updatedAt: new Date() })
        .where(eq(loginLockouts.id, lockout.id));
    }

    // ---- update user login info ----
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        lastLoginMethod: "phone_sms",
        phoneVerified: new Date(),
      })
      .where(eq(users.id, user.id));

    // ---- record successful login ----
    await db.insert(loginLogs).values({
      userId: user.id,
      loginMethod: "phone_sms",
      ipAddress: ip,
      userAgent: ua,
      success: true,
    });

    // ---- create NextAuth session ----
    // Use signIn with the "phone" credentials provider
    // The provider will validate, but since we already validated the code
    // we pass a special internal flag to skip re-validation
    await signIn("phone", {
      phone,
      code,
      // Internal flag to tell the provider we already validated
      _validated: "true",
      redirect: false,
    });

    // Get the membership for orgId
    const membership = await db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.userId, user.id),
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role || membership?.role || "supplier_staff",
        orgId: membership?.orgId ?? null,
      },
    });
  } catch (error) {
    console.error("[SMS Verify] error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function recordFailedAttempt(phone: string): Promise<void> {
  const existing = await db.query.loginLockouts.findFirst({
    where: eq(loginLockouts.identifier, phone),
  });

  if (existing) {
    const newCount = existing.failCount + 1;
    const lockedUntil =
      newCount >= MAX_FAIL_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : existing.lockedUntil;

    await db
      .update(loginLockouts)
      .set({
        failCount: newCount,
        lockedUntil,
        updatedAt: new Date(),
      })
      .where(eq(loginLockouts.id, existing.id));
  } else {
    await db.insert(loginLockouts).values({
      identifier: phone,
      failCount: 1,
    });
  }
}
