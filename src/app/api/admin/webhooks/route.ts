import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { webhooks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const list = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.organizationId, session.user.orgId))
      .orderBy(desc(webhooks.createdAt));

    return NextResponse.json({ webhooks: list });
  } catch (error) {
    console.error("[webhooks] GET 失败:", error);
    return NextResponse.json({ error: "获取 Webhook 列表失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, url, secret, events, headers, isActive, retryCount } = body;

    if (!name || !url || !events?.length) {
      return NextResponse.json(
        { error: "缺少必填字段：name, url, events" },
        { status: 400 },
      );
    }

    const [webhook] = await db
      .insert(webhooks)
      .values({
        name,
        url,
        secret: secret || null,
        events,
        headers: headers || null,
        isActive: isActive ?? true,
        retryCount: retryCount ?? 3,
        organizationId: session.user.orgId,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json({ webhook });
  } catch (error) {
    console.error("[webhooks] POST 失败:", error);
    return NextResponse.json({ error: "创建 Webhook 失败" }, { status: 500 });
  }
}
