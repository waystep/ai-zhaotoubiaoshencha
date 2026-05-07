// AI 审查 Agent - 模拟 AI 审查逻辑（可后续接入真实 AI）

import type {
  MineruParseResult,
  ConvertedBlock,
} from "@/types/mineru";
import type {
  ReviewIssue,
  IssueSeverity,
  IssueLocation,
} from "@/types/review";

// 审查规则定义
interface ReviewRule {
  id: string;
  category: string;
  name: string;
  severity: IssueSeverity;
  pattern?: RegExp;
  keywords?: string[];
  descriptionTemplate: string;
  suggestionTemplate: string;
}

// 预定义审查规则（招标文件常见问题）
const reviewRules: ReviewRule[] = [
  {
    id: "rule_001",
    category: "资质要求",
    name: "资质门槛过高",
    severity: "critical",
    keywords: ["一级资质", "特级资质", "十年以上", "业绩超过"],
    descriptionTemplate: "招标文件中设置的资质门槛可能存在不合理限制，影响公平竞争。",
    suggestionTemplate: "建议根据项目实际需求合理设置资质要求，避免设置过高的准入门槛。",
  },
  {
    id: "rule_002",
    category: "评分标准",
    name: "评分标准不明确",
    severity: "major",
    keywords: ["综合评分", "酌情", "适当"],
    descriptionTemplate: "评分标准中存在模糊表述，可能导致评审主观性过大。",
    suggestionTemplate: "建议细化评分标准，明确各项指标的分值范围和评分依据。",
  },
  {
    id: "rule_003",
    category: "时间要求",
    name: "投标时间过短",
    severity: "major",
    pattern: /投标截止.*(\d{1,2})天/,
    descriptionTemplate: "投标准备时间可能不足，影响投标方充分准备。",
    suggestionTemplate: "建议根据项目复杂程度预留合理的投标准备时间（一般不少于20天）。",
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
    descriptionTemplate: "技术参数中可能存在指向特定供应商的倾向性条款。",
    suggestionTemplate: "建议采用通用技术参数描述，允许多种品牌或型号的替代方案。",
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
    descriptionTemplate: "招标文件中可能存在地域性排斥条款，违反公平竞争原则。",
    suggestionTemplate: "建议删除地域限制条款，确保全国范围内的企业均可参与投标。",
  },
];

// 审查结果
export interface ReviewResult {
  score: number;
  recommendation: "pass" | "fail" | "revise";
  summary: string;
  issues: ReviewIssue[];
  analysis: Record<string, unknown>;
}

// 审查文档
export async function reviewDocument(
  documentId: string,
  parseResult: MineruParseResult,
  docType: string
): Promise<ReviewResult> {
  // 根据文档类型选择审查规则
  const applicableRules = reviewRules.filter((rule) => {
    // 招标文件适用所有规则
    if (docType === "tender_doc") return true;
    // 法律文件侧重合规性审查
    if (docType === "legal_doc") {
      return ["合规要求", "合同条款"].includes(rule.category);
    }
    // 投标文件侧重技术规范
    if (docType === "bid_doc") {
      return ["技术规范", "价格要求"].includes(rule.category);
    }
    return false;
  });

  // 分析文档内容，发现问题
  const issues: ReviewIssue[] = [];
  const fullText = parseResult.fullText;

  for (const rule of applicableRules) {
    // 关键词匹配
    if (rule.keywords) {
      for (const keyword of rule.keywords) {
        const matchedBlocks = findKeywordInBlocks(
          keyword,
          parseResult.blocks
        );

        for (const block of matchedBlocks) {
          issues.push({
            id: `issue_${rule.id}_${block.id}`,
            reportId: "", // 后续填充
            category: rule.category,
            severity: rule.severity,
            title: rule.name,
            description: rule.descriptionTemplate,
            location: {
              pageNumber: block.pageNumber,
              blockIndex: block.index,
              bbox: block.bbox || undefined,
              textSnippet: block.content.substring(0, 100),
              highlightText: keyword,
            },
            suggestion: rule.suggestionTemplate,
            isResolved: false,
            createdAt: new Date(),
          });
        }
      }
    }

    // 正则匹配
    if (rule.pattern) {
      const matches = fullText.match(rule.pattern);
      if (matches) {
        // 找到匹配所在的区块
        const matchedBlock = findPatternInBlocks(
          rule.pattern,
          parseResult.blocks
        );

        if (matchedBlock) {
          issues.push({
            id: `issue_${rule.id}_${matchedBlock.id}`,
            reportId: "", // 后续填充
            category: rule.category,
            severity: rule.severity,
            title: rule.name,
            description: rule.descriptionTemplate,
            location: {
              pageNumber: matchedBlock.pageNumber,
              blockIndex: matchedBlock.index,
              bbox: matchedBlock.bbox || undefined,
              textSnippet: matchedBlock.content.substring(0, 100),
              highlightText: matches[0],
            },
            suggestion: rule.suggestionTemplate,
            isResolved: false,
            createdAt: new Date(),
          });
        }
      }
    }
  }

  // 计算评分
  const score = calculateScore(issues);

  // 生成建议结论
  const recommendation = generateRecommendation(score, issues);

  // 生成摘要
  const summary = generateSummary(issues, score, docType);

  return {
    score,
    recommendation,
    summary,
    issues,
    analysis: {
      totalBlocks: parseResult.blocks.length,
      totalPages: parseResult.totalPages,
      matchedRules: issues.map((i) => i.category),
    },
  };
}

// 在区块中查找关键词
function findKeywordInBlocks(
  keyword: string,
  blocks: ConvertedBlock[]
): ConvertedBlock[] {
  return blocks.filter((block) =>
    block.content.toLowerCase().includes(keyword.toLowerCase())
  );
}

// 在区块中查找正则匹配
function findPatternInBlocks(
  pattern: RegExp,
  blocks: ConvertedBlock[]
): ConvertedBlock | null {
  for (const block of blocks) {
    if (pattern.test(block.content)) {
      return block;
    }
  }
  return null;
}

// 计算评分
function calculateScore(issues: ReviewIssue[]): number {
  // 基础分 100 分
  let score = 100;

  // 根据问题严重程度扣分
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

  // 确保分数在 0-100 范围内
  return Math.max(0, Math.min(100, score));
}

// 生成建议结论
function generateRecommendation(
  score: number,
  issues: ReviewIssue[]
): "pass" | "fail" | "revise" {
  // 存在严重问题，不通过
  if (issues.some((i) => i.severity === "critical")) {
    return "fail";
  }

  // 分数低于 60，不通过
  if (score < 60) {
    return "fail";
  }

  // 存在重要问题，建议整改
  if (issues.some((i) => i.severity === "major")) {
    return "revise";
  }

  // 其他情况通过
  return "pass";
}

// 生成审查摘要
function generateSummary(
  issues: ReviewIssue[],
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

// 导出审查服务
export const reviewAgent = {
  reviewDocument,
};