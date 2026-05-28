/**
 * NextAuth Phone Credentials Provider
 *
 * A custom CredentialsProvider (id: "phone") that authenticates users
 * by validating a phone number + SMS verification code against the
 * smsVerificationCodes table.
 *
 * Usage: import and add to the `providers` array in auth/config.ts.
 */

import Credentials from "next-auth/providers/credentials";
import { and, eq, isNull, gt, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { smsVerificationCodes, users, organizationMembers } from "@/lib/db/schema";

export const PhoneCredentialsProvider = Credentials({
  id: "phone",
  name: "phone_sms",
  credentials: {
    phone: { label: "Phone", type: "text" },
    code: { label: "Verification Code", type: "text" },
    _validated: { label: "Internal", type: "text" },
  },
  async authorize(credentials) {
    if (!credentials?.phone || !credentials?.code) {
      return null;
    }

    const phone = credentials.phone as string;
    const code = credentials.code as string;

    // If the verify endpoint already validated the code, it passes
    // _validated = "true" so we can skip re-checking and just look up the user.
    const preValidated = credentials._validated === "true";

    if (!preValidated) {
      // Standalone validation: find latest unused non-expired code
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
        return null;
      }

      // Mark code as used
      await db
        .update(smsVerificationCodes)
        .set({ usedAt: new Date() })
        .where(eq(smsVerificationCodes.id, records[0]!.id));
    }

    // Look up user
    const user = await db.query.users.findFirst({
      where: eq(users.phone, phone),
    });

    if (!user) {
      return null;
    }

    // Get membership for role / orgId
    const membership = await db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.userId, user.id),
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.avatar,
      role: user.role || membership?.role || "supplier_staff",
      orgId: membership?.orgId || undefined,
    };
  },
});
