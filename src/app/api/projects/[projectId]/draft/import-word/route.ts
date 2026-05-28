/**
 * Word Import API
 *
 * POST /api/projects/[projectId]/draft/import-word
 * FormData: docId + file (.docx)
 * Parses the Word file and updates the bid document sections.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { bidDocumentService } from "@/lib/services/bid-document-service";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;

  try {
    const formData = await request.formData();
    const docId = formData.get("docId") as string | null;
    const file = formData.get("file") as File | null;

    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    // Verify document belongs to this project
    const doc = await bidDocumentService.getDocument(docId);
    if (!doc || doc.projectId !== projectId) {
      return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await bidDocumentService.importFromWord(docId, fileBuffer);

    // Return updated document
    const updated = await bidDocumentService.getDocument(docId);
    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error("导入Word失败:", error);
    return NextResponse.json({ error: "导入Word失败" }, { status: 500 });
  }
}
