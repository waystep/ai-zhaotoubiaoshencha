// 主协调智能体 - 分析招标/法律文档并动态设计审查检查点
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { documentReaderTool } from "../tools/document-reader-tool";
import { checkpointDesignTool } from "../tools/checkpoint-design-tool";
import {
  orchestrationInstructions,
  orchestrationWorkingMemoryTemplate,
  reviewModelConfig,
} from "../config/review";
import { pgStore, pgVector } from "../storage";

export const orchestrationAgent = new Agent({
  id: "orchestration-agent",
  name: "招标审查协调专家",
  description: `分析招标/法律文档结构，动态设计审查检查点。

输入要求：
- projectId: 项目ID
- targetDocType: 文档类型(tender_doc/legal_doc/bid_doc)
- documentBlocks: 文档解析后的blocks数据

输出格式：
{
  "checkpoints": [
    {
      "checkpointId": "qual-001",
      "category": "qualification",
      "focusAreas": ["资质门槛", "业绩要求"],
      "relevantBlockTypes": ["text", "table"],
      "severityExpectation": "major",
      "checkDescription": "检查资质要求是否过高或具有排斥性"
    }
  ],
  "documentBlocks": [...],  // 用于审查的blocks
  "documentId": "...",
  "documentName": "..."
}

使用时机：审查流程的第一步，为后续审查提供检查点清单。
`,
  instructions: orchestrationInstructions,
  model: reviewModelConfig.reasoningModel,
  memory: new Memory({
    storage: pgStore,
    vector: pgVector,
    options: {
      lastMessages: 15,
      workingMemory: {
        enabled: true,
        scope: "resource",  // 使用resource级别的Memory共享
        template: orchestrationWorkingMemoryTemplate,
      },
      generateTitle: true,
    },
  }),
  tools: {
    documentReaderTool,
    checkpointDesignTool,
  },
});
