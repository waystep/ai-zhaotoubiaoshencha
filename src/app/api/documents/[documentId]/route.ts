import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { documents, tenderProjects, documentParsedResults, documentBlocks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { unlink } from "fs/promises";
import { existsSync } from "fs";

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

// GET: 获取文档详情
export async function GET(
  request: Request,
  context: RouteContext
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await context.params;

  try {
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      with: {
        project: {
          columns: {
            id: true,
            name: true,
            projectNo: true,
          },
        },
        uploader: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }

    // 验证权限 - 检查文档所属项目是否属于用户组织
    const project = await db.query.tenderProjects.findFirst({
      where: eq(tenderProjects.id, document.projectId),
    });

    if (!project || project.orgId !== session.user?.orgId) {
      return NextResponse.json({ error: "无权访问此文档" }, { status: 403 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error("获取文档详情失败:", error);
    return NextResponse.json(
      { error: "获取文档详情失败" },
      { status: 500 }
    );
  }
}

// DELETE: 删除文档
export async function DELETE(
  request: Request,
  context: RouteContext
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await context.params;

  try {
    // 获取文档信息
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!document) {
      return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }

    // 验证权限 - 检查文档所属项目是否属于用户组织
    const project = await db.query.tenderProjects.findFirst({
      where: eq(tenderProjects.id, document.projectId),
    });

    if (!project || project.orgId !== session.user?.orgId) {
      return NextResponse.json({ error: "无权删除此文档" }, { status: 403 });
    }

    // 删除物理文件
    if (document.storagePath && existsSync(document.storagePath)) {
      try {
        await unlink(document.storagePath);
        console.log(`[Delete] 已删除文件: ${document.storagePath}`);
      } catch (fileError) {
        console.warn(`[Delete] 删除文件失败: ${fileError}`);
        // 继续删除数据库记录，即使文件删除失败
      }
    }

    // 删除解析结果和区块（级联删除已配置，但手动删除更安全）
    const parsedResults = await db.query.documentParsedResults.findMany({
      where: eq(documentParsedResults.documentId, documentId),
    });

    for (const result of parsedResults) {
      // 删除区块
      await db.delete(documentBlocks).where(eq(documentBlocks.parsedResultId, result.id));
      // 删除解析结果
      await db.delete(documentParsedResults).where(eq(documentParsedResults.id, result.id));
    }

    // 删除文档记录
    await db.delete(documents).where(eq(documents.id, documentId));

    console.log(`[Delete] 已删除文档: ${documentId}`);

    return NextResponse.json({ success: true, message: "文档已删除" });
  } catch (error) {
    console.error("删除文档失败:", error);
    return NextResponse.json(
      { error: "删除文档失败" },
      { status: 500 }
    );
  }
}