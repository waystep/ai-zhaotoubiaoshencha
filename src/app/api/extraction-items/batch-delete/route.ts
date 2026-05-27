// 批量删除提取项 API
import { NextResponse } from "next/server";
import { isAuthFailure, requireExtractionItemsAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { extractionItems } from "@/lib/db/schema";
import { inArray, sql } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "请提供要删除的提取项ID列表" }, { status: 400 });
    }

    const access = await requireExtractionItemsAccess(ids);
    if (isAuthFailure(access)) return access.response;

    // 统计每个文档减少了多少条（跳过无文档关联的项）
    const docCounts = new Map<string, number>();
    for (const item of access.items) {
      if (item.documentId) {
        docCounts.set(item.documentId, (docCounts.get(item.documentId) || 0) + 1);
      }
    }

    // 批量删除
    const deletedIds = access.items.map((i) => i.id);
    await db.delete(extractionItems).where(inArray(extractionItems.id, deletedIds));

    // 更新各文档的 extractionItemsCount
    for (const [docId, count] of docCounts) {
      await db.execute(
        sql`UPDATE documents SET extraction_items_count = GREATEST(extraction_items_count - ${count}, 0), updated_at = NOW() WHERE id = ${docId}`
      );
    }

    return NextResponse.json({ success: true, deletedCount: deletedIds.length });
  } catch (error) {
    console.error("[BatchDelete] 批量删除失败:", error);
    return NextResponse.json(
      { error: "批量删除失败", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}
