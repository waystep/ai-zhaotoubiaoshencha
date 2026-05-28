import { NextResponse } from "next/server";
import { and, eq, gte, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { smsVerificationCodes, loginLockouts } from "@/lib/db/schema";
import { createSMSService } from "@/lib/auth/sms";

// ---------------------------------------------------------------------------
// POST /api/auth/sms/send
// Body: { phone: string, purpose: "login" | "register" | "reset" | "bind_phone" }
// ---------------------------------------------------------------------------

const PHONE_REGEX = /^1[3-9]\d{9}$/;
const MAX_CODES_PER_HOUR = 5;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, purpose } = body;

    // ---- basic validation ----
    if (!phone || !purpose) {
      return NextResponse.json(
        { ok: false, error: "phone and purpose are required" },
        { status: 400 },
      );
    }

    if (!PHONE_REGEX.test(phone)) {
      return NextResponse.json(
        { ok: false, error: "手机号格式不正确，请输入11位中国手机号" },
        { status: 400 },
      );
    }

    const validPurposes = ["login", "register", "reset", "bind_phone"];
    if (!validPurposes.includes(purpose)) {
      return NextResponse.json(
        { ok: false, error: "purpose must be one of: login, register, reset, bind_phone" },
        { status: 400 },
      );
    }

    // ---- rate limit: max 5 codes per phone per hour ----
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCodes = await db
      .select()
      .from(smsVerificationCodes)
      .where(
        and(
          eq(smsVerificationCodes.phone, phone),
          gte(smsVerificationCodes.createdAt, oneHourAgo),
        ),
      );

    if (recentCodes.length >= MAX_CODES_PER_HOUR) {
      return NextResponse.json(
        { ok: false, error: "发送过于频繁，请1小时后再试" },
        { status: 429 },
      );
    }

    // ---- check login lockout ----
    const lockout = await db.query.loginLockouts.findFirst({
      where: eq(loginLockouts.identifier, phone),
    });

    if (lockout?.lockedUntil && new Date(lockout.lockedUntil) > new Date()) {
      return NextResponse.json(
        { ok: false, error: "该手机号已被锁定，请稍后再试" },
        { status: 423 },
      );
    }

    // ---- generate & persist code ----
    const smsService = createSMSService();
    const code = smsService.generateCode();
    const expiresAt = new Date(
      Date.now() + smsService.getExpiryMinutes() * 60 * 1000,
    );

    // Extract client IP from headers
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;

    await db.insert(smsVerificationCodes).values({
      phone,
      code,
      purpose,
      expiresAt,
      ipAddress: ip,
    });

    // ---- send via SMS provider ----
    const result = await smsService.sendCode(phone, code, purpose);

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: "短信发送失败，请稍后再试" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[SMS Send] error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
