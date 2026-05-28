// 工作流总协调智能体 — Workflow Supervisor
//
// 职责：
// - 接收工作流类型（tender-to-bid 或 review-pipeline）
// - 按正确顺序协调智能体调用
// - 处理错误（如 A3 失败，不继续 A4/A5）
// - 追踪并回报工作流进度
//
// 两种工作流：
// Flow 1 (tender-to-bid): A1 招标解析 → A2 投标生成
// Flow 2 (review-pipeline): A7→A3→A4+A5→A6

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { tenderParsingAgent } from "./tender-parsing-agent";
import { bidGenerationAgent } from "./bid-generation-agent";
import { bidParsingAgent } from "./bid-parsing-agent";
import { bidReviewAgent } from "./bid-review-agent";
import { riskLocationAgent } from "./risk-location-agent";
import { legalParsingAgent } from "./legal-parsing-agent";
import { reportGenerationAgentV2 } from "./report-generation-agent-v2";
import { getReportInfoTool } from "../tools/get-report-info-tool";
import { reportStatusUpdateTool } from "../tools/report-status-update-tool";
import { getReviewItemsTool } from "../tools/get-review-items-tool";
import { documentReaderTool } from "../tools/document-reader-tool";
import {
  reviewModelConfig,
  supervisorWorkingMemoryTemplate,
} from "../config/review";
import { pgStore, pgVector } from "../storage";

// ---------------------------------------------------------------------------
// Supervisor Instructions
// ---------------------------------------------------------------------------

const workflowSupervisorInstructions = `
你是"工作流总协调专家"，负责根据工作流类型协调多个智能体按正确顺序执行。

# 输出语言规则（最高优先级）
- 你与用户交流时，必须全程使用中文，禁止输出英文单词、英文字段名或英文工具名。
- 提及智能体时用中文名称：招标解析专家、投标生成专家、投标解析专家、投标预审专家、风险定位专家、法规解析专家、报告撰写专家。
- 提及工具时用中文描述，如"获取报告信息""更新报告状态""获取审查项""文档阅读"。

---

# 工作流类型

## Flow 1: 招标解析→投标生成 (tender-to-bid)
按顺序执行：
1. 委托"招标解析专家"（A1）解析招标文件，提取审查项和响应项
2. 等待 A1 完成
3. 委托"投标生成专家"（A2）基于解析结果生成投标文件初稿
4. 等待 A2 完成
5. 输出最终结果

## Flow 2: 投标预审流水线 (review-pipeline)
按顺序执行：
1. 检查是否已有投标文件解析结果（使用"获取审查项"或"文档阅读"工具查看）
2. 如果没有解析结果，委托"投标解析专家"（A7）解析投标文件
3. 委托"投标预审专家"（A3）执行风险检测
4. 等待 A3 完成
   - 如果 A3 失败或结果不完整，不要继续后续步骤，直接报告错误
5. 委托"风险定位专家"（A4）进行风险精确定位
6. 委托"法规解析专家"（A5）进行法规深度分析
7. 等待 A4 和 A5 都完成
8. 委托"报告撰写专家"（A6）汇总生成最终报告
9. 等待 A6 完成
10. 使用"获取报告信息"工具验证报告完整性
11. 使用"更新报告状态"工具将状态设为已完成
12. 输出最终审查摘要

---

# 错误处理规则

1. 如果某个步骤失败，立即停止后续步骤
2. 向用户报告失败原因和建议的修复方式
3. 对于 A3 失败：不要触发 A4/A5/A6
4. 对于 A4 或 A5 失败：可以尝试单独重试失败的步骤（最多 1 次）
5. 对于 A6 失败：可以重试（最多 1 次）
6. 使用"更新报告状态"工具将失败报告的状态设为失败

# 进度追踪

每完成一个步骤，用中文输出当前进度：
- 当前步骤名称和状态
- 已完成步骤数 / 总步骤数
- 如果步骤产生结果，简要说明

# 最终输出

工作流完成后，输出：
1. 工作流类型
2. 各步骤完成状态（通过/失败/跳过）
3. 关键结果（审查项数量、风险项数量、评分等）
4. 关联资源 ID（报告ID、文档ID等）
`;

// ---------------------------------------------------------------------------
// Agent Definition
// ---------------------------------------------------------------------------

export const workflowSupervisor = new Agent({
  id: "workflow-supervisor",
  name: "工作流总协调专家",
  description: `根据工作流类型协调多个智能体按正确顺序执行完整工作流。

支持两种工作流：

1. **tender-to-bid（招标解析→投标生成）**
   - A1 招标文件解析 → A2 投标文件生成
   - 输入：projectId, organizationId
   - 输出：审查项 + 投标文件初稿

2. **review-pipeline（投标预审流水线）**
   - A7 投标解析（如需）→ A3 风险检测 → A4 风险定位 + A5 法规解析 → A6 报告生成
   - 输入：projectId, documentId, organizationId, reportId（可选）
   - 输出：结构化预审报告

错误处理：如果 A3 失败则不继续 A4/A5/A6；A4/A5 失败可单独重试。
进度追踪：每步完成后汇报进度和中间结果。
`,
  instructions: workflowSupervisorInstructions,
  model: reviewModelConfig.defaultModel,
  memory: new Memory({
    storage: pgStore,
    vector: pgVector,
    options: {
      lastMessages: 15,
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: supervisorWorkingMemoryTemplate,
      },
      observationalMemory: {
        enabled: true,
        model: reviewModelConfig.defaultModel,
        observation: { messageTokens: 60000, blockAfter: 90000 },
        reflection: { observationTokens: 90000 },
      },
      generateTitle: true,
    },
  }),
  agents: {
    // Flow 1 agents
    tenderParsingAgent,
    bidGenerationAgent,
    // Flow 2 agents
    bidParsingAgent,
    bidReviewAgent,
    riskLocationAgent,
    legalParsingAgent,
    reportGenerationAgentV2,
  },
  tools: {
    getReportInfoTool,
    reportStatusUpdateTool,
    getReviewItemsTool,
    documentReaderTool,
  },
});
