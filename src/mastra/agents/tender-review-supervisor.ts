// 招标审查总协调智能体 - Supervisor Agent协调各专业审查智能体
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { orchestrationAgent } from "./orchestration-agent";
import { contentReviewAgent } from "./content-review-agent";
import { imageReviewAgent } from "./image-review-agent";
import { reportGenerationAgent } from "./report-generation-agent";
import { documentReaderTool } from "../tools/document-reader-tool";
import { pgStore, pgVector } from "../storage";

export const tenderReviewSupervisor = new Agent({
  id: "tender-review-supervisor",
  name: "招标审查总协调专家",
  description: `招标文件审查的总协调者，负责协调专业审查团队完成完整审查流程。

输入要求：
- projectId: 项目ID
- reportId: 审查报告ID
- targetDocType: 文档类型(tender_doc/legal_doc/bid_doc)

输出格式：
{
  "success": true,
  "reportId": "...",
  "issueCount": 10,
  "score": 85,
  "recommendation": "pass/revise/fail",
  "summary": "审查摘要..."
}

审查流程：
1. 分析文档结构，设计检查点
2. 审查文本/表格内容合规性
3. 审查图表/印章等图像
4. 汇总结果生成报告

使用时机：完整的招标文件审查任务。
`,
  instructions: `你是招标文件审查的总协调者，负责协调专业审查团队完成审查任务。

## 可用资源（按委托顺序）

1. **orchestration-agent**
   - 功能：分析文档结构，动态设计审查检查点
   - 输入：projectId, targetDocType, documentBlocks
   - 输出：检查点清单JSON, 文档blocks
   - 委托时机：审查流程第一步

2. **content-review-agent**
   - 功能：审查文本和表格blocks的合规性
   - 输入：documentBlocks(按页分组), checkpoints
   - 输出：每个block的审查结果和问题清单
   - 委托时机：收到检查点后，审查内容

3. **image-review-agent**
   - 功能：审查图表、印章、签名等图像blocks
   - 输入：imageBlocks(已去重)
   - 输出：每个block的审查结果和问题
   - 委托时机：与content-review并行或顺序执行

4. **report-generation-agent**
   - 功能：汇总审查结果，生成最终报告
   - 输入：所有block审查结果, reportId
   - 输出：评分、建议结论、摘要、问题清单
   - 委托时机：收集完所有审查结果后

## 委托策略

接到审查任务后，按以下顺序委托：

### Step 1: 分析文档设计检查点
委托给 orchestration-agent：
- 使用 documentReaderTool 读取文档
- 分析文档结构，生成检查点
- 返回：checkpoints, documentBlocks

### Step 2: 内容审查
委托给 content-review-agent：
- 按页码分组blocks，每页调用一次
- 使用检查点审查内容
- 返回：blockReviews列表

### Step 3: 图像审查（如有）
委托给 image-review-agent：
- 对相同content的图像去重
- 逐个审查图像blocks
- 返回：blockReviews列表

### Step 4: 生成报告
委托给 report-generation-agent：
- 合并所有审查结果
- 计算评分，生成建议结论
- 存储问题到数据库
- 返回：完整报告JSON

## 限流控制（重要）

为避免API限流，每次委托间隔3秒：
- 在onDelegationStart中添加等待逻辑
- 监控委托结果，失败时记录错误

## 数据传递

委托时传递必要数据：
- Step 1 → Step 2: 传递checkpoints和documentBlocks
- Step 2/3 → Step 4: 传递所有blockReviews
- 保持reportId贯穿整个流程

## 错误处理

- 委托失败时：记录错误，继续尝试其他步骤
- 部分审查失败：将失败的blocks标记为存疑(questionable)
- 最终汇总：即使有部分失败，也要生成报告

## 输出要求

最终返回完整审查报告：
- success: 是否成功
- reportId: 报告ID
- issueCount: 问题总数
- score: 综合评分（0-100）
- recommendation: 建议结论（pass/revise/fail）
- summary: 审查摘要
`,
  model: "alibaba-coding-plan-cn/qwen3.6-plus",
  // ========== Memory 配置 ==========
  // Supervisor使用Memory记住审查历史和用户偏好
  memory: new Memory({
    storage: pgStore,
    vector: pgVector,
    options: {
      // 最近20条对话消息
      lastMessages: 20,
      // 工作记忆：存储项目信息、审查偏好等结构化数据
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: `
项目信息：
- 项目名称：{{projectName}}
- 项目类型：{{projectType}}
- 审查偏好：{{preferences}}

审查历史统计：
- 已完成审查次数：{{reviewCount}}
- 常见问题类型：{{commonIssues}}
`,
      },
      // 自动生成thread标题（便于在Studio中查看）
      generateTitle: true,
      // 注意：semanticRecall暂时禁用，因为需要embedder配置
      // semanticRecall: {
      //   topK: 5,
      //   messageRange: { before: 2, after: 1 },
      //   scope: "resource",
      // },
    },
  }),
  agents: {
    orchestrationAgent,
    contentReviewAgent,
    imageReviewAgent,
    reportGenerationAgent,
  },
  tools: {
    documentReaderTool,
  },
});