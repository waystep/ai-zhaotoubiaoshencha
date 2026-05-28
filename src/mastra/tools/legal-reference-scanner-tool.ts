// 法律法规引用扫描工具 — 从文本中识别法律、法规、国标、行标等引用
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// ---------------------------------------------------------------------------
// 引用类型枚举
// ---------------------------------------------------------------------------

const ReferenceType = {
  LAW: "law",               // 法律（如《中华人民共和国招标投标法》）
  REGULATION: "regulation",  // 行政法规（如《xxx条例》）
  PROVISION: "provision",    // 部门规章（如《xxx规定》《xxx办法》）
  NATIONAL_STD: "national_std",   // 国标 GB/T xxxxx-xxxx
  INDUSTRY_STD: "industry_std",   // 行标 JGJ/T xxxxx-xxxx
  LOCAL_STD: "local_std",         // 地方标准 DBxx/T xxxxx-xxxx
  DECREE: "decree",         // 部门令（如 住建部令第xxx号）
  NOTICE: "notice",         // 通知编号（如 建市〔2024〕xx号）
} as const;

type RefType = (typeof ReferenceType)[keyof typeof ReferenceType];

// ---------------------------------------------------------------------------
// 正则匹配模式
// ---------------------------------------------------------------------------

interface ScanPattern {
  type: RefType;
  label: string;
  regex: RegExp;
}

const SCAN_PATTERNS: ScanPattern[] = [
  // 法律：《xxx法》
  {
    type: ReferenceType.LAW,
    label: "法律",
    regex: /《[^》]+法》/g,
  },
  // 行政法规：《xxx条例》
  {
    type: ReferenceType.REGULATION,
    label: "行政法规",
    regex: /《[^》]+条例》/g,
  },
  // 部门规章：《xxx规定》《xxx办法》《xxx细则》
  {
    type: ReferenceType.PROVISION,
    label: "部门规章",
    regex: /《[^》]+(?:规定|办法|细则|规则|意见|通知|公告)》/g,
  },
  // 国标 GB/T xxxxx-xxxx 或 GB xxxxx-xxxx
  {
    type: ReferenceType.NATIONAL_STD,
    label: "国家标准",
    regex: /GB\/?T?\s*\d+[\-—]\d+/g,
  },
  // 行标 JGJ/T xxxxx-xxxx 或 JGJ xxxxx-xxxx
  {
    type: ReferenceType.INDUSTRY_STD,
    label: "行业标准",
    regex: /(?:JGJ|CJJ|JTG|JT\/T|DL\/T|SL|HY\/T|HJ|YB\/T|TB\/T|SH\/T)\s*\/?T?\s*\d+[\-—]\d+/g,
  },
  // 地方标准 DBxx/T xxxxx-xxxx
  {
    type: ReferenceType.LOCAL_STD,
    label: "地方标准",
    regex: /DB\d+\/T?\s*\d+[\-—]\d+/g,
  },
  // 部门令：xxx部令第xxx号
  {
    type: ReferenceType.DECREE,
    label: "部门令",
    regex: /[一-龥]+(?:部|委|局|厅|办)?令第\d+号/g,
  },
  // 通知编号：建市〔2024〕xx号 或 冀建市〔2024〕xx号
  {
    type: ReferenceType.NOTICE,
    label: "通知编号",
    regex: /[一-龥]*〔\d{4}〕\d+号/g,
  },
];

// ---------------------------------------------------------------------------
// Tool 定义
// ---------------------------------------------------------------------------

export const legalReferenceScannerTool = createTool({
  id: "legal-reference-scanner",
  description:
    "扫描文本中的法律法规引用，识别法律、行政法规、部门规章、国标、行标、地方标准、部门令、通知编号等。返回去重后的引用列表。",
  inputSchema: z.object({
    text: z.string().describe("待扫描的文本内容"),
  }),
  outputSchema: z.object({
    references: z.array(
      z.object({
        text: z.string().describe("匹配到的引用文本"),
        type: z.string().describe("引用类型（law/regulation/provision/national_std/industry_std/local_std/decree/notice）"),
        typeLabel: z.string().describe("引用类型中文标签"),
        matchStart: z.number().describe("匹配起始位置"),
        matchEnd: z.number().describe("匹配结束位置"),
      })
    ),
    totalCount: z.number().describe("发现的引用总数（去重前）"),
    uniqueCount: z.number().describe("去重后的引用数量"),
    summary: z.string().describe("扫描结果摘要"),
  }),
  execute: async ({ text }) => {
    try {
      if (!text || text.trim().length === 0) {
        return {
          references: [],
          totalCount: 0,
          uniqueCount: 0,
          summary: "无文本内容可扫描",
        };
      }

      const allReferences: Array<{
        text: string;
        type: string;
        typeLabel: string;
        matchStart: number;
        matchEnd: number;
      }> = [];

      for (const pattern of SCAN_PATTERNS) {
        // Reset lastIndex for global regex
        pattern.regex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.regex.exec(text)) !== null) {
          allReferences.push({
            text: match[0],
            type: pattern.type,
            typeLabel: pattern.label,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
          });
        }
      }

      // 按出现位置排序
      allReferences.sort((a, b) => a.matchStart - b.matchStart);

      // 去重（相同文本 + 相同类型）
      const seen = new Set<string>();
      const uniqueReferences = allReferences.filter((ref) => {
        const key = `${ref.text}::${ref.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // 生成摘要
      const typeCounts: Record<string, number> = {};
      for (const ref of uniqueReferences) {
        typeCounts[ref.typeLabel] = (typeCounts[ref.typeLabel] || 0) + 1;
      }
      const summaryParts = Object.entries(typeCounts)
        .map(([label, count]) => `${label} ${count} 项`)
        .join("，");
      const summary = summaryParts
        ? `扫描完成，共发现 ${uniqueReferences.length} 条法律法规引用：${summaryParts}`
        : "扫描完成，未发现法律法规引用";

      return {
        references: uniqueReferences,
        totalCount: allReferences.length,
        uniqueCount: uniqueReferences.length,
        summary,
      };
    } catch (error) {
      console.error("[LegalReferenceScanner] 扫描失败:", error);
      return {
        references: [],
        totalCount: 0,
        uniqueCount: 0,
        summary: `扫描失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
});
