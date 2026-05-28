// 工作流 API — 启动和查询审查工作流
//
// POST: 启动工作流
//   Body: { type: "tender-to-bid" | "review-pipeline", organizationId, ... }
//   返回: { workflowId, type, status }
//
// GET: 查询工作流状态
//   Query: ?workflowId=xxx 或返回项目所有工作流列表

import { NextRequest, NextResponse } from "next/server";
import {
  isAuthFailure,
  requireProjectAccess,
} from "@/lib/auth/guards";
import {
  startTenderToBidFlow,
  startReviewPipeline,
  getWorkflowStatus,
  getProjectWorkflows,
  cancelWorkflow,
  type WorkflowType,
} from "@/lib/services/review-workflow-service";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// POST: 启动工作流
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
    const body = await request.json();
    const type = body.type as WorkflowType | undefined;
    const organizationId =
      (body.organizationId as string) || project.orgId;

    if (!type || !["tender-to-bid", "review-pipeline"].includes(type)) {
      return NextResponse.json(
        {
          error:
            "无效的工作流类型，支持: tender-to-bid, review-pipeline",
        },
        { status: 400 }
      );
    }

    // 3. 启动工作流
    let workflowId: string;

    if (type === "tender-to-bid") {
      workflowId = await startTenderToBidFlow(
        projectId,
        organizationId,
        {
          documentId: body.documentId as string | undefined,
          industry: body.industry as string | undefined,
          templateType: body.templateType as string | undefined,
        }
      );
    } else {
      workflowId = await startReviewPipeline(
        projectId,
        organizationId,
        {
          documentId: body.documentId as string | undefined,
          reportId: body.reportId as string | undefined,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        workflowId,
        type,
        status: "running",
        message:
          type === "tender-to-bid"
            ? "招标解析→投标生成工作流已启动"
            : "投标预审流水线已启动",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[Workflow] 启动工作流失败:", error);
    return NextResponse.json(
      {
        error: "启动工作流失败",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

// GET: 查询工作流状态
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { projectId } = await context.params;

    // 验证权限
    const projectAccess = await requireProjectAccess(projectId);
    if (isAuthFailure(projectAccess)) return projectAccess.response;

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");

    if (workflowId) {
      // 查询单个工作流
      const status = getWorkflowStatus(workflowId);
      if (!status) {
        return NextResponse.json(
          { error: "工作流不存在或已过期" },
          { status: 404 }
        );
      }
      if (status.projectId !== projectId) {
        return NextResponse.json(
          { error: "无权访问此工作流" },
          { status: 403 }
        );
      }
      return NextResponse.json({ workflow: status });
    }

    // 查询项目所有工作流
    const workflows = getProjectWorkflows(projectId);
    return NextResponse.json({
      projectId,
      workflows,
      total: workflows.length,
    });
  } catch (error) {
    console.error("[Workflow] 查询工作流状态失败:", error);
    return NextResponse.json(
      {
        error: "查询工作流状态失败",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

// DELETE: 取消工作流
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { projectId } = await context.params;

    const projectAccess = await requireProjectAccess(projectId);
    if (isAuthFailure(projectAccess)) return projectAccess.response;

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");

    if (!workflowId) {
      return NextResponse.json(
        { error: "缺少 workflowId 参数" },
        { status: 400 }
      );
    }

    // 验证工作流属于该项目
    const status = getWorkflowStatus(workflowId);
    if (!status) {
      return NextResponse.json(
        { error: "工作流不存在或已过期" },
        { status: 404 }
      );
    }
    if (status.projectId !== projectId) {
      return NextResponse.json(
        { error: "无权操作此工作流" },
        { status: 403 }
      );
    }

    const cancelled = cancelWorkflow(workflowId);
    if (!cancelled) {
      return NextResponse.json(
        { error: "取消工作流失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      workflowId,
      status: "cancelled",
      message: "工作流已取消",
    });
  } catch (error) {
    console.error("[Workflow] 取消工作流失败:", error);
    return NextResponse.json(
      {
        error: "取消工作流失败",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}
