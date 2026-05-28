import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { webhooks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const webhook = await db.query.webhooks.findFirst({
      where: and(eq(webhooks.id, id), eq(webhooks.organizationId, session.user.orgId)),
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook 不存在" }, { status: 404 });
    }

    return NextResponse.json({ webhook });
  } catch (error) {
    console.error("[webhooks/[id]] GET 失败:", error);
    return NextResponse.json({ error: "获取 Webhook 失败" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.name !== undefined) updates.name = body.name;
    if (body.url !== undefined) updates.url = body.url;
    if (body.secret !== undefined) updates.secret = body.secret;
    if (body.events !== undefined) updates.events = body.events;
    if (body.headers !== undefined) updates.headers = body.headers;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.retryCount !== undefined) updates.retryCount = body.retryCount;

    const [updated] = await db
      .update(webhooks)
      .set(updates)
      .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, session.user.orgId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Webhook 不存在" }, { status: 404 });
    }

    return NextResponse.json({ webhook: updated });
  } catch (error) {
    console.error("[webhooks/[id]] PATCH 失败:", error);
    return NextResponse.json({ error: "更新 Webhook 失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [deleted] = await db
      .delete(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, session.user.orgId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Webhook 不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[webhooks/[id]] DELETE 失败:", error);
    return NextResponse.json({ error: "删除 Webhook 失败" }, { status: 500 });
  }
}
