import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { tenderProjects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateProjectSchema } from "@/types/tender";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// GET: 获取项目详情
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
    const project = await db.query.tenderProjects.findFirst({
      where: eq(tenderProjects.id, projectId),
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        documents: {
          columns: {
            id: true,
            name: true,
            docType: true,
            parseStatus: true,
            createdAt: true,
          },
        },
        reviewReports: {
          columns: {
            id: true,
            status: true,
            aiScore: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    // 验证权限
    if (project.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "无权访问此项目" }, { status: 403 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("获取项目详情失败:", error);
    return NextResponse.json(
      { error: "获取项目详情失败" },
      { status: 500 }
    );
  }
}

// PUT: 更新项目
export async function PUT(
  request: Request,
  context: RouteContext
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;

  try {
    const body = await request.json();
    const validatedData = updateProjectSchema.parse(body);

    // 检查项目是否存在且属于用户组织
    const existingProject = await db.query.tenderProjects.findFirst({
      where: eq(tenderProjects.id, projectId),
    });

    if (!existingProject) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    if (existingProject.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "无权修改此项目" }, { status: 403 });
    }

    const [updatedProject] = await db
      .update(tenderProjects)
      .set({
        ...validatedData,
        budget: validatedData.budget?.toString(),
        deadline: validatedData.deadline ? new Date(validatedData.deadline) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(tenderProjects.id, projectId))
      .returning();

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error("更新项目失败:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "数据验证失败", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "更新项目失败" },
      { status: 500 }
    );
  }
}

// DELETE: 删除项目
export async function DELETE(
  request: Request,
  context: RouteContext
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;

  try {
    // 检查项目是否存在且属于用户组织
    const existingProject = await db.query.tenderProjects.findFirst({
      where: eq(tenderProjects.id, projectId),
    });

    if (!existingProject) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    if (existingProject.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "无权删除此项目" }, { status: 403 });
    }

    await db.delete(tenderProjects).where(eq(tenderProjects.id, projectId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除项目失败:", error);
    return NextResponse.json(
      { error: "删除项目失败" },
      { status: 500 }
    );
  }
}