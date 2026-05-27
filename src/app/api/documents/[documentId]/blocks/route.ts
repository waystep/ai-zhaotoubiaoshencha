import { NextResponse } from "next/server";
import { isAuthFailure, requireDocumentAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { documentBlocks, documentParsedResults } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

// GET: 获取文档区块列表
export async function GET(
  request: Request,
  context: RouteContext
) {
  const { documentId } = await context.params;

  try {
    const access = await requireDocumentAccess(documentId);
    if (isAuthFailure(access)) return access.response;

    // 获取文档解析结果
    const parsedResult = await db.query.documentParsedResults.findFirst({
      where: eq(documentParsedResults.documentId, documentId),
    });

    if (!parsedResult) {
      return NextResponse.json(
        { error: "文档尚未解析" },
        { status: 404 }
      );
    }

    // 获取所有区块
    const blocks = await db.query.documentBlocks.findMany({
      where: eq(documentBlocks.parsedResultId, parsedResult.id),
      orderBy: (blocks, { asc }) => [asc(blocks.pageNumber), asc(blocks.blockIndex)],
    });

    return NextResponse.json({
      blocks,
      totalPages: parsedResult.totalPages,
      fullText: parsedResult.fullText,
    });
  } catch (error) {
    console.error("获取文档区块失败:", error);
    return NextResponse.json(
      { error: "获取文档区块失败" },
      { status: 500 }
    );
  }
}
