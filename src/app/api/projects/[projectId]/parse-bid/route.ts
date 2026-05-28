// A7 投标文件解析 API — 触发投标文件解析智能体
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documents, bidDocuments } from "@/lib/db/schema";
import {
  isAuthFailure,
  requireProjectAccess,
} from "@/lib/auth/guards";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// POST: 触发 A7 投标文件解析智能体
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { projectId } = await context.params;

    // 1. 验证权限
    const projectAccess = await requireProjectAccess(projectId);
    if (isAuthFailure(projectAccess)) return projectAccess.response;

    const { project } = projectAccess;

    // 2. 解析请求体（可选参数）
    const body = await request.json().catch(() => ({}));
    const documentId = body.documentId as string | undefined;

    // 3. 查找投标文件
    let bidDoc;
    if (documentId) {
      bidDoc = await db.query.documents.findFirst({
        where: and(
          eq(documents.id, documentId),
          eq(documents.projectId, projectId),
          eq(documents.docType, "bid_doc")
        ),
      });
    } else {
      // 自动查找项目的第一个投标文件
      bidDoc = await db.query.documents.findFirst({
        where: and(
          eq(documents.projectId, projectId),
          eq(documents.docType, "bid_doc")
        ),
        orderBy: (fields, { desc }) => [desc(fields.createdAt)],
      });
    }

    if (!bidDoc) {
      return NextResponse.json(
        { error: "未找到投标文件，请先上传投标文件" },
        { status: 404 }
      );
    }

    // 4. 检查文档解析状态
    if (bidDoc.parseStatus !== "completed") {
      return NextResponse.json(
        {
          error: "投标文件尚未完成文本解析",
          parseStatus: bidDoc.parseStatus,
          documentId: bidDoc.id,
        },
        { status: 400 }
      );
    }

    // 5. 触发 A7 智能体
    const { mastra } = await import("@/mastra");
    const agent = mastra.getAgentById("bid-parsing-agent");

    const prompt = `
请解析该项目的投标文件，提取章节结构和关键信息，存储为结构化投标文档。

输入：
- projectId: ${projectId}
- documentId: ${bidDoc.id}
- 文档名称: ${bidDoc.name}
- 项目名称: ${project.name}

请严格执行以下步骤：
1. 读取投标文档全文
2. 识别文档章节结构
3. 提取关键信息（项目名称、投标金额、工期、资质信息、施工方案要点、报价信息）
4. 构建章节数组并使用"文档存储"工具保存（source 传 "uploaded"，documentFileId 传 "${bidDoc.id}"）
5. 输出完整的解析结果摘要
`;

    const result = await agent.generate(prompt, {
      maxSteps: 30,
    });

    return NextResponse.json({
      success: true,
      documentId: bidDoc.id,
      documentName: bidDoc.name,
      result: {
        text: result.text,
        toolCalls: result.toolCalls?.length || 0,
        usage: result.usage,
      },
    });
  } catch (error) {
    console.error("[ParseBid] 投标文件解析失败:", error);
    return NextResponse.json(
      {
        error: "投标文件解析过程中发生错误",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

// GET: 获取投标文件解析状态
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { projectId } = await context.params;

  const projectAccess = await requireProjectAccess(projectId);
  if (isAuthFailure(projectAccess)) return projectAccess.response;

  // 获取项目的投标文件列表及其解析状态
  const bidDocs = await db.query.documents.findMany({
    where: and(
      eq(documents.projectId, projectId),
      eq(documents.docType, "bid_doc")
    ),
    columns: {
      id: true,
      name: true,
      parseStatus: true,
      createdAt: true,
    },
  });

  // 获取已解析存储的投标文档列表
  const parsedDocs = await db
    .select({
      id: bidDocuments.id,
      title: bidDocuments.title,
      source: bidDocuments.source,
      version: bidDocuments.version,
      status: bidDocuments.status,
      createdAt: bidDocuments.createdAt,
    })
    .from(bidDocuments)
    .where(
      and(
        eq(bidDocuments.projectId, projectId),
        eq(bidDocuments.source, "uploaded")
      )
    );

  return NextResponse.json({
    projectId,
    bidDocuments: bidDocs,
    parsedDocuments: parsedDocs,
  });
}
