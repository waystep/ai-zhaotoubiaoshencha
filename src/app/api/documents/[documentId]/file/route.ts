import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { documents, tenderProjects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

/**
 * 流式返回原始文件（供浏览器 PDF.js / react-pdf 拉取）
 * 权限模型与 GET /api/documents/[documentId] 一致
 */
export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await context.params;

  try {
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!document) {
      return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }

    const project = await db.query.tenderProjects.findFirst({
      where: eq(tenderProjects.id, document.projectId),
    });

    if (!project || project.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "无权访问此文档" }, { status: 403 });
    }

    const filePath = document.storagePath;
    if (!filePath || !existsSync(filePath)) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }

    const fileStat = await stat(filePath);
    const buf = await readFile(filePath);

    const name = document.originalName || document.name || "document";
    const contentType = document.mimeType || "application/octet-stream";

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileStat.size),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[Document file] 读取失败:", error);
    return NextResponse.json({ error: "读取文件失败" }, { status: 500 });
  }
}
