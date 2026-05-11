// 文档提取智能体 - 从招标文件和法律文件中提取审查项和响应项（统一模型）
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { extractionItemStorageTool } from "../tools/extraction-item-storage-tool";
import { documentReaderTool } from "../tools/document-reader-tool";
import {
  extractionInstructions,
  extractionWorkingMemoryTemplate,
  reviewModelConfig,
} from "../config/review";
import { pgStore, pgVector } from "../storage";

export const extractionAgent = new Agent({
  id: "extraction-agent",
  name: "文档提取专家",
  description: `从招标文件和法律文件中提取审查项和应答项，统一存储到 extraction_items 表。

输入要求：
- projectId: 项目ID
- documentId: 文档ID
- docType: 文档类型(tender_doc/legal_doc/bid_doc)

输出格式：统一使用 extractionItemStorageTool 存储，通过 itemCategory 区分 review/response。

使用时机：文档解析完成后，提取结构化审查项和应答项。

⚠️ **重要约束**：
- sourceBlockId 字段必须为 null 或留空
- 如果不确定 block ID，传递 null 即可
`,
  instructions: `${extractionInstructions}

## 提取策略

### 提取流程

#### Step 1: 读取文档
使用 documentReaderTool 读取文档 blocks，了解整体结构。

#### Step 2: 遍历 blocks，识别条款
识别条款编号模式：第X章、第X条、X.X、X.X.X、(一)(二)、一/二/三

#### Step 3: 分类提取 — 使用 itemCategory 区分

**审查项（itemCategory: "review"）** — 强制性/合规性要求：
- 包含强制性关键词："必须"、"应当"、"不得"、"强制性"、"必须满足"
- 包含后果描述："废标"、"不予受理"、"取消投标资格"、"违规"、"违法"
- 提出门槛要求：资质等级、注册资本、业绩要求、人员配置要求
- 法律责任条款：违约责任、赔偿责任、法律责任

**应答项（itemCategory: "response"）** — 要求投标人明确说明/提交：
- 要求投标人说明/提交/编制的内容
- 评分相关："评分标准"、"分值"、"权重"
- 格式要求："文字说明"、"表格"、"图纸"、"证明材料"

#### Step 4: 存储结果
统一调用 extractionItemStorageTool，传递 items 数组，每项的 itemCategory 区分类型。

**重要**：传递给工具的 items 参数必须是数组，不是字符串。

## 必须识别的重点内容

### 1. 工期要求（itemType: "工期要求", itemCategory: "review"）
识别所有关于工期的条款：
- 总工期天数（如"工期300日历天"、"计划工期XX天"）
- 开工日期和竣工日期要求
- 关键节点时间要求（如"主体结构封顶时间不得晚于..."）
- 工期延误的处罚条款（违约金计算方式、每日罚款金额）
- 工期提前的奖励条款

提取每个工期相关条款为独立的审查项。

### 2. 完整性要求（itemType: "完整性要求", itemCategory: "review"）
识别提醒投标人确保投标文件完整性的提示：
- "投标人应仔细阅读招标文件的全部内容"
- "投标人应对所有条款进行响应和承诺"
- "未响应视为不响应招标文件要求"
- "投标人须知"或"投标人承诺"类章节中的完整性条款
- 要求逐条响应的提示性文字

### 3. 编制标准（itemType: "编制标准", itemCategory: "review"）
识别引用的编制标准和规范：
- 国家标准（GB系列）、行业标准、地方标准
- 要求投标文件编制需遵循的标准和规范

**⚠️ 重要：即使招标文件中没有明确提及编制标准，也必须默认提取一条**：
{
  itemCategory: "review",
  itemType: "编制标准",
  title: "投标文件编制应符合相关法律法规和标准规范",
  description: "投标文件应按照国家及行业现行有关标准、规范、规程编制，包括但不限于相关施工规范、质量验收标准、安全操作规程等。投标人应确保其投标文件内容符合上述标准的最新版本要求。",
  consequence: "废标",
  extractionConfidence: 0.6
}

## 提取方法

### 语义理解
使用AI语义理解识别条款，不仅依赖关键词：
- 理解条款的语义含义
- 判断条款的性质（强制要求 vs 响应要求）
- 提取完整的条款内容

### 置信度计算
- 有明确条款编号 +0.1
- 有明确标题 +0.05
- 有完整描述（>50字） +0.05
- 有明确后果 +0.05
- 有法律依据 +0.05
- 基础置信度 0.7
低置信度（<0.8）项需人工验证。

## 类型灵活性
itemType 使用文本类型，根据文档内容灵活命名：资质要求、技术参数、工期要求、完整性要求、编制标准、违约责任等。
`,
  model: reviewModelConfig.defaultModel,
  memory: new Memory({
    storage: pgStore,
    vector: pgVector,
    options: {
      lastMessages: 20,
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: extractionWorkingMemoryTemplate,
      },
      generateTitle: true,
    },
  }),
  tools: {
    documentReaderTool,
    extractionItemStorageTool,
  },
});
