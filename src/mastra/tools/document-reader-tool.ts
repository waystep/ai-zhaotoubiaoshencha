// 文档读取工具 - 根据projectId和docType查询文档及其解析blocks
// 支持分页参数，用于大文档分批审查
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { documents, documentParsedResults, documentBlocks } from "@/lib/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

export const documentReaderTool = createTool({
  id: "document-reader",
  description: "读取项目文档及其解析区块信息，支持按projectId和docType查询。支持分页参数（startPage/endPage）用于大文档分批审查。",
  inputSchema: z.object({
    projectId: z.string().uuid().describe("项目ID"),
    docType: z.enum(["tender_doc", "legal_doc", "bid_doc"]).optional().describe("文档类型（可选）"),
    documentId: z.string().uuid().optional().describe("特定文档ID（可选，优先级高于docType）"),
    // 新增分页参数
    startPage: z.number().int().positive().optional().describe("起始页码（用于分批审查）"),
    endPage: z.number().int().positive().optional().describe("结束页码（用于分批审查）"),
    blockTypes: z.array(z.string()).optional().describe("区块类型过滤（如text、table、image等）"),
  }),
  outputSchema: z.object({
    documents: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        docType: z.enum(["tender_doc", "legal_doc", "bid_doc", "review_report"]),
        parseStatus: z.enum(["pending", "processing", "completed", "failed"]),
        totalPages: z.number().int().nonnegative(),
        blocks: z.array(
          z.object({
            id: z.string().uuid(),
            pageNumber: z.number().int().positive(),
            blockIndex: z.number().int().nonnegative(),
            blockType: z.string().optional(),
            content: z.string(),
            bbox: z
              .object({
                x0: z.number(),
                y0: z.number(),
                x1: z.number(),
                y1: z.number(),
              })
              .optional(),
          })
        ),
      })
    ),
    pageInfo: z.object({
      totalPages: z.number().int(),
      queriedPages: z.object({
        start: z.number().int().optional(),
        end: z.number().int().optional(),
      }),
      blockCount: z.number().int(),
      totalBlockCount: z.number().int().optional(),
    }),
    summary: z.string().optional(),
  }),
  execute: async ({ projectId, docType, documentId, startPage, endPage, blockTypes }) => {
    try {
      // 查询条件构建
      let whereClause;
      if (documentId) {
        whereClause = and(eq(documents.projectId, projectId), eq(documents.id, documentId));
      } else if (docType) {
        whereClause = and(eq(documents.projectId, projectId), eq(documents.docType, docType));
      } else {
        whereClause = eq(documents.projectId, projectId);
      }

      // 查询文档及其解析结果
      const docs = await db.query.documents.findMany({
        where: whereClause,
        with: {
          parsedResult: {
            with: {
              blocks: {
                orderBy: [documentBlocks.pageNumber, documentBlocks.blockIndex],
              },
            },
          },
        },
      });

      // 格式化输出，应用分页过滤
      const formattedDocs = docs.map((doc) => {
        let blocks = doc.parsedResult?.blocks || [];
        const totalBlockCount = blocks.length;
        const totalPages = doc.parsedResult?.totalPages || 0;

        // 应用页范围过滤
        if (startPage !== undefined || endPage !== undefined) {
          blocks = blocks.filter((b) => {
            if (startPage !== undefined && b.pageNumber < startPage) return false;
            if (endPage !== undefined && b.pageNumber > endPage) return false;
            return true;
          });
        }

        // 应用区块类型过滤
        if (blockTypes && blockTypes.length > 0) {
          blocks = blocks.filter((b) => blockTypes.includes(b.blockType || ""));
        }

        return {
          id: doc.id,
          name: doc.name,
          docType: doc.docType,
          parseStatus: doc.parseStatus || "pending",
          totalPages,
          blocks: blocks.map((b) => ({
            id: b.id,
            pageNumber: b.pageNumber,
            blockIndex: b.blockIndex,
            blockType: b.blockType || undefined,
            content: b.content,
            bbox: (b.bbox as { x0: number; y0: number; x1: number; y1: number }) || undefined,
          })),
        };
      });

      // 计算页信息
      const pageInfo = {
        totalPages: formattedDocs.reduce((max, d) => Math.max(max, d.totalPages), 0),
        queriedPages: {
          start: startPage,
          end: endPage,
        },
        blockCount: formattedDocs.reduce((sum, d) => sum + d.blocks.length, 0),
        totalBlockCount: formattedDocs.reduce((sum, d) => {
          // 需要重新计算未过滤的总数
          const doc = docs.find((original) => original.id === d.id);
          return sum + (doc?.parsedResult?.blocks?.length || 0);
        }, 0),
      };

      // 生成摘要信息
      const pageRangeStr = startPage !== undefined || endPage !== undefined
        ? `（页${startPage || 1}-${endPage || pageInfo.totalPages}）`
        : "";
      const summary = `查询到 ${formattedDocs.length} 个文档${pageRangeStr}，共 ${pageInfo.blockCount} 个blocks（总数 ${pageInfo.totalBlockCount}）`;

      return {
        documents: formattedDocs,
        pageInfo,
        summary,
      };
    } catch (error) {
      console.error("文档读取失败:", error);
      return {
        documents: [],
        pageInfo: {
          totalPages: 0,
          queriedPages: { start: undefined, end: undefined },
          blockCount: 0,
          totalBlockCount: 0,
        },
        summary: `文档读取失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
});