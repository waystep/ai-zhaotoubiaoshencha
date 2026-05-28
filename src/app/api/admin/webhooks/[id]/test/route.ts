import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { webhooks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { webhookDispatcher } from "@/lib/services/webhook-dispatcher";

export async function POST(
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

    const result = await webhookDispatcher.testDelivery(webhook);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[webhooks/[id]/test] POST 失败:", error);
    return NextResponse.json({ error: "测试推送失败" }, { status: 500 });
  }
}
