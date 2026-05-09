// 招标文件审查 Agent
// 直接使用 Mastra 内置的 ModelsDevGateway 模型路由
import { Agent } from "@mastra/core/agent";
import { documentAnalysisTool } from "../tools/document-analysis-tool";
import { structuredReviewStorageTool } from "../tools/structured-review-storage-tool";
import { reviewModelConfig, tenderReviewInstructions } from "../config/review";

export const tenderReviewAgent = new Agent({
  id: "tender-review-agent",
  name: "招标文件审查专家",
  instructions: tenderReviewInstructions,
  model: reviewModelConfig.defaultModel,
  tools: {
    documentAnalysisTool,
    structuredReviewStorageTool,
  },
});
