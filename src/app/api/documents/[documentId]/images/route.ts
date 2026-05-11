// 图片风险分析查询 API
// GET: 获取文档的图片风险分析结果
import { db } from "@/lib/db/client";
import { imageRiskAnalysis } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

/**
 * GET /api/documents/[documentId]/images
 * 获取文档的图片风险分析结果
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { documentId } = await context.params;

    // 查询该文档的所有图片风险分析记录
    const imageRisks = await db.query.imageRiskAnalysis.findMany({
      where: eq(imageRiskAnalysis.documentId, documentId),
      orderBy: (imageRiskAnalysis, { asc }) => [asc(imageRiskAnalysis.pageNumber)],
    });

    // 统计风险情况
    const stats = {
      total: imageRisks.length,
      pending: imageRisks.filter((i) => i.status === "pending").length,
      processing: imageRisks.filter((i) => i.status === "processing").length,
      completed: imageRisks.filter((i) => i.status === "completed").length,
      failed: imageRisks.filter((i) => i.status === "failed").length,
      hasRisk: imageRisks.filter((i) => i.hasRisk === true).length,
    };

    return NextResponse.json({
      images: imageRisks,
      stats,
    });
  } catch (error) {
    console.error("[API] 获取图片风险分析失败:", error);
    return NextResponse.json(
      { error: "获取图片风险分析失败" },
      { status: 500 }
    );
  }
}