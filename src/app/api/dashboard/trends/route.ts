import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { dashboardService } from "@/lib/services/dashboard-service";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10), 1), 90);

  try {
    const modelUsage = await dashboardService.getModelUsage(session.user.orgId, days);
    return NextResponse.json({
      byDay: modelUsage.byDay,
      byModel: modelUsage.byModel,
      byAgent: modelUsage.byAgent,
    });
  } catch (error) {
    console.error("[dashboard/trends] 失败:", error);
    return NextResponse.json({ error: "获取趋势数据失败" }, { status: 500 });
  }
}
