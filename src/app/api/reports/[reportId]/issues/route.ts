import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { reviewIssues, reviewReports } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createIssueSchema } from "@/types/review";

interface RouteContext {
  params: Promise<{ reportId: string }>;
}

// GET: 获取审查问题列表
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
    const issues = await db.query.reviewIssues.findMany({
      where: eq(reviewIssues.reportId, reportId),
      orderBy: [
        desc(reviewIssues.severity),  // 按严重程度排序
        desc(reviewIssues.createdAt),
      ],
    });

    return NextResponse.json({ issues });
  } catch (error) {
    console.error("获取问题列表失败:", error);
    return NextResponse.json(
      { error: "获取问题列表失败" },
      { status: 500 }
    );
  }
}

// POST: 添加审查问题
export async function POST(
  request: Request,
  context: RouteContext
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reportId } = await context.params;

  try {
    // 验证报告存在
    const report = await db.query.reviewReports.findFirst({
      where: eq(reviewReports.id, reportId),
    });

    if (!report) {
      return NextResponse.json({ error: "报告不存在" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = createIssueSchema.parse({
      ...body,
      reportId,  // 使用路由中的 reportId
    });

    const [issue] = await db
      .insert(reviewIssues)
      .values({
        reportId: validatedData.reportId,
        blockId: validatedData.blockId,
        category: validatedData.category,
        severity: validatedData.severity,
        title: validatedData.title,
        description: validatedData.description,
        location: validatedData.location,
        suggestion: validatedData.suggestion,
        isResolved: false,
      })
      .returning();

    return NextResponse.json({ issue });
  } catch (error) {
    console.error("添加审查问题失败:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "数据验证失败", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "添加审查问题失败" },
      { status: 500 }
    );
  }
}