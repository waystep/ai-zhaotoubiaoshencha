// 法规引用验证工具 — 将扫描到的法规引用与知识库比对，验证是否为最新版本
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { knowledgeBases, knowledgeItems } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { embeddingService } from "@/lib/services/embedding-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReferenceInput {
  text: string;
  type: string;
}

interface VerificationResult {
  reference: string;
  type: string;
  status: "verified" | "outdated" | "not_found";
  statusLabel: string;
  latestTitle: string | null;
  latestVersion: string | null;
  effectiveDate: string | null;
  details: string;
}

// ---------------------------------------------------------------------------
// Tool 定义
// ---------------------------------------------------------------------------

export const legalVerificationTool = createTool({
  id: "legal-verification",
  description:
    "验证法规引用是否为最新版本。对每条引用在法律法规知识库中进行语义搜索，根据匹配结果判断引用状态：已验证（最新版本）、已过期（存在更新版本）或未找到（知识库中无匹配）。",
  inputSchema: z.object({
    references: z
      .array(
        z.object({
          text: z.string().describe("法规引用文本"),
          type: z.string().describe("引用类型（law/regulation/provision 等）"),
        })
      )
      .describe("待验证的法规引用列表"),
    organizationId: z.string().describe("组织ID，用于定位所属知识库"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        reference: z.string(),
        type: z.string(),
        status: z.string(),
        statusLabel: z.string(),
        latestTitle: z.string().nullable(),
        latestVersion: z.string().nullable(),
        effectiveDate: z.string().nullable(),
        details: z.string(),
      })
    ),
    verifiedCount: z.number(),
    outdatedCount: z.number(),
    notFoundCount: z.number(),
    summary: z.string(),
  }),
  execute: async ({ references, organizationId }) => {
    try {
      if (!references || references.length === 0) {
        return {
          results: [],
          verifiedCount: 0,
          outdatedCount: 0,
          notFoundCount: 0,
          summary: "无需验证的法规引用",
        };
      }

      // 1. 查找组织下的法律法规知识库
      const legalKBs = await db
        .select({ id: knowledgeBases.id, name: knowledgeBases.name })
        .from(knowledgeBases)
        .where(
          and(
            eq(knowledgeBases.organizationId, organizationId),
            eq(knowledgeBases.type, "legal_regulation"),
            eq(knowledgeBases.isActive, true)
          )
        );

      if (legalKBs.length === 0) {
        // 无知识库时，所有引用标记为未找到
        const results: VerificationResult[] = references.map((ref) => ({
          reference: ref.text,
          type: ref.type,
          status: "not_found" as const,
          statusLabel: "未找到",
          latestTitle: null,
          latestVersion: null,
          effectiveDate: null,
          details: "未找到法律法规知识库，无法验证",
        }));

        return buildResponse(results);
      }

      // 2. 逐条验证
      const results: VerificationResult[] = [];

      for (const ref of references) {
        const result = await verifySingleReference(
          ref,
          legalKBs.map((kb) => kb.id)
        );
        results.push(result);
      }

      return buildResponse(results);
    } catch (error) {
      console.error("[LegalVerification] 验证失败:", error);
      return {
        results: references.map((ref) => ({
          reference: ref.text,
          type: ref.type,
          status: "not_found",
          statusLabel: "验证失败",
          latestTitle: null,
          latestVersion: null,
          effectiveDate: null,
          details: `验证过程出错: ${error instanceof Error ? error.message : "未知错误"}`,
        })),
        verifiedCount: 0,
        outdatedCount: 0,
        notFoundCount: references.length,
        summary: `验证失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
});

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function verifySingleReference(
  ref: ReferenceInput,
  knowledgeBaseIds: string[]
): Promise<VerificationResult> {
  // 使用引用文本进行语义搜索
  // 对每个知识库分别搜索，取最佳匹配
  let bestMatch: {
    itemId: string;
    content: string;
    score: number;
    metadata: Record<string, unknown> | null;
    title: string | null;
  } | null = null;

  for (const kbId of knowledgeBaseIds) {
    try {
      const searchResults = await embeddingService.search(kbId, ref.text, 3);

      for (const sr of searchResults) {
        if (!bestMatch || sr.score > bestMatch.score) {
          // 获取知识条目的元数据
          const [item] = await db
            .select({
              id: knowledgeItems.id,
              title: knowledgeItems.title,
              metadata: knowledgeItems.metadata,
            })
            .from(knowledgeItems)
            .where(eq(knowledgeItems.id, sr.itemId))
            .limit(1);

          bestMatch = {
            itemId: sr.itemId,
            content: sr.content,
            score: sr.score,
            metadata: (item?.metadata as Record<string, unknown>) || null,
            title: item?.title || null,
          };
        }
      }
    } catch {
      // 搜索某个知识库失败，继续尝试下一个
      continue;
    }
  }

  // 判定验证状态
  const SIMILARITY_THRESHOLD = 0.65;

  if (!bestMatch || bestMatch.score < SIMILARITY_THRESHOLD) {
    return {
      reference: ref.text,
      type: ref.type,
      status: "not_found",
      statusLabel: "未找到",
      latestTitle: null,
      latestVersion: null,
      effectiveDate: null,
      details: "在知识库中未找到匹配的法规条目",
    };
  }

  // 检查元数据中的版本信息
  const metadata = bestMatch.metadata || {};
  const isLatest = metadata.isLatestVersion as boolean | undefined;
  const latestVersion = (metadata.latestVersion as string) || null;
  const effectiveDate = (metadata.effectiveDate as string) || null;
  const statusNote = (metadata.statusNote as string) || null;

  if (isLatest === true) {
    return {
      reference: ref.text,
      type: ref.type,
      status: "verified",
      statusLabel: "已验证",
      latestTitle: bestMatch.title,
      latestVersion: null,
      effectiveDate,
      details: `匹配到知识库条目「${bestMatch.title || "未命名"}」，确认为最新版本`,
    };
  }

  if (isLatest === false) {
    return {
      reference: ref.text,
      type: ref.type,
      status: "outdated",
      statusLabel: "已过期",
      latestTitle: bestMatch.title,
      latestVersion,
      effectiveDate,
      details: statusNote
        ? `该引用已过期：${statusNote}`
        : `该引用不是最新版本，最新版本：${latestVersion || "未知"}`,
    };
  }

  // 有匹配但无版本元数据 → 标记为已验证（保守处理）
  return {
    reference: ref.text,
    type: ref.type,
    status: "verified",
    statusLabel: "已验证",
    latestTitle: bestMatch.title,
    latestVersion: null,
    effectiveDate,
    details: `匹配到知识库条目「${bestMatch.title || "未命名"}」（相似度 ${(bestMatch.score * 100).toFixed(1)}%），未发现版本过期标记`,
  };
}

function buildResponse(results: VerificationResult[]) {
  const verifiedCount = results.filter((r) => r.status === "verified").length;
  const outdatedCount = results.filter((r) => r.status === "outdated").length;
  const notFoundCount = results.filter((r) => r.status === "not_found").length;

  const parts: string[] = [];
  if (verifiedCount > 0) parts.push(`已验证 ${verifiedCount} 条`);
  if (outdatedCount > 0) parts.push(`已过期 ${outdatedCount} 条`);
  if (notFoundCount > 0) parts.push(`未找到 ${notFoundCount} 条`);

  const summary = `法规引用验证完成：${parts.join("，")}`;

  return {
    results,
    verifiedCount,
    outdatedCount,
    notFoundCount,
    summary,
  };
}
