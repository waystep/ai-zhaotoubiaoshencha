// 内容审查智能体 - 审查文本和表格blocks的合规性
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { getReviewItemsTool } from "../tools/get-review-items-tool";
import { getResponseItemsTool } from "../tools/get-response-items-tool";
import {
  contentReviewInstructions,
  contentReviewWorkingMemoryTemplate,
  reviewModelConfig,
} from "../config/review";
import { pgStore, pgVector } from "../storage";

export const contentReviewAgent = new Agent({
  id: "content-review-agent",
  name: "招标文件内容审查专家",
  description: `审查文本和表格blocks的合规性，识别排斥性条款和风险点。

输入要求：
- documentBlocks: 文档blocks列表（按页分组）
- checkpoints: 相关检查点清单
- pageNumber: 当前审查的页码

输出格式：
[
  {
    "blockId": "...",
    "pageNumber": 1,
    "compliance": "compliant/non_compliant/questionable",
    "issues": [
      {
        "category": "资质要求",
        "severity": "major",
        "title": "资质门槛过高",
        "description": "...",
        "suggestion": "..."
      }
    ],
    "confidence": 0.85
  }
]

审查能力：
- 资质要求审查：检查资质门槛合理性
- 技术规范审查：识别指向性技术参数
- 评分标准审查：评估评分公平性
- 合同条款审查：检查违约责任对等性
- 合规性审查：确保符合法律法规

使用时机：审查流程第二步，对文档内容进行合规性审查。
`,
  instructions: `${contentReviewInstructions}

补充审查方法：
- 使用语义理解深度分析条款含义
- 识别隐藏的排斥性、倾向性、不公平条款
- 对比相关法规标准，判断合规性

对每个文本/表格区块输出：
- blockId: 区块ID
- compliance: compliant（合规）/ non_compliant（不合规）/ questionable（存疑）
- issues: [{category, severity, description, location, suggestion}]
- confidence: 审查置信度（0-1）

请使用 getReviewItemsTool 和 getResponseItemsTool 提取审查依据，并保持输出结构稳定。
`,
  model: reviewModelConfig.defaultModel,
  memory: new Memory({
    storage: pgStore,
    vector: pgVector,
    options: {
      lastMessages: 15,
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: contentReviewWorkingMemoryTemplate,
      },
      generateTitle: true,
    },
  }),
  tools: {
    getReviewItemsTool,
    getResponseItemsTool,
    // 将在后续添加：semanticAnalysisTool, complianceCheckTool, biasDetectionTool
  },
});
