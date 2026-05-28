// A1 招标文件解析 API — 触发招标文件解析智能体
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documents, tenderProjects } from "@/lib/db/schema";
import {
  isAuthFailure,
  requireProjectAccess,
} from "@/lib/auth/guards";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// POST: 触发 A1 招标文件解析智能体
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { projectId } = await context.params;

    // 1. 验证权限
    const projectAccess = await requireProjectAccess(projectId);
    if (isAuthFailure(projectAccess)) return projectAccess.response;

    const { session, project } = projectAccess;

    // 2. 解析请求体（可选参数）
    const body = await request.json().catch(() => ({}));
    const documentId = body.documentId as string | undefined;

    // 3. 查找招标文件
    let tenderDoc;
    if (documentId) {
      tenderDoc = await db.query.documents.findFirst({
        where: and(
          eq(documents.id, documentId),
          eq(documents.projectId, projectId),
          eq(documents.docType, "tender_doc")
        ),
      });
    } else {
      // 自动查找项目的第一个招标文件
      tenderDoc = await db.query.documents.findFirst({
        where: and(
          eq(documents.projectId, projectId),
          eq(documents.docType, "tender_doc")
        ),
        orderBy: (fields, { desc }) => [desc(fields.createdAt)],
      });
    }

    if (!tenderDoc) {
      return NextResponse.json(
        { error: "未找到招标文件，请先上传招标文件" },
        { status: 404 }
      );
    }

    // 4. 检查文档解析状态
    if (tenderDoc.parseStatus !== "completed") {
      return NextResponse.json(
        {
          error: "招标文件尚未完成解析",
          parseStatus: tenderDoc.parseStatus,
          documentId: tenderDoc.id,
        },
        { status: 400 }
      );
    }

    // 5. 触发 A1 智能体
    const { mastra } = await import("@/mastra");
    const agent = mastra.getAgentById("tender-parsing-agent");

    const prompt = `
请解析该项目的招标文件，提取结构化审查数据并验证法律法规引用。

输入：
- projectId: ${projectId}
- documentId: ${tenderDoc.id}
- organizationId: ${project.orgId}
- 文档名称: ${tenderDoc.name}

请严格执行以下步骤：
1. 检查已有审查项
2. 读取招标文档全文
3. 提取并存储审查项（资质要求、技术要求、评分标准、关键信息）
4. 扫描文档中的法律法规引用
5. 验证法规引用是否为最新版本
6. 输出完整的解析结果摘要
`;

    const result = await agent.generate(prompt, {
      maxSteps: 30,
    });

    // 6. 更新文档提取状态
    await db
      .update(documents)
      .set({
        extractionStatus: "completed",
        extractedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, tenderDoc.id));

    return NextResponse.json({
      success: true,
      documentId: tenderDoc.id,
      documentName: tenderDoc.name,
      result: {
        text: result.text,
        toolCalls: result.toolCalls?.length || 0,
        usage: result.usage,
      },
    });
  } catch (error) {
    console.error("[ParseTender] 招标文件解析失败:", error);
    return NextResponse.json(
      {
        error: "招标文件解析过程中发生错误",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

// GET: 获取解析状态
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { projectId } = await context.params;

  const projectAccess = await requireProjectAccess(projectId);
  if (isAuthFailure(projectAccess)) return projectAccess.response;

  // 获取项目的招标文件及其提取状态
  const tenderDocs = await db.query.documents.findMany({
    where: and(
      eq(documents.projectId, projectId),
      eq(documents.docType, "tender_doc")
    ),
    columns: {
      id: true,
      name: true,
      parseStatus: true,
      extractionStatus: true,
      extractionItemsCount: true,
      extractedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    projectId,
    tenderDocuments: tenderDocs,
  });
}
