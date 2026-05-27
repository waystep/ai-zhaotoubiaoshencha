import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";

import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import {
  documents,
  extractionItems,
  reviewReports,
  tenderProjects,
} from "@/lib/db/schema";

type AuthFailure = { response: NextResponse };

function unauthorized(): AuthFailure {
  return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
}

function forbidden(message: string): AuthFailure {
  return { response: NextResponse.json({ error: message }, { status: 403 }) };
}

function notFound(message: string): AuthFailure {
  return { response: NextResponse.json({ error: message }, { status: 404 }) };
}

export async function requireProjectAccess(projectId: string) {
  const session = await auth();
  if (!session?.user?.orgId) return unauthorized();

  const project = await db.query.tenderProjects.findFirst({
    where: eq(tenderProjects.id, projectId),
  });

  if (!project) return notFound("项目不存在");
  if (project.orgId !== session.user.orgId) return forbidden("无权访问此项目");

  return { session, project };
}

export async function requireDocumentAccess(documentId: string) {
  const session = await auth();
  if (!session?.user?.orgId) return unauthorized();

  const document = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
    with: {
      project: {
        columns: {
          id: true,
          orgId: true,
        },
      },
    },
  });

  if (!document) return notFound("文档不存在");
  if (!document.project || document.project.orgId !== session.user.orgId) {
    return forbidden("无权访问此文档");
  }

  return { session, document };
}

export async function requireReportAccess(reportId: string) {
  const session = await auth();
  if (!session?.user?.orgId) return unauthorized();

  const report = await db.query.reviewReports.findFirst({
    where: eq(reviewReports.id, reportId),
    with: {
      project: {
        columns: {
          id: true,
          orgId: true,
        },
      },
    },
  });

  if (!report) return notFound("报告不存在");
  if (!report.project || report.project.orgId !== session.user.orgId) {
    return forbidden("无权访问此报告");
  }

  return { session, report };
}

export async function requireExtractionItemAccess(itemId: string) {
  const session = await auth();
  if (!session?.user?.orgId) return unauthorized();

  const item = await db.query.extractionItems.findFirst({
    where: eq(extractionItems.id, itemId),
    with: {
      project: {
        columns: {
          id: true,
          orgId: true,
        },
      },
    },
  });

  if (!item) return notFound("提取项不存在");
  if (!item.project || item.project.orgId !== session.user.orgId) {
    return forbidden("无权访问此提取项");
  }

  return { session, item };
}

export async function requireExtractionItemsAccess(ids: string[]) {
  const session = await auth();
  if (!session?.user?.orgId) return unauthorized();

  const uniqueIds = [...new Set(ids)];
  const items = await db.query.extractionItems.findMany({
    where: inArray(extractionItems.id, uniqueIds),
    with: {
      project: {
        columns: {
          id: true,
          orgId: true,
        },
      },
    },
  });

  if (items.length !== uniqueIds.length) return notFound("未找到匹配的提取项");
  if (items.some((item) => !item.project || item.project.orgId !== session.user.orgId)) {
    return forbidden("无权访问部分提取项");
  }

  return { session, items };
}

export function isAuthFailure<T extends object>(
  result: T | AuthFailure,
): result is AuthFailure {
  return "response" in result;
}
