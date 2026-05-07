import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { documents, tenderProjects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// GET: 获取项目文档列表
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

    const docs = await db.query.documents.findMany({
      where: eq(documents.projectId, projectId),
      orderBy: [desc(documents.createdAt)],
      with: {
        uploader: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ documents: docs });
  } catch (error) {
    console.error("获取文档列表失败:", error);
    return NextResponse.json(
      { error: "获取文档列表失败" },
      { status: 500 }
    );
  }
}

// POST: 上传文档（记录元数据）
// 注意：实际文件上传需要配合前端处理，这里只记录文档信息
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
    const { docType, name, originalName, fileSize, mimeType, storagePath } = body;

    if (!docType || !originalName || !fileSize || !mimeType || !storagePath) {
      return NextResponse.json(
        { error: "缺少必要字段" },
        { status: 400 }
      );
    }

    const [document] = await db
      .insert(documents)
      .values({
        projectId,
        uploadedBy: session.user.id,
        docType,
        name: name || originalName,
        originalName,
        fileSize,
        mimeType,
        storagePath,
        parseStatus: "pending",
      })
      .returning();

    return NextResponse.json({ document });
  } catch (error) {
    console.error("创建文档记录失败:", error);
    return NextResponse.json(
      { error: "创建文档记录失败" },
      { status: 500 }
    );
  }
}