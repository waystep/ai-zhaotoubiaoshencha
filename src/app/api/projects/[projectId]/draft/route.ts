/**
 * Bid Document Draft API — CRUD + auto-save
 *
 * GET  /api/projects/[projectId]/draft          — List bid documents for project
 * GET  /api/projects/[projectId]/draft?docId=   — Get single document
 * PUT  /api/projects/[projectId]/draft          — Update section content / auto-save
 * POST /api/projects/[projectId]/draft          — Add a new section
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { bidDocumentService } from "@/lib/services/bid-document-service";
import type { BidSection } from "@/lib/services/bid-document-service";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// GET — list documents or get single document
export async function GET(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get("docId");

  try {
    if (docId) {
      const doc = await bidDocumentService.getDocument(docId);
      if (!doc || doc.projectId !== projectId) {
        return NextResponse.json({ error: "文档不存在" }, { status: 404 });
      }
      return NextResponse.json({ document: doc });
    }

    const docs = await bidDocumentService.listByProject(projectId);
    return NextResponse.json({ documents: docs });
  } catch (error) {
    console.error("获取投标文档失败:", error);
    return NextResponse.json({ error: "获取投标文档失败" }, { status: 500 });
  }
}

// PUT — update section / auto-save all sections
export async function PUT(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;

  try {
    const body = await request.json();

    // Auto-save all sections
    if (body.type === "autoSave" && body.docId && body.sections) {
      await bidDocumentService.autoSave(
        body.docId,
        body.sections as BidSection[],
      );
      return NextResponse.json({ success: true });
    }

    // Update single section
    if (body.docId && body.sectionId && typeof body.content === "string") {
      await bidDocumentService.updateSection(
        body.docId,
        body.sectionId,
        body.content,
      );
      return NextResponse.json({ success: true });
    }

    // Reorder sections
    if (body.type === "reorder" && body.docId && body.sectionOrder) {
      await bidDocumentService.reorderSections(body.docId, body.sectionOrder);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  } catch (error) {
    console.error("更新投标文档失败:", error);
    return NextResponse.json({ error: "更新投标文档失败" }, { status: 500 });
  }
}

// POST — add a new section
export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;

  try {
    const body = await request.json();

    if (!body.docId || !body.section) {
      return NextResponse.json({ error: "docId and section are required" }, { status: 400 });
    }

    await bidDocumentService.addSection(
      body.docId,
      body.section as BidSection,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("添加章节失败:", error);
    return NextResponse.json({ error: "添加章节失败" }, { status: 500 });
  }
}
