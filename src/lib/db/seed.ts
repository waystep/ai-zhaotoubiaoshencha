import "dotenv/config";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";

import { db } from "./client";
import { organizationMembers, organizations, users } from "./schema";

const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@ai-shencha.local";
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123456";
const adminName = process.env.SEED_ADMIN_NAME || "演示管理员";
const orgName = process.env.SEED_ORG_NAME || "智能投标预审演示组织";
const orgSlug = process.env.SEED_ORG_SLUG || "demo-tender-review";
const resetPassword = process.env.SEED_ADMIN_RESET_PASSWORD !== "false";

async function upsertDemoOrg() {
  const existing = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug),
  });

  if (existing) {
    const [updated] = await db
      .update(organizations)
      .set({
        name: orgName,
        orgType: "review_org",
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(organizations)
    .values({
      name: orgName,
      slug: orgSlug,
      orgType: "review_org",
    })
    .returning();

  return created;
}

async function upsertAdminUser() {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        name: adminName,
        emailVerified: true,
        role: "system_admin",
        updatedAt: new Date(),
        ...(resetPassword ? { passwordHash } : {}),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      email: adminEmail,
      emailVerified: true,
      name: adminName,
      passwordHash,
      role: "system_admin",
    })
    .returning();

  return created;
}

async function ensureMembership(orgId: string, userId: string) {
  const existing = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.orgId, orgId),
      eq(organizationMembers.userId, userId)
    ),
  });

  if (existing) {
    await db
      .update(organizationMembers)
      .set({ role: "owner" })
      .where(eq(organizationMembers.id, existing.id));
    return;
  }

  await db.insert(organizationMembers).values({
    orgId,
    userId,
    role: "owner",
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed the database.");
  }

  const org = await upsertDemoOrg();
  const admin = await upsertAdminUser();
  await ensureMembership(org.id, admin.id);

  console.log("Seed completed.");
  console.log(`Admin URL: ${process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000"}/login`);
  console.log(`Admin email: ${adminEmail}`);
  console.log(`Admin password: ${resetPassword ? adminPassword : "(unchanged)"}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });
