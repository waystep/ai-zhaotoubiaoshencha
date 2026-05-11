import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { documents, documentPageEmbeddings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generatePageEmbeddings } from "@/lib/ai/embedding";

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

/**
 * POST: 为文档生成页面级嵌入向量（RAG索引）
 * 在文档解析完成后调用
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await context.params;

  try {
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }

    if (doc.parseStatus !== "completed") {
      return NextResponse.json(
        { error: "文档尚未解析完成" },
        { status: 400 }
      );
    }

    const count = await generatePageEmbeddings(documentId);

    return NextResponse.json({
      success: true,
      stored: count,
      message: `已为文档生成 ${count} 个页面嵌入`,
    });
  } catch (error) {
    console.error("[Embeddings] 生成失败:", error);
    return NextResponse.json(
      {
        error: "生成嵌入向量失败",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

/**
 * GET: 查询文档的嵌入状态
 */
export async function GET(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await context.params;

  try {
    const pages = await db.query.documentPageEmbeddings.findMany({
      where: eq(documentPageEmbeddings.documentId, documentId),
      columns: { pageNumber: true, embeddingModel: true, createdAt: true },
      orderBy: (fields, { asc }) => [asc(fields.pageNumber)],
    });

    return NextResponse.json({
      hasEmbeddings: pages.length > 0,
      totalPages: pages.length,
      model: pages[0]?.embeddingModel || null,
      createdAt: pages[0]?.createdAt || null,
      pages: pages.map((p) => p.pageNumber),
    });
  } catch (error) {
    console.error("[Embeddings] 查询失败:", error);
    return NextResponse.json(
      { error: "查询嵌入状态失败" },
      { status: 500 }
    );
  }
}
