// 文档分析 Tool - 用于分析文档内容并提取关键信息
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// 审查规则定义
const reviewRulesSchema = z.object({
  id: z.string(),
  category: z.string(),
  name: z.string(),
  severity: z.enum(["critical", "major", "minor", "suggestion"]),
  keywords: z.array(z.string()).optional(),
  descriptionTemplate: z.string(),
  suggestionTemplate: z.string(),
});

// 输入 Schema
const inputSchema = z.object({
  documentContent: z.string().describe("文档全文内容"),
  documentType: z
    .enum(["tender_doc", "legal_doc", "bid_doc"])
    .describe("文档类型"),
  blocks: z
    .array(
      z.object({
        id: z.string(),
        content: z.string(),
        pageNumber: z.number(),
        index: z.number(),
        bbox: z.array(z.number()).optional(),
      })
    )
    .describe("文档区块列表"),
});

// 输出 Schema
const outputSchema = z.object({
  issues: z.array(
    z.object({
      category: z.string(),
      severity: z.enum(["critical", "major", "minor", "suggestion"]),
      title: z.string(),
      description: z.string(),
      location: z.object({
        pageNumber: z.number(),
        blockIndex: z.number(),
        textSnippet: z.string(),
        highlightText: z.string().optional(),
      }),
      suggestion: z.string(),
    })
  ),
  score: z.number().min(0).max(100),
  recommendation: z.enum(["pass", "fail", "revise"]),
  summary: z.string(),
});

// 预定义审查规则（招标文件常见问题）
const reviewRules = [
  {
    id: "rule_001",
    category: "资质要求",
    name: "资质门槛过高",
    severity: "critical",
    keywords: ["一级资质", "特级资质", "十年以上", "业绩超过"],
    descriptionTemplate:
      "招标文件中设置的资质门槛可能存在不合理限制，影响公平竞争。",
    suggestionTemplate:
      "建议根据项目实际需求合理设置资质要求，避免设置过高的准入门槛。",
  },
  {
    id: "rule_002",
    category: "评分标准",
    name: "评分标准不明确",
    severity: "major",
    keywords: ["综合评分", "酌情", "适当"],
    descriptionTemplate:
      "评分标准中存在模糊表述，可能导致评审主观性过大。",
    suggestionTemplate:
      "建议细化评分标准，明确各项指标的分值范围和评分依据。",
  },
  {
    id: "rule_003",
    category: "时间要求",
    name: "投标时间过短",
    severity: "major",
    keywords: ["投标截止", "天"],
    descriptionTemplate: "投标准备时间可能不足，影响投标方充分准备。",
    suggestionTemplate:
      "建议根据项目复杂程度预留合理的投标准备时间（一般不少于20天）。",
  },
  {
    id: "rule_004",
    category: "价格要求",
    name: "价格条款不明确",
    severity: "minor",
    keywords: ["报价", "价格", "费用"],
    descriptionTemplate: "价格相关条款表述不够清晰，可能导致理解歧义。",
    suggestionTemplate: "建议明确价格构成、支付方式、结算条件等细节。",
  },
  {
    id: "rule_005",
    category: "技术规范",
    name: "技术参数倾向性",
    severity: "critical",
    keywords: ["指定品牌", "特定型号", "必须采用"],
    descriptionTemplate:
      "技术参数中可能存在指向特定供应商的倾向性条款。",
    suggestionTemplate:
      "建议采用通用技术参数描述，允许多种品牌或型号的替代方案。",
  },
  {
    id: "rule_006",
    category: "合同条款",
    name: "违约责任不对等",
    severity: "major",
    keywords: ["违约金", "赔偿责任", "罚款"],
    descriptionTemplate: "合同中违约责任条款可能存在不对等情形。",
    suggestionTemplate: "建议平衡双方违约责任，确保条款公平合理。",
  },
  {
    id: "rule_007",
    category: "合规要求",
    name: "排斥性条款",
    severity: "critical",
    keywords: ["仅限", "本地企业", "指定地区"],
    descriptionTemplate:
      "招标文件中可能存在地域性排斥条款，违反公平竞争原则。",
    suggestionTemplate:
      "建议删除地域限制条款，确保全国范围内的企业均可参与投标。",
  },
];

// 在区块中查找关键词
function findKeywordInBlocks(
  keyword: string,
  blocks: z.infer<typeof inputSchema>["blocks"]
): z.infer<typeof inputSchema>["blocks"] {
  return blocks.filter((block) =>
    block.content.toLowerCase().includes(keyword.toLowerCase())
  );
}

// 计算评分
function calculateScore(
  issues: z.infer<typeof outputSchema>["issues"]
): number {
  let score = 100;
  for (const issue of issues) {
    switch (issue.severity) {
      case "critical":
        score -= 20;
        break;
      case "major":
        score -= 10;
        break;
      case "minor":
        score -= 5;
        break;
      case "suggestion":
        score -= 2;
        break;
    }
  }
  return Math.max(0, Math.min(100, score));
}

// 生成建议结论
function generateRecommendation(
  score: number,
  issues: z.infer<typeof outputSchema>["issues"]
): "pass" | "fail" | "revise" {
  if (issues.some((i) => i.severity === "critical")) {
    return "fail";
  }
  if (score < 60) {
    return "fail";
  }
  if (issues.some((i) => i.severity === "major")) {
    return "revise";
  }
  return "pass";
}

// 生成审查摘要
function generateSummary(
  issues: z.infer<typeof outputSchema>["issues"],
  score: number,
  docType: string
): string {
  const docTypeLabel =
    docType === "tender_doc"
      ? "招标文件"
      : docType === "legal_doc"
      ? "法律文件"
      : docType === "bid_doc"
      ? "投标文件"
      : "文档";

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const majorCount = issues.filter((i) => i.severity === "major").length;
  const minorCount = issues.filter((i) => i.severity === "minor").length;

  let summary = `本次审查针对${docTypeLabel}进行了合规性分析，综合评分 ${score} 分。`;

  if (criticalCount > 0) {
    summary += `发现 ${criticalCount} 个严重问题，需要立即整改。`;
  }
  if (majorCount > 0) {
    summary += `发现 ${majorCount} 个重要问题，建议重点关注。`;
  }
  if (minorCount > 0) {
    summary += `另有 ${minorCount} 个轻微问题和若干建议项。`;
  }
  if (issues.length === 0) {
    summary += `审查未发现明显问题，文档符合基本合规要求。`;
  }

  return summary;
}

export const documentAnalysisTool = createTool({
  id: "document-analysis-tool",
  description:
    "分析招标文档内容，根据预设规则检测潜在问题，包括资质要求、评分标准、时间要求等",
  inputSchema,
  outputSchema,
  execute: async ({ documentContent, documentType, blocks }) => {
    // 根据文档类型选择适用规则
    const applicableRules = reviewRules.filter((rule) => {
      if (documentType === "tender_doc") return true;
      if (documentType === "legal_doc") {
        return ["合规要求", "合同条款"].includes(rule.category);
      }
      if (documentType === "bid_doc") {
        return ["技术规范", "价格要求"].includes(rule.category);
      }
      return false;
    });

    const issues: z.infer<typeof outputSchema>["issues"] = [];

    // 关键词匹配分析
    for (const rule of applicableRules) {
      if (rule.keywords) {
        for (const keyword of rule.keywords) {
          const matchedBlocks = findKeywordInBlocks(keyword, blocks);

          for (const block of matchedBlocks) {
            issues.push({
              category: rule.category,
              severity: rule.severity as
                | "critical"
                | "major"
                | "minor"
                | "suggestion",
              title: rule.name,
              description: rule.descriptionTemplate,
              location: {
                pageNumber: block.pageNumber,
                blockIndex: block.index,
                textSnippet: block.content.substring(0, 100),
                highlightText: keyword,
              },
              suggestion: rule.suggestionTemplate,
            });
          }
        }
      }
    }

    // 计算评分和结论
    const score = calculateScore(issues);
    const recommendation = generateRecommendation(score, issues);
    const summary = generateSummary(issues, score, documentType);

    return {
      issues,
      score,
      recommendation,
      summary,
    };
  },
});