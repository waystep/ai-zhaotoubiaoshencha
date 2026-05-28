// A2 投标文件生成 API — 触发投标文件生成智能体
import { NextRequest, NextResponse } from "next/server";
import { eq, and, count } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reviewItems, responseItems, bidDocuments } from "@/lib/db/schema";
import {
  isAuthFailure,
  requireProjectAccess,
} from "@/lib/auth/guards";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// POST: 触发 A2 投标文件生成智能体
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

    // 2. 解析请求体
    const body = await request.json().catch(() => ({}));
    const organizationId = body.organizationId as string | undefined;
    const industry = body.industry as string | undefined;
    const templateType = body.templateType as string | undefined;

    if (!organizationId) {
      return NextResponse.json(
        { error: "缺少 organizationId 参数" },
        { status: 400 }
      );
    }

    // 3. 检查是否有 A1 解析结果（reviewItems + responseItems）
    const [reviewCountResult] = await db
      .select({ count: count() })
      .from(reviewItems)
      .where(eq(reviewItems.projectId, projectId));

    const [responseCountResult] = await db
      .select({ count: count() })
      .from(responseItems)
      .where(eq(responseItems.projectId, projectId));

    const reviewCount = Number(reviewCountResult?.count ?? 0);
    const responseCount = Number(responseCountResult?.count ?? 0);

    if (reviewCount === 0 && responseCount === 0) {
      return NextResponse.json(
        {
          error: "未找到招标文件解析结果，请先执行招标文件解析（A1）",
          reviewItemCount: reviewCount,
          responseItemCount: responseCount,
        },
        { status: 400 }
      );
    }

    // 4. 触发 A2 智能体
    const { mastra } = await import("@/mastra");
    const agent = mastra.getAgentById("bid-generation-agent");

    const prompt = `
请为该项目生成投标文件 v1.0 初稿。

输入信息：
- projectId: ${projectId}
- organizationId: ${organizationId}
- 项目名称: ${project.name}
- 项目编号: ${project.projectNo}
- 行业类型: ${industry || "建筑工程"}
- 模板类型: ${templateType || "施工标"}
- 已有审查项: ${reviewCount} 条
- 已有响应项: ${responseCount} 条

请严格执行以下步骤：
1. 使用"模板选择"工具查找匹配的企业投标模板
2. 使用"大纲生成"工具创建章节大纲
3. 对每个章节使用"内容生成"工具生成 v1.0 内容
4. 使用"文档存储"工具保存完整投标文档
5. 输出生成结果摘要
`;

    const result = await agent.generate(prompt, {
      maxSteps: 50,
    });

    return NextResponse.json({
      success: true,
      projectId,
      projectName: project.name,
      reviewItemCount: reviewCount,
      responseItemCount: responseCount,
      result: {
        text: result.text,
        toolCalls: result.toolCalls?.length || 0,
        usage: result.usage,
      },
    });
  } catch (error) {
    console.error("[GenerateBid] 投标文件生成失败:", error);
    return NextResponse.json(
      {
        error: "投标文件生成过程中发生错误",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

// GET: 获取投标文件生成状态
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { projectId } = await context.params;

  const projectAccess = await requireProjectAccess(projectId);
  if (isAuthFailure(projectAccess)) return projectAccess.response;

  // 获取项目的解析结果数量
  const [reviewCountResult] = await db
    .select({ count: count() })
    .from(reviewItems)
    .where(eq(reviewItems.projectId, projectId));

  const [responseCountResult] = await db
    .select({ count: count() })
    .from(responseItems)
    .where(eq(responseItems.projectId, projectId));

  // 获取已生成的投标文档列表
  const generatedDocs = await db
    .select({
      id: bidDocuments.id,
      title: bidDocuments.title,
      source: bidDocuments.source,
      version: bidDocuments.version,
      status: bidDocuments.status,
      createdAt: bidDocuments.createdAt,
    })
    .from(bidDocuments)
    .where(eq(bidDocuments.projectId, projectId));

  return NextResponse.json({
    projectId,
    a1ParsingStatus: {
      reviewItemCount: Number(reviewCountResult?.count ?? 0),
      responseItemCount: Number(responseCountResult?.count ?? 0),
      ready: Number(reviewCountResult?.count ?? 0) > 0 || Number(responseCountResult?.count ?? 0) > 0,
    },
    generatedDocuments: generatedDocs,
  });
}
