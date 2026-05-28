// 投标预审 API — 触发完整审查流水线（A3→A4+A5→A6）
//
// 流程：
// 阶段1: A3 投标预审 — 规则驱动风险检测
// 阶段2: A4 风险定位 + A5 法规解析（可并行）
// 阶段3: A6 报告生成 — 汇总所有结果生成结构化报告

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documents, reviewReports } from "@/lib/db/schema";
import {
  isAuthFailure,
  requireProjectAccess,
} from "@/lib/auth/guards";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// POST: 触发完整审查流水线
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
    const documentId = body.documentId as string | undefined;
    const reportId = body.reportId as string | undefined;
    const organizationId = (body.organizationId as string) || project.orgId;

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

    // 5. 解析或创建审查报告
    let report;
    if (reportId) {
      report = await db.query.reviewReports.findFirst({
        where: and(
          eq(reviewReports.id, reportId),
          eq(reviewReports.projectId, projectId),
          eq(reviewReports.documentId, bidDoc.id)
        ),
      });
      if (!report) {
        return NextResponse.json(
          { error: "指定的审查报告不存在或不属于该项目" },
          { status: 404 }
        );
      }
    } else {
      // 查找或创建报告
      report = await db.query.reviewReports.findFirst({
        where: and(
          eq(reviewReports.projectId, projectId),
          eq(reviewReports.documentId, bidDoc.id)
        ),
        orderBy: (fields, { desc }) => [desc(fields.createdAt)],
      });

      if (!report) {
        const [created] = await db
          .insert(reviewReports)
          .values({
            projectId,
            documentId: bidDoc.id,
            status: "pending",
          })
          .returning();
        report = created;
      }
    }

    // 更新报告状态为进行中
    await db
      .update(reviewReports)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(reviewReports.id, report.id));

    const currentReportId = report.id;

    // ============================================================
    // 阶段1: A3 投标预审 — 风险检测
    // ============================================================
    const { mastra } = await import("@/mastra");

    const a3Agent = mastra.getAgentById("bid-review-agent");
    const a3Prompt = `
请对该项目的投标文件进行多维度风险检测，生成完整风险项列表。

输入：
- projectId: ${projectId}
- bidDocumentId: ${bidDoc.id}
- organizationId: ${organizationId}
- reportId: ${currentReportId}
- 文档名称: ${bidDoc.name}

请严格执行以下步骤：
1. 解析或创建审查报告（使用报告ID: ${currentReportId}）
2. 读取投标文档全文
3. 获取招标文件的审查项作为对比基准
4. 扫描投标文件中的法律法规引用并验证
5. 加载规则集并执行规则检查
6. AI语义分析（招标要求对照 + 关键参数比较）
7. 汇总风险项（按严重程度分级）
8. 存储结果到审查报告
9. 输出完整审查摘要
`;

    const a3Result = await a3Agent.generate(a3Prompt, {
      maxSteps: 30,
    });

    // ============================================================
    // 阶段2: A4 风险定位 + A5 法规解析（串行执行）
    // ============================================================

    // A4: 风险定位
    const a4Agent = mastra.getAgentById("risk-location-agent");
    const a4Prompt = `
请为该项目的审查风险项进行精确定位。

输入：
- projectId: ${projectId}
- documentId: ${bidDoc.id}
- reportId: ${currentReportId}
- organizationId: ${organizationId}

请严格执行以下步骤：
1. 获取报告信息和现有风险项列表
2. 读取投标文档全部区块内容
3. 对每个风险项执行多策略定位（精确匹配→关键词→语义搜索）
4. 回写精确定位数据到风险项
5. 输出定位覆盖率摘要
`;

    const a4Result = await a4Agent.generate(a4Prompt, {
      maxSteps: 20,
    });

    // A5: 法规解析
    const a5Agent = mastra.getAgentById("legal-parsing-agent");
    const a5Prompt = `
请为该项目的风险项进行法律法规深度分析。

输入：
- projectId: ${projectId}
- documentId: ${bidDoc.id}
- reportId: ${currentReportId}
- organizationId: ${organizationId}

请严格执行以下步骤：
1. 获取报告信息和现有风险项
2. 读取投标文档并扫描法规引用
3. 对每个风险项在知识库中搜索相关法规条款
4. 验证法规引用是否为最新版本
5. 进行合规性分析（合规/不合规/部分合规/待确认）
6. 存储包含法规依据的风险项
7. 输出法规分析摘要
`;

    const a5Result = await a5Agent.generate(a5Prompt, {
      maxSteps: 20,
    });

    // ============================================================
    // 阶段3: A6 报告生成
    // ============================================================

    const a6Agent = mastra.getAgentById("report-generation-agent-v2");
    const a6Prompt = `
请汇总所有审查结果，生成完整的结构化预审报告。

输入：
- reportId: ${currentReportId}
- projectId: ${projectId}
- documentId: ${bidDoc.id}

请严格执行以下步骤：
1. 获取报告信息（包含A3风险项、A4定位、A5法规分析的结果）
2. 获取图片风险检测结果
3. 计算综合评分和等级
4. 按类别聚合风险（资质/合规/技术/商务）
5. 生成结构化 Markdown 报告
6. 存储报告摘要和评分
`;

    const a6Result = await a6Agent.generate(a6Prompt, {
      maxSteps: 20,
    });

    // 更新报告状态为已完成
    await db
      .update(reviewReports)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(reviewReports.id, currentReportId));

    return NextResponse.json({
      success: true,
      reportId: currentReportId,
      documentId: bidDoc.id,
      documentName: bidDoc.name,
      pipeline: {
        a3: { text: a3Result.text, toolCalls: a3Result.toolCalls?.length || 0 },
        a4: { text: a4Result.text, toolCalls: a4Result.toolCalls?.length || 0 },
        a5: { text: a5Result.text, toolCalls: a5Result.toolCalls?.length || 0 },
        a6: { text: a6Result.text, toolCalls: a6Result.toolCalls?.length || 0 },
      },
    });
  } catch (error) {
    console.error("[ReviewBid] 投标预审流水线失败:", error);

    // 尝试将报告状态更新为失败
    try {
      const body = await request.clone().json().catch(() => ({}));
      if (body.reportId) {
        await db
          .update(reviewReports)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(reviewReports.id, body.reportId));
      }
    } catch {
      // 忽略状态更新失败
    }

    return NextResponse.json(
      {
        error: "投标预审过程中发生错误",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

// GET: 获取投标预审状态
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { projectId } = await context.params;

  const projectAccess = await requireProjectAccess(projectId);
  if (isAuthFailure(projectAccess)) return projectAccess.response;

  // 获取项目的审查报告列表
  const reports = await db.query.reviewReports.findMany({
    where: eq(reviewReports.projectId, projectId),
    columns: {
      id: true,
      documentId: true,
      status: true,
      aiScore: true,
      recommendation: true,
      summary: true,
      createdAt: true,
      completedAt: true,
    },
    orderBy: (fields, { desc }) => [desc(fields.createdAt)],
  });

  // 获取关联的文档名称
  const reportWithDocs = await Promise.all(
    reports.map(async (report) => {
      const doc = await db.query.documents.findFirst({
        where: eq(documents.id, report.documentId),
        columns: { id: true, name: true, docType: true },
      });
      return {
        ...report,
        documentName: doc?.name || null,
        documentType: doc?.docType || null,
        hasSummary: !!(report.summary && report.summary.length > 0),
      };
    })
  );

  return NextResponse.json({
    projectId,
    reports: reportWithDocs,
  });
}
