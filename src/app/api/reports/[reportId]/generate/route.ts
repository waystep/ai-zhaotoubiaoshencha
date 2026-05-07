import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import {
  reviewReports,
  reviewIssues,
  documents,
  documentParsedResults,
  documentBlocks,
  tenderProjects,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { reviewDocument } from "@/lib/ai/review-agent";
import type { MineruBlockType, MineruParseResult } from "@/types/mineru";

interface RouteContext {
  params: Promise<{ reportId: string }>;
}

// POST: 生成审查报告
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
    // 获取报告信息
    const report = await db.query.reviewReports.findFirst({
      where: eq(reviewReports.id, reportId),
      with: {
        document: true,
        project: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "报告不存在" }, { status: 404 });
    }

    // 检查报告状态
    if (report.status !== "pending") {
      return NextResponse.json(
        { error: "报告已生成或正在生成中" },
        { status: 400 }
      );
    }

    // 检查文档是否已解析
    const doc = report.document;
    if (doc.parseStatus !== "completed") {
      return NextResponse.json(
        { error: "文档尚未解析完成，请先解析文档" },
        { status: 400 }
      );
    }

    // 更新报告状态为 in_progress
    await db
      .update(reviewReports)
      .set({
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(eq(reviewReports.id, reportId));

    // 获取文档解析结果
    const parsedResult = await db.query.documentParsedResults.findFirst({
      where: eq(documentParsedResults.documentId, doc.id),
      with: {
        blocks: true,
      },
    });

    if (!parsedResult) {
      // 恢复状态
      await db
        .update(reviewReports)
        .set({
          status: "pending",
          updatedAt: new Date(),
        })
        .where(eq(reviewReports.id, reportId));

      return NextResponse.json(
        { error: "文档解析结果不存在" },
        { status: 400 }
      );
    }

    // 构建 MinerU 解析结果格式
    const mineruResult: MineruParseResult = {
      taskId: parsedResult.id,
      status: "completed" as const,
      totalPages: parsedResult.totalPages,
      fullText: parsedResult.fullText || "",
      structured: parsedResult.structuredContent as Record<string, unknown>,
      blocks: parsedResult.blocks.map((block) => ({
        id: block.id,
        pageNumber: block.pageNumber,
        index: block.blockIndex,
        type: (block.blockType || "text") as MineruBlockType,
        content: block.content,
        bbox: block.bbox as { x0: number; y0: number; x1: number; y1: number } | null,
      })),
      tables: [],
      images: [],
      equations: [],
      raw: {
        status: "success",
        totalPages: parsedResult.totalPages,
        ...parsedResult.mineruRawData as Record<string, unknown>,
      },
    };

    // 执行 AI 审查
    const reviewResult = await reviewDocument(
      doc.id,
      mineruResult,
      doc.docType
    );

    // 更新报告信息
    const [updatedReport] = await db
      .update(reviewReports)
      .set({
        status: "completed",
        aiScore: reviewResult.score.toString(),
        aiAnalysis: reviewResult.analysis,
        summary: reviewResult.summary,
        recommendation: reviewResult.recommendation,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviewReports.id, reportId))
      .returning();

    // 存储问题清单
    for (const issue of reviewResult.issues) {
      // 查找对应的 blockId
      let blockId: string | undefined = undefined;
      if (issue.location.blockIndex >= 0) {
        const block = parsedResult.blocks.find(
          (b) =>
            b.pageNumber === issue.location.pageNumber &&
            b.blockIndex === issue.location.blockIndex
        );
        if (block) {
          blockId = block.id;
        }
      }

      await db.insert(reviewIssues).values({
        reportId,
        blockId,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        location: {
          pageNumber: issue.location.pageNumber,
          blockIndex: issue.location.blockIndex,
          bbox: issue.location.bbox,
          textSnippet: issue.location.textSnippet,
          highlightText: issue.location.highlightText,
        },
        suggestion: issue.suggestion,
        isResolved: false,
      });
    }

    return NextResponse.json({
      success: true,
      report: {
        id: updatedReport.id,
        status: updatedReport.status,
        aiScore: updatedReport.aiScore,
        recommendation: updatedReport.recommendation,
        summary: updatedReport.summary,
        issueCount: reviewResult.issues.length,
      },
    });
  } catch (error) {
    console.error("生成审查报告失败:", error);

    // 恢复状态
    await db
      .update(reviewReports)
      .set({
        status: "pending",
        updatedAt: new Date(),
      })
      .where(eq(reviewReports.id, reportId));

    return NextResponse.json(
      { error: "生成审查报告失败", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}