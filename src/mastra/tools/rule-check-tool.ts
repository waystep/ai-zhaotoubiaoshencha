// 规则检查工具 — 按规则集逐条检查投标文件
//
// 支持四种检测类型：
// 1. keyword   — 关键词检测：搜索指定关键词是否存在
// 2. comparison — 比较检测：提取数值并与阈值比较
// 3. semantic  — 语义检测：由调用方（Agent）通过 LLM 语义分析完成
// 4. existence — 存在性检测：检查必需章节/文档是否存在

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

interface BidSection {
  sectionNo: string;
  title: string;
  content: string;
}

interface RuleInput {
  ruleNo: string;
  name: string;
  detectionType: "keyword" | "comparison" | "semantic" | "existence";
  severity: string;
  description: string;
  parameters?: Record<string, unknown> | null;
}

interface RuleResult {
  ruleNo: string;
  name: string;
  detectionType: string;
  severity: string;
  passed: boolean;
  evidence: string;
  location?: {
    sectionNo: string;
    snippet: string;
  };
}

// ---------------------------------------------------------------------------
// 检测函数
// ---------------------------------------------------------------------------

/**
 * 关键词检测：在投标文件中搜索指定关键词
 * parameters: { keywords: string[], requireAll?: boolean }
 * - keywords: 要搜索的关键词列表
 * - requireAll: true → 所有关键词都必须存在才算通过；false → 任一关键词存在即通过
 */
function checkKeyword(
  sections: BidSection[],
  rule: RuleInput,
): RuleResult {
  const params = rule.parameters || {};
  const keywords = (params.keywords as string[]) || [];
  const requireAll = (params.requireAll as boolean) ?? false;

  if (keywords.length === 0) {
    return {
      ruleNo: rule.ruleNo,
      name: rule.name,
      detectionType: rule.detectionType,
      severity: rule.severity,
      passed: false,
      evidence: `规则 ${rule.ruleNo} 未配置关键词参数`,
    };
  }

  const fullText = sections.map((s) => s.content).join("\n");
  const foundKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of keywords) {
    if (fullText.includes(kw)) {
      foundKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  const passed = requireAll
    ? missingKeywords.length === 0
    : foundKeywords.length > 0;

  // 找到关键词所在的章节和上下文
  let location: RuleResult["location"] | undefined;
  if (foundKeywords.length > 0) {
    for (const section of sections) {
      for (const kw of foundKeywords) {
        const idx = section.content.indexOf(kw);
        if (idx !== -1) {
          const start = Math.max(0, idx - 30);
          const end = Math.min(section.content.length, idx + kw.length + 30);
          location = {
            sectionNo: section.sectionNo,
            snippet: `...${section.content.slice(start, end)}...`,
          };
          break;
        }
      }
      if (location) break;
    }
  }

  const evidence = passed
    ? `找到关键词: ${foundKeywords.join("、")}`
    : `未找到关键词: ${missingKeywords.join("、")}`;

  return {
    ruleNo: rule.ruleNo,
    name: rule.name,
    detectionType: rule.detectionType,
    severity: rule.severity,
    passed,
    evidence,
    location,
  };
}

/**
 * 比较检测：从文本中提取数值并与阈值比较
 * parameters: {
 *   fieldLabel: string,       // 字段标签（如"投标保证金"、"工期"）
 *   pattern: string,          // 提取数值的正则表达式
 *   operator: ">=" | "<=" | "==" | ">" | "<" | "between",
 *   threshold: number,        // 比较阈值
 *   thresholdMax?: number,    // between 时的上限
 *   unit?: string,            // 单位（如"万元"、"日历天"）
 * }
 */
function checkComparison(
  sections: BidSection[],
  rule: RuleInput,
): RuleResult {
  const params = rule.parameters || {};
  const fieldLabel = (params.fieldLabel as string) || rule.name;
  const pattern = (params.pattern as string) || "";
  const operator = (params.operator as string) || ">=";
  const threshold = Number(params.threshold);
  const thresholdMax = params.thresholdMax != null ? Number(params.thresholdMax) : undefined;
  const unit = (params.unit as string) || "";

  if (!pattern || isNaN(threshold)) {
    return {
      ruleNo: rule.ruleNo,
      name: rule.name,
      detectionType: rule.detectionType,
      severity: rule.severity,
      passed: false,
      evidence: `规则 ${rule.ruleNo} 缺少有效的正则表达式或阈值参数`,
    };
  }

  const fullText = sections.map((s) => s.content).join("\n");
  const regex = new RegExp(pattern, "g");
  const matches: { value: number; sectionNo: string; snippet: string }[] = [];

  for (const section of sections) {
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(section.content)) !== null) {
      const numStr = match[1] || match[0];
      const value = parseFloat(numStr.replace(/[，,]/g, ""));
      if (!isNaN(value)) {
        const start = Math.max(0, match.index - 20);
        const end = Math.min(section.content.length, match.index + match[0].length + 20);
        matches.push({
          value,
          sectionNo: section.sectionNo,
          snippet: `...${section.content.slice(start, end)}...`,
        });
      }
    }
  }

  if (matches.length === 0) {
    return {
      ruleNo: rule.ruleNo,
      name: rule.name,
      detectionType: rule.detectionType,
      severity: rule.severity,
      passed: false,
      evidence: `在投标文件中未找到"${fieldLabel}"的数值信息`,
    };
  }

  // 取第一个匹配值进行比较（可扩展为全量检查）
  const extracted = matches[0]!;
  let passed = false;
  let comparisonDesc = "";

  switch (operator) {
    case ">=":
      passed = extracted.value >= threshold;
      comparisonDesc = `${extracted.value}${unit} ${passed ? ">=" : "<"} ${threshold}${unit}`;
      break;
    case "<=":
      passed = extracted.value <= threshold;
      comparisonDesc = `${extracted.value}${unit} ${passed ? "<=" : ">"} ${threshold}${unit}`;
      break;
    case ">":
      passed = extracted.value > threshold;
      comparisonDesc = `${extracted.value}${unit} ${passed ? ">" : "<="} ${threshold}${unit}`;
      break;
    case "<":
      passed = extracted.value < threshold;
      comparisonDesc = `${extracted.value}${unit} ${passed ? "<" : ">="} ${threshold}${unit}`;
      break;
    case "==":
      passed = extracted.value === threshold;
      comparisonDesc = `${extracted.value}${unit} ${passed ? "==" : "!="} ${threshold}${unit}`;
      break;
    case "between":
      if (thresholdMax != null && !isNaN(thresholdMax)) {
        passed = extracted.value >= threshold && extracted.value <= thresholdMax;
        comparisonDesc = `${extracted.value}${unit} ${passed ? "在" : "不在"} [${threshold}${unit}, ${thresholdMax}${unit}] 范围内`;
      } else {
        passed = extracted.value >= threshold;
        comparisonDesc = `${extracted.value}${unit} (缺少上限，仅检查 >= ${threshold}${unit})`;
      }
      break;
    default:
      comparisonDesc = `不支持的比较运算符: ${operator}`;
  }

  return {
    ruleNo: rule.ruleNo,
    name: rule.name,
    detectionType: rule.detectionType,
    severity: rule.severity,
    passed,
    evidence: `${fieldLabel}: ${comparisonDesc}`,
    location: {
      sectionNo: extracted.sectionNo,
      snippet: extracted.snippet,
    },
  };
}

/**
 * 存在性检测：检查必需的章节/文档是否存在
 * parameters: {
 *   requiredSections: string[],  // 必需的章节标题列表（支持部分匹配）
 *   requiredDocTypes?: string[], // 必需的文档类型列表
 * }
 */
function checkExistence(
  sections: BidSection[],
  rule: RuleInput,
): RuleResult {
  const params = rule.parameters || {};
  const requiredSections = (params.requiredSections as string[]) || [];

  if (requiredSections.length === 0) {
    return {
      ruleNo: rule.ruleNo,
      name: rule.name,
      detectionType: rule.detectionType,
      severity: rule.severity,
      passed: false,
      evidence: `规则 ${rule.ruleNo} 未配置必需章节参数`,
    };
  }

  const existingTitles = sections.map((s) => ({
    sectionNo: s.sectionNo,
    title: s.title.toLowerCase(),
    originalTitle: s.title,
  }));

  const missingSections: string[] = [];
  const foundSections: Array<{ required: string; found: string; sectionNo: string }> = [];

  for (const required of requiredSections) {
    const requiredLower = required.toLowerCase();
    const found = existingTitles.find(
      (s) =>
        s.title.includes(requiredLower) ||
        requiredLower.includes(s.title) ||
        // 也检查内容中是否提到该章节标题
        sections.some((sec) => sec.content.toLowerCase().includes(requiredLower)),
    );

    if (found) {
      foundSections.push({
        required,
        found: found.originalTitle,
        sectionNo: found.sectionNo,
      });
    } else {
      missingSections.push(required);
    }
  }

  const passed = missingSections.length === 0;

  return {
    ruleNo: rule.ruleNo,
    name: rule.name,
    detectionType: rule.detectionType,
    severity: rule.severity,
    passed,
    evidence: passed
      ? `所有必需章节均存在: ${foundSections.map((f) => `${f.found}(${f.sectionNo})`).join("、")}`
      : `缺少以下必需章节: ${missingSections.join("、")}`,
    location:
      foundSections.length > 0
        ? { sectionNo: foundSections[0]!.sectionNo, snippet: foundSections[0]!.found }
        : undefined,
  };
}

/**
 * 语义检测：标记为需要 Agent LLM 介入的规则
 * 本工具仅返回占位结果，由 Agent 在调用后进行语义分析
 */
function checkSemantic(
  rule: RuleInput,
): RuleResult {
  return {
    ruleNo: rule.ruleNo,
    name: rule.name,
    detectionType: rule.detectionType,
    severity: rule.severity,
    passed: false,
    evidence: `语义检测规则，需由智能体进行 AI 语义分析: ${rule.description}`,
  };
}

// ---------------------------------------------------------------------------
// Tool 定义
// ---------------------------------------------------------------------------

export const ruleCheckTool = createTool({
  id: "rule-check",
  description:
    "按规则集逐条检查投标文件。支持四种检测类型：keyword（关键词检测）、comparison（数值比较检测）、existence（存在性检测）、semantic（语义检测标记）。返回每条规则的检查结果（通过/未通过 + 证据）。",
  inputSchema: z.object({
    bidDocumentSections: z
      .array(
        z.object({
          sectionNo: z.string().describe("章节编号"),
          title: z.string().describe("章节标题"),
          content: z.string().describe("章节正文内容"),
        })
      )
      .describe("投标文件的章节列表"),
    rules: z
      .array(
        z.object({
          ruleNo: z.string().describe("规则编号"),
          name: z.string().describe("规则名称"),
          detectionType: z.enum(["keyword", "comparison", "semantic", "existence"]),
          severity: z.string().describe("严重程度: critical/major/minor/suggestion"),
          description: z.string().describe("规则描述"),
          parameters: z.any().describe("规则参数（JSON）"),
        })
      )
      .describe("要执行的规则列表"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        ruleNo: z.string(),
        name: z.string(),
        detectionType: z.string(),
        severity: z.string(),
        passed: z.boolean(),
        evidence: z.string(),
        location: z
          .object({
            sectionNo: z.string(),
            snippet: z.string(),
          })
          .optional(),
      })
    ),
    totalCount: z.number(),
    passedCount: z.number(),
    failedCount: z.number(),
    summary: z.string(),
  }),
  execute: async ({ bidDocumentSections, rules }) => {
    try {
      const results: RuleResult[] = [];

      for (const rule of rules) {
        let result: RuleResult;

        switch (rule.detectionType) {
          case "keyword":
            result = checkKeyword(bidDocumentSections, rule);
            break;
          case "comparison":
            result = checkComparison(bidDocumentSections, rule);
            break;
          case "existence":
            result = checkExistence(bidDocumentSections, rule);
            break;
          case "semantic":
            result = checkSemantic(rule);
            break;
          default:
            result = {
              ruleNo: rule.ruleNo,
              name: rule.name,
              detectionType: rule.detectionType,
              severity: rule.severity,
              passed: false,
              evidence: `不支持的检测类型: ${rule.detectionType}`,
            };
        }

        results.push(result);
      }

      const passedCount = results.filter((r) => r.passed).length;
      const failedCount = results.filter((r) => !r.passed).length;

      // 按严重程度统计未通过项
      const failedBySeverity: Record<string, number> = {};
      for (const r of results) {
        if (!r.passed) {
          failedBySeverity[r.severity] = (failedBySeverity[r.severity] || 0) + 1;
        }
      }

      const severityParts = Object.entries(failedBySeverity)
        .map(([sev, count]) => `${sev} ${count} 条`)
        .join("，");

      const summary =
        failedCount === 0
          ? `规则检查全部通过（共 ${results.length} 条规则）`
          : `规则检查完成：${passedCount} 条通过，${failedCount} 条未通过（${severityParts}）`;

      return {
        results,
        totalCount: results.length,
        passedCount,
        failedCount,
        summary,
      };
    } catch (error) {
      console.error("[RuleCheck] 检查失败:", error);
      return {
        results: [],
        totalCount: 0,
        passedCount: 0,
        failedCount: 0,
        summary: `规则检查失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
});
