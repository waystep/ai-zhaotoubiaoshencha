import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { webhooks, webhookDeliveryLogs } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

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
    // Verify webhook belongs to org
    const webhook = await db.query.webhooks.findFirst({
      where: and(eq(webhooks.id, id), eq(webhooks.organizationId, session.user.orgId)),
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook 不存在" }, { status: 404 });
    }

    const logs = await db
      .select()
      .from(webhookDeliveryLogs)
      .where(eq(webhookDeliveryLogs.webhookId, id))
      .orderBy(desc(webhookDeliveryLogs.createdAt))
      .limit(50);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[webhooks/[id]/logs] GET 失败:", error);
    return NextResponse.json({ error: "获取推送日志失败" }, { status: 500 });
  }
}
