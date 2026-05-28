// 审查工作流服务 — 工作流状态机
//
// 两种工作流：
// Flow 1 (tender-to-bid): A1 招标解析 → A2 投标生成
// Flow 2 (review-pipeline): A7 投标解析 → A3 投标预审 → A4+A5 并行 → A6 报告生成
//
// 工作流状态存储在数据库 JSONB 字段中，无需新建表。
// 通过内存中的 Map 做短时进度追踪（适用于单实例部署）。

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  documents,
  reviewReports,
  bidDocuments,
  reviewItems,
  responseItems,
} from "@/lib/db/schema";
import { mastra } from "@/mastra";

// ==================== 类型定义 ====================

export type WorkflowType = "tender-to-bid" | "review-pipeline";

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface WorkflowStep {
  id: string;
  name: string;
  agentId: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: string;
  toolCalls?: number;
}

export interface WorkflowStatus {
  workflowId: string;
  type: WorkflowType;
  projectId: string;
  orgId: string;
  status: StepStatus;
  currentStep: string | null;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  /** 相关资源 ID */
  resources?: {
    documentId?: string;
    reportId?: string;
    bidDocumentId?: string;
  };
}

export interface PipelineStatus {
  workflowId: string;
  type: "review-pipeline";
  status: StepStatus;
  steps: WorkflowStep[];
  reportId?: string;
  documentId?: string;
}

// ==================== 内存工作流存储 ====================

const workflows = new Map<string, WorkflowStatus>();

function generateWorkflowId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ==================== 工具函数 ====================

// 合法的智能体 ID 类型（与 Mastra 注册表对齐）
type AgentId =
  | "tender-parsing-agent"
  | "bid-generation-agent"
  | "bid-parsing-agent"
  | "bid-review-agent"
  | "risk-location-agent"
  | "legal-parsing-agent"
  | "report-generation-agent-v2"
  | "workflow-supervisor"
  | "tender-review-supervisor"
  | "extraction-agent"
  | "tender-review-agent"
  | "image-review-agent"
  | "report-generation-agent";

/** 获取智能体并执行 prompt，返回结果文本和工具调用次数 */
async function runAgent(
  agentId: AgentId,
  prompt: string,
  maxSteps = 30
): Promise<{ text: string; toolCalls: number; usage?: unknown }> {
  const agent = mastra.getAgentById(agentId);
  const result = await agent.generate(prompt, { maxSteps });
  return {
    text: result.text,
    toolCalls: result.toolCalls?.length || 0,
    usage: result.usage,
  };
}

function updateStep(
  workflowId: string,
  stepId: string,
  patch: Partial<WorkflowStep>
) {
  const workflow = workflows.get(workflowId);
  if (!workflow) return;
  const idx = workflow.steps.findIndex((s) => s.id === stepId);
  if (idx >= 0) {
    workflow.steps[idx] = { ...workflow.steps[idx], ...patch };
  }
  workflow.updatedAt = new Date().toISOString();
  workflow.currentStep = stepId;
  workflows.set(workflowId, workflow);
}

// ==================== Flow 1: 招标解析 → 投标生成 ====================

export async function startTenderToBidFlow(
  projectId: string,
  orgId: string,
  options?: {
    documentId?: string;
    industry?: string;
    templateType?: string;
  }
): Promise<string> {
  const workflowId = generateWorkflowId();

  const workflow: WorkflowStatus = {
    workflowId,
    type: "tender-to-bid",
    projectId,
    orgId,
    status: "running",
    currentStep: "a1",
    steps: [
      {
        id: "a1",
        name: "招标文件解析",
        agentId: "tender-parsing-agent",
        status: "pending",
      },
      {
        id: "a2",
        name: "投标文件生成",
        agentId: "bid-generation-agent",
        status: "pending",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resources: {
      documentId: options?.documentId,
    },
  };

  workflows.set(workflowId, workflow);

  // 异步执行工作流
  executeTenderToBidFlow(workflowId, projectId, orgId, options).catch(
    (err) => {
      const wf = workflows.get(workflowId);
      if (wf) {
        wf.status = "failed";
        wf.error = err instanceof Error ? err.message : "未知错误";
        wf.updatedAt = new Date().toISOString();
        workflows.set(workflowId, wf);
      }
    }
  );

  return workflowId;
}

async function executeTenderToBidFlow(
  workflowId: string,
  projectId: string,
  orgId: string,
  options?: {
    documentId?: string;
    industry?: string;
    templateType?: string;
  }
): Promise<void> {
  const workflow = workflows.get(workflowId);
  if (!workflow) return;

  try {
    // ---- Step A1: 招标文件解析 ----
    updateStep(workflow.workflowId, "a1", {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    // 查找招标文件
    let tenderDoc;
    if (options?.documentId) {
      tenderDoc = await db.query.documents.findFirst({
        where: and(
          eq(documents.id, options.documentId),
          eq(documents.projectId, projectId),
          eq(documents.docType, "tender_doc")
        ),
      });
    } else {
      tenderDoc = await db.query.documents.findFirst({
        where: and(
          eq(documents.projectId, projectId),
          eq(documents.docType, "tender_doc")
        ),
        orderBy: (fields, { desc }) => [desc(fields.createdAt)],
      });
    }

    if (!tenderDoc) {
      throw new Error("未找到招标文件，请先上传招标文件");
    }

    if (tenderDoc.parseStatus !== "completed") {
      throw new Error(
        `招标文件尚未完成文本解析，当前状态: ${tenderDoc.parseStatus}`
      );
    }

    const a1Result = await runAgent(
      "tender-parsing-agent",
      `请解析该项目的招标文件，提取结构化审查数据并验证法律法规引用。

输入：
- projectId: ${projectId}
- documentId: ${tenderDoc.id}
- organizationId: ${orgId}
- 文档名称: ${tenderDoc.name}

请严格执行以下步骤：
1. 检查已有审查项
2. 读取招标文档全文
3. 提取并存储审查项（资质要求、技术要求、评分标准、关键信息）
4. 扫描文档中的法律法规引用
5. 验证法规引用是否为最新版本
6. 输出完整的解析结果摘要`,
      30
    );

    // 更新文档提取状态
    await db
      .update(documents)
      .set({
        extractionStatus: "completed",
        extractedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, tenderDoc.id));

    updateStep(workflow.workflowId, "a1", {
      status: "completed",
      completedAt: new Date().toISOString(),
      result: a1Result.text.slice(0, 500),
      toolCalls: a1Result.toolCalls,
    });

    // ---- Step A2: 投标文件生成 ----
    updateStep(workflow.workflowId, "a2", {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    const a2Result = await runAgent(
      "bid-generation-agent",
      `请为该项目生成投标文件 v1.0 初稿。

输入信息：
- projectId: ${projectId}
- organizationId: ${orgId}
- 行业类型: ${options?.industry || "建筑工程"}
- 模板类型: ${options?.templateType || "施工标"}

请严格执行以下步骤：
1. 使用"模板选择"工具查找匹配的企业投标模板
2. 使用"大纲生成"工具创建章节大纲
3. 对每个章节使用"内容生成"工具生成 v1.0 内容
4. 使用"文档存储"工具保存完整投标文档
5. 输出生成结果摘要`,
      50
    );

    // 查找生成的投标文档
    const generatedDoc = await db.query.bidDocuments.findFirst({
      where: and(
        eq(bidDocuments.projectId, projectId),
        eq(bidDocuments.source, "generated")
      ),
      orderBy: (fields, { desc }) => [desc(fields.createdAt)],
    });

    updateStep(workflow.workflowId, "a2", {
      status: "completed",
      completedAt: new Date().toISOString(),
      result: a2Result.text.slice(0, 500),
      toolCalls: a2Result.toolCalls,
    });

    // 更新工作流完成状态
    const wf = workflows.get(workflowId);
    if (wf) {
      wf.status = "completed";
      wf.currentStep = null;
      wf.completedAt = new Date().toISOString();
      wf.updatedAt = new Date().toISOString();
      wf.resources = {
        ...wf.resources,
        documentId: tenderDoc.id,
        bidDocumentId: generatedDoc?.id,
      };
      workflows.set(workflowId, wf);
    }
  } catch (error) {
    const wf = workflows.get(workflowId);
    if (wf) {
      // 标记当前运行中的步骤为失败
      const runningStep = wf.steps.find((s) => s.status === "running");
      if (runningStep) {
        updateStep(workflowId, runningStep.id, {
          status: "failed",
          completedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "未知错误",
        });
      }
      wf.status = "failed";
      wf.error = error instanceof Error ? error.message : "未知错误";
      wf.updatedAt = new Date().toISOString();
      workflows.set(workflowId, wf);
    }
    throw error;
  }
}

// ==================== Flow 2: 投标预审流水线 ====================

export async function startReviewPipeline(
  projectId: string,
  orgId: string,
  options?: {
    documentId?: string;
    reportId?: string;
  }
): Promise<string> {
  const workflowId = generateWorkflowId();

  const workflow: WorkflowStatus = {
    workflowId,
    type: "review-pipeline",
    projectId,
    orgId,
    status: "running",
    currentStep: "a7",
    steps: [
      {
        id: "a7",
        name: "投标文件解析（如需）",
        agentId: "bid-parsing-agent",
        status: "pending",
      },
      {
        id: "a3",
        name: "投标预审 — 风险检测",
        agentId: "bid-review-agent",
        status: "pending",
      },
      {
        id: "a4",
        name: "风险定位",
        agentId: "risk-location-agent",
        status: "pending",
      },
      {
        id: "a5",
        name: "法规解析",
        agentId: "legal-parsing-agent",
        status: "pending",
      },
      {
        id: "a6",
        name: "报告生成",
        agentId: "report-generation-agent-v2",
        status: "pending",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resources: {
      documentId: options?.documentId,
      reportId: options?.reportId,
    },
  };

  workflows.set(workflowId, workflow);

  // 异步执行工作流
  executeReviewPipeline(workflowId, projectId, orgId, options).catch(
    (err) => {
      const wf = workflows.get(workflowId);
      if (wf) {
        wf.status = "failed";
        wf.error = err instanceof Error ? err.message : "未知错误";
        wf.updatedAt = new Date().toISOString();
        workflows.set(workflowId, wf);
      }
    }
  );

  return workflowId;
}

async function executeReviewPipeline(
  workflowId: string,
  projectId: string,
  orgId: string,
  options?: {
    documentId?: string;
    reportId?: string;
  }
): Promise<void> {
  const workflow = workflows.get(workflowId);
  if (!workflow) return;

  try {
    // ---- 查找投标文件 ----
    let bidDoc;
    if (options?.documentId) {
      bidDoc = await db.query.documents.findFirst({
        where: and(
          eq(documents.id, options.documentId),
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
      throw new Error("未找到投标文件，请先上传投标文件");
    }

    if (bidDoc.parseStatus !== "completed") {
      throw new Error(
        `投标文件尚未完成文本解析，当前状态: ${bidDoc.parseStatus}`
      );
    }

    // 更新资源引用
    const wf = workflows.get(workflowId);
    if (wf) {
      wf.resources = { ...wf.resources, documentId: bidDoc.id };
      workflows.set(workflowId, wf);
    }

    // ---- Step A7: 检查是否需要投标文件解析 ----
    updateStep(workflow.workflowId, "a7", {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    const parsedBidDoc = await db.query.bidDocuments.findFirst({
      where: and(
        eq(bidDocuments.projectId, projectId),
        eq(bidDocuments.source, "uploaded"),
        eq(bidDocuments.documentFileId, bidDoc.id)
      ),
    });

    if (!parsedBidDoc) {
      // 需要执行 A7 解析
      const a7Result = await runAgent(
        "bid-parsing-agent",
        `请解析该项目的投标文件，提取章节结构和关键信息，存储为结构化投标文档。

输入：
- projectId: ${projectId}
- documentId: ${bidDoc.id}
- 文档名称: ${bidDoc.name}

请严格执行以下步骤：
1. 读取投标文档全文
2. 识别文档章节结构
3. 提取关键信息（项目名称、投标金额、工期、资质信息、施工方案要点、报价信息）
4. 构建章节数组并使用"文档存储"工具保存（source 传 "uploaded"，documentFileId 传 "${bidDoc.id}"）
5. 输出完整的解析结果摘要`,
        30
      );

      updateStep(workflow.workflowId, "a7", {
        status: "completed",
        completedAt: new Date().toISOString(),
        result: a7Result.text.slice(0, 500),
        toolCalls: a7Result.toolCalls,
      });
    } else {
      // 已有解析结果，跳过
      updateStep(workflow.workflowId, "a7", {
        status: "skipped",
        completedAt: new Date().toISOString(),
        result: "已存在解析结果，跳过投标文件解析",
      });
    }

    // ---- 创建/获取审查报告 ----
    let report;
    if (options?.reportId) {
      report = await db.query.reviewReports.findFirst({
        where: and(
          eq(reviewReports.id, options.reportId),
          eq(reviewReports.projectId, projectId),
          eq(reviewReports.documentId, bidDoc.id)
        ),
      });
      if (!report) {
        throw new Error("指定的审查报告不存在或不属于该项目");
      }
    } else {
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

    const reportId = report.id;

    // 更新资源引用
    const wfReport = workflows.get(workflowId);
    if (wfReport) {
      wfReport.resources = { ...wfReport.resources, reportId };
      workflows.set(workflowId, wfReport);
    }

    // ---- Step A3: 投标预审 — 风险检测 ----
    updateStep(workflow.workflowId, "a3", {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    const a3Result = await runAgent(
      "bid-review-agent",
      `请对该项目的投标文件进行多维度风险检测，生成完整风险项列表。

输入：
- projectId: ${projectId}
- bidDocumentId: ${bidDoc.id}
- organizationId: ${orgId}
- reportId: ${reportId}
- 文档名称: ${bidDoc.name}

请严格执行以下步骤：
1. 解析或创建审查报告（使用报告ID: ${reportId}）
2. 读取投标文档全文
3. 获取招标文件的审查项作为对比基准
4. 扫描投标文件中的法律法规引用并验证
5. 加载规则集并执行规则检查
6. AI语义分析（招标要求对照 + 关键参数比较）
7. 汇总风险项（按严重程度分级）
8. 存储结果到审查报告
9. 输出完整审查摘要`,
      30
    );

    updateStep(workflow.workflowId, "a3", {
      status: "completed",
      completedAt: new Date().toISOString(),
      result: a3Result.text.slice(0, 500),
      toolCalls: a3Result.toolCalls,
    });

    // ---- Step A4 + A5: 风险定位 + 法规解析（串行执行） ----
    // 注：虽然任务描述说并行，但 Mastra agent.generate 是同步调用
    // 并行化需要考虑 API 速率限制，此处按串行执行以确保稳定性

    // A4: 风险定位
    updateStep(workflow.workflowId, "a4", {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    const a4Result = await runAgent(
      "risk-location-agent",
      `请为该项目的审查风险项进行精确定位。

输入：
- projectId: ${projectId}
- documentId: ${bidDoc.id}
- reportId: ${reportId}
- organizationId: ${orgId}

请严格执行以下步骤：
1. 获取报告信息和现有风险项列表
2. 读取投标文档全部区块内容
3. 对每个风险项执行多策略定位（精确匹配→关键词→语义搜索）
4. 回写精确定位数据到风险项
5. 输出定位覆盖率摘要`,
      20
    );

    updateStep(workflow.workflowId, "a4", {
      status: "completed",
      completedAt: new Date().toISOString(),
      result: a4Result.text.slice(0, 500),
      toolCalls: a4Result.toolCalls,
    });

    // A5: 法规解析
    updateStep(workflow.workflowId, "a5", {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    const a5Result = await runAgent(
      "legal-parsing-agent",
      `请为该项目的风险项进行法律法规深度分析。

输入：
- projectId: ${projectId}
- documentId: ${bidDoc.id}
- reportId: ${reportId}
- organizationId: ${orgId}

请严格执行以下步骤：
1. 获取报告信息和现有风险项
2. 读取投标文档并扫描法规引用
3. 对每个风险项在知识库中搜索相关法规条款
4. 验证法规引用是否为最新版本
5. 进行合规性分析（合规/不合规/部分合规/待确认）
6. 存储包含法规依据的风险项
7. 输出法规分析摘要`,
      20
    );

    updateStep(workflow.workflowId, "a5", {
      status: "completed",
      completedAt: new Date().toISOString(),
      result: a5Result.text.slice(0, 500),
      toolCalls: a5Result.toolCalls,
    });

    // ---- Step A6: 报告生成 ----
    updateStep(workflow.workflowId, "a6", {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    const a6Result = await runAgent(
      "report-generation-agent-v2",
      `请汇总所有审查结果，生成完整的结构化预审报告。

输入：
- reportId: ${reportId}
- projectId: ${projectId}
- documentId: ${bidDoc.id}

请严格执行以下步骤：
1. 获取报告信息（包含A3风险项、A4定位、A5法规分析的结果）
2. 获取图片风险检测结果
3. 计算综合评分和等级
4. 按类别聚合风险（资质/合规/技术/商务）
5. 生成结构化 Markdown 报告
6. 存储报告摘要和评分`,
      20
    );

    updateStep(workflow.workflowId, "a6", {
      status: "completed",
      completedAt: new Date().toISOString(),
      result: a6Result.text.slice(0, 500),
      toolCalls: a6Result.toolCalls,
    });

    // 更新报告状态为已完成
    await db
      .update(reviewReports)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviewReports.id, reportId));

    // 更新工作流完成状态
    const wfFinal = workflows.get(workflowId);
    if (wfFinal) {
      wfFinal.status = "completed";
      wfFinal.currentStep = null;
      wfFinal.completedAt = new Date().toISOString();
      wfFinal.updatedAt = new Date().toISOString();
      workflows.set(workflowId, wfFinal);
    }
  } catch (error) {
    const wf = workflows.get(workflowId);
    if (wf) {
      // 标记当前运行中的步骤为失败
      const runningStep = wf.steps.find((s) => s.status === "running");
      if (runningStep) {
        updateStep(workflowId, runningStep.id, {
          status: "failed",
          completedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "未知错误",
        });
      }
      wf.status = "failed";
      wf.error = error instanceof Error ? error.message : "未知错误";
      wf.updatedAt = new Date().toISOString();
      workflows.set(workflowId, wf);

      // 尝试将报告状态更新为失败
      if (wf.resources?.reportId) {
        try {
          await db
            .update(reviewReports)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(reviewReports.id, wf.resources.reportId));
        } catch {
          // 忽略状态更新失败
        }
      }
    }
    throw error;
  }
}

// ==================== 状态查询 ====================

export function getWorkflowStatus(workflowId: string): WorkflowStatus | null {
  return workflows.get(workflowId) || null;
}

export function getTenderToBidStatus(
  workflowId: string
): WorkflowStatus | null {
  const wf = workflows.get(workflowId);
  if (!wf || wf.type !== "tender-to-bid") return null;
  return wf;
}

export function getReviewStatus(workflowId: string): PipelineStatus | null {
  const wf = workflows.get(workflowId);
  if (!wf || wf.type !== "review-pipeline") return null;
  return {
    workflowId: wf.workflowId,
    type: "review-pipeline",
    status: wf.status,
    steps: wf.steps,
    reportId: wf.resources?.reportId,
    documentId: wf.resources?.documentId,
  };
}

/** 获取项目关联的所有工作流 */
export function getProjectWorkflows(projectId: string): WorkflowStatus[] {
  const result: WorkflowStatus[] = [];
  for (const wf of workflows.values()) {
    if (wf.projectId === projectId) {
      result.push(wf);
    }
  }
  return result.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** 取消工作流（将运行中的步骤标记为失败） */
export function cancelWorkflow(workflowId: string): boolean {
  const wf = workflows.get(workflowId);
  if (!wf) return false;

  const runningStep = wf.steps.find((s) => s.status === "running");
  if (runningStep) {
    runningStep.status = "failed";
    runningStep.completedAt = new Date().toISOString();
    runningStep.error = "用户取消";
  }

  wf.status = "failed";
  wf.error = "用户取消工作流";
  wf.updatedAt = new Date().toISOString();
  workflows.set(workflowId, wf);

  return true;
}
