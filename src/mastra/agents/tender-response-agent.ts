import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { reviewModelConfig, tenderResponseInstructions } from "../config/review";
import { documentReaderTool } from "../tools/document-reader-tool";
import { getResponseItemsTool } from "../tools/get-response-items-tool";
import { getReportTool } from "../tools/get-report-tool";
import { resolveReviewReportTool } from "../tools/resolve-review-report-tool";
import { structuredReviewStorageTool } from "../tools/structured-review-storage-tool";
import { pgStore, pgVector } from "../storage";

export const tenderResponseAgent = new Agent({
  id: "tender-response-agent",
  name: "投标响应审查专家",
  instructions: tenderResponseInstructions,
  model: reviewModelConfig.defaultModel,
  memory: new Memory({
    storage: pgStore,
    vector: pgVector,
    options: {
      lastMessages: 20,
      workingMemory: {
        enabled: true,
        scope: "resource",
      },
      generateTitle: true,
    },
  }),
  tools: {
    resolveReviewReportTool,
    getReportTool,
    getResponseItemsTool,
    documentReaderTool,
    structuredReviewStorageTool,
  },
});
