import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { reviewReports, documents, tenderProjects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// GET: 获取项目审查报告列表
export async function GET(
  request: Request,
  context: RouteContext
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;

  try {
    // 验证项目权限
    const project = await db.query.tenderProjects.findFirst({
      where: eq(tenderProjects.id, projectId),
    });

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    if (project.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "无权访问此项目" }, { status: 403 });
    }

    const reports = await db.query.reviewReports.findMany({
      where: eq(reviewReports.projectId, projectId),
      orderBy: [desc(reviewReports.createdAt)],
      with: {
        document: {
          columns: {
            id: true,
            name: true,
            docType: true,
          },
        },
        reviewer: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("获取审查报告列表失败:", error);
    return NextResponse.json(
      { error: "获取审查报告列表失败" },
      { status: 500 }
    );
  }
}

// POST: 创建审查任务
export async function POST(
  request: Request,
  context: RouteContext
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;

  try {
    // 验证项目权限
    const project = await db.query.tenderProjects.findFirst({
      where: eq(tenderProjects.id, projectId),
    });

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    if (project.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "无权操作此项目" }, { status: 403 });
    }

    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "缺少 documentId" },
        { status: 400 }
      );
    }

    // 检查文档是否属于该项目
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc || doc.projectId !== projectId) {
      return NextResponse.json(
        { error: "文档不存在或不属于该项目" },
        { status: 400 }
      );
    }

    // 创建审查报告
    const [report] = await db
      .insert(reviewReports)
      .values({
        projectId,
        documentId,
        reviewedBy: session.user.id,
        status: "pending",
      })
      .returning();

    return NextResponse.json({ report });
  } catch (error) {
    console.error("创建审查任务失败:", error);
    return NextResponse.json(
      { error: "创建审查任务失败" },
      { status: 500 }
    );
  }
}