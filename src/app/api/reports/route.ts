import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { reviewReports } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

// GET: 获取全部审查报告列表
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 获取用户组织的所有报告
    // 需要通过项目关联获取
    const reports = await db.query.reviewReports.findMany({
      orderBy: [desc(reviewReports.createdAt)],
      limit: 50,
      with: {
        document: {
          columns: {
            id: true,
            name: true,
            docType: true,
          },
        },
        project: {
          columns: {
            id: true,
            name: true,
            orgId: true,
          },
        },
      },
    });

    // 过滤出用户组织的报告
    const userReports = reports.filter(
      (r) => r.project?.orgId === session.user?.orgId
    );

    return NextResponse.json({ reports: userReports });
  } catch (error) {
    console.error("获取审查报告列表失败:", error);
    return NextResponse.json(
      { error: "获取审查报告列表失败" },
      { status: 500 }
    );
  }
}