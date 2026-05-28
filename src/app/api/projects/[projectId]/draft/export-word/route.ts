/**
 * Word Export API
 *
 * POST /api/projects/[projectId]/draft/export-word
 * Body: { docId: string }
 * Returns: .docx file download
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
    const body = await request.json();
    const { docId } = body;

    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    // Verify document belongs to this project
    const doc = await bidDocumentService.getDocument(docId);
    if (!doc || doc.projectId !== projectId) {
      return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }

    const buffer = await bidDocumentService.exportToWord(docId);

    // Generate safe filename
    const safeTitle = doc.title.replace(/[^a-zA-Z0-9一-鿿-_ ]/g, "");
    const filename = encodeURIComponent(`${safeTitle}.docx`);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (error) {
    console.error("导出Word失败:", error);
    return NextResponse.json({ error: "导出Word失败" }, { status: 500 });
  }
}
