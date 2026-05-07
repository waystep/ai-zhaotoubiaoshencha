import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { reviewReports, reviewIssues, documentBlocks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createIssueSchema } from "@/types/review";

interface RouteContext {
  params: Promise<{ reportId: string }>;
}

// GET: 获取审查报告详情
export async function GET(
  request: Request,
  context: RouteContext
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reportId } = await context.params;

  try {
    const report = await db.query.reviewReports.findFirst({
      where: eq(reviewReports.id, reportId),
      with: {
        document: {
          columns: {
            id: true,
            name: true,
            docType: true,
            parseStatus: true,
          },
        },
        project: {
          columns: {
            id: true,
            name: true,
            projectNo: true,
          },
        },
        reviewer: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        issues: {
          columns: {
            id: true,
            category: true,
            severity: true,
            title: true,
            description: true,
            location: true,
            suggestion: true,
            isResolved: true,
            createdAt: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "报告不存在" }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error("获取审查报告失败:", error);
    return NextResponse.json(
      { error: "获取审查报告失败" },
      { status: 500 }
    );
  }
}