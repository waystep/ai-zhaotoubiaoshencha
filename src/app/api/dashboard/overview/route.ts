import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { dashboardService } from "@/lib/services/dashboard-service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [overview, tenderMetrics, bidMetrics, riskInsights, knowledgeStats, modelUsage, teamActivity] =
      await Promise.all([
        dashboardService.getOverview(session.user.orgId),
        dashboardService.getTenderMetrics(session.user.orgId),
        dashboardService.getBidMetrics(session.user.orgId),
        dashboardService.getRiskInsights(session.user.orgId),
        dashboardService.getKnowledgeStats(session.user.orgId),
        dashboardService.getModelUsage(session.user.orgId),
        dashboardService.getTeamActivity(session.user.orgId),
      ]);

    return NextResponse.json({
      overview,
      tenderMetrics,
      bidMetrics,
      riskInsights,
      knowledgeStats,
      modelUsage,
      teamActivity,
    });
  } catch (error) {
    console.error("[dashboard/overview] 失败:", error);
    return NextResponse.json({ error: "获取仪表盘数据失败" }, { status: 500 });
  }
}
