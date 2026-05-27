// 单个提取项的操作 — 更新 / 删除
import { NextResponse } from "next/server";
import { isAuthFailure, requireDocumentAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { extractionItems, documents } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ documentId: string; itemId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { documentId, itemId } = await context.params;
  const access = await requireDocumentAccess(documentId);
  if (isAuthFailure(access)) return access.response;

  const body = await request.json();

  const updates: Partial<InferInsertModel<typeof extractionItems>> = { updatedAt: new Date() };
  if (body.section !== undefined) updates.section = body.section;
  if (body.title !== undefined) updates.title = body.title;
  if (body.checkpoint !== undefined) updates.checkpoint = body.checkpoint;
  if (body.consequence !== undefined) updates.consequence = String(body.consequence);
  if (body.blocks !== undefined) updates.blocks = body.blocks;

  const [updated] = await db
    .update(extractionItems)
    .set(updates)
    .where(and(eq(extractionItems.id, itemId), eq(extractionItems.documentId, documentId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "提取项不存在" }, { status: 404 });
  return NextResponse.json({ item: updated });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { documentId, itemId } = await context.params;
  const access = await requireDocumentAccess(documentId);
  if (isAuthFailure(access)) return access.response;

  const [deleted] = await db
    .delete(extractionItems)
    .where(and(eq(extractionItems.id, itemId), eq(extractionItems.documentId, documentId)))
    .returning({ id: extractionItems.id });

  if (!deleted) return NextResponse.json({ error: "提取项不存在" }, { status: 404 });

  await db
    .update(documents)
    .set({ extractionItemsCount: sql`GREATEST(${documents.extractionItemsCount} - 1, 0)`, updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  return NextResponse.json({ success: true });
}
