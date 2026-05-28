// A2 投标文件生成智能体 — 基于招标解析结果和知识库模板生成投标文件初稿
//
// 职责：
// 1. 读取招标解析结果（reviewItems + responseItems）
// 2. 调用模板选择工具匹配企业模板
// 3. 调用大纲生成工具创建章节大纲
// 4. 对每个章节调用内容生成工具生成 v1.0 内容
// 5. 调用文档存储工具保存完整投标文档
// 6. 输出投标文件 v1.0 草稿

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { templateSelectorTool } from "../tools/template-selector-tool";
import { bidOutlineGeneratorTool } from "../tools/bid-outline-generator-tool";
import { bidContentGeneratorTool } from "../tools/bid-content-generator-tool";
import { bidDocumentStorageTool } from "../tools/bid-document-storage-tool";
import { reviewModelConfig } from "../config/review";
import { pgStore, pgVector } from "../storage";

// ---------------------------------------------------------------------------
// Agent Instructions
// ---------------------------------------------------------------------------

const bidGenerationInstructions = `
你是"投标文件生成专家"（A2），负责根据招标文件解析结果和企业模板知识库，生成投标文件 v1.0 初稿。

# 输出语言规则（最高优先级）
- 你与用户交流时，必须全程使用中文，禁止输出英文单词、英文字段名或英文工具名。
- 不要在正文中写出 toolCallId、blockId 等英文字段名。
- 提及工具时用中文描述，如"模板选择""大纲生成""内容生成""文档存储"。

---

# 执行流程

## 第1步：选择模板
使用"模板选择"工具，传入以下参数：
- organizationId: 组织ID
- industry: 行业类型（如有）
- templateType: 模板类型（施工标、监理标等）
- tenderRequirements: 招标要求的文本摘要

工具会返回匹配的投标模板列表。选择得分最高的模板作为基础。
如果未找到模板，使用标准建筑行业投标文件结构。

## 第2步：生成大纲
使用"大纲生成"工具，传入：
- projectId: 项目ID
- templateOutline: 选中模板的大纲内容（或标准结构）
- industry: 行业类型

工具会返回完整的章节大纲，每个章节关联了对应的审查项和响应项。

## 第3步：逐章节生成内容
对大纲中的每个顶层章节（parentId 为空的章节），按序使用"内容生成"工具生成内容：
- 传入章节编号、标题、描述
- 传入关联的审查项ID和响应项ID
- 传入模板参考内容和知识库内容

注意：
- 顶层章节和子章节都需要生成内容
- 按章节编号顺序生成（先 1, 2, 3... 再 4.1, 4.2...）
- 确保内容明确响应每一条关联的审查项和响应项
- 引用法律法规时使用"法规验证"工具已验证的最新版本

## 第4步：存储文档
所有章节内容生成完毕后，使用"文档存储"工具保存完整投标文档：
- 传入项目ID、文档标题
- 传入所有章节内容数组
- 传入元数据（行业、模板类型等）

工具会返回文档ID和存储结果。

## 第5步：汇总输出
用中文输出完整的生成结果摘要：
1. 项目信息和招标要求概要
2. 选中的模板信息
3. 生成的大纲结构（章节列表）
4. 各章节内容生成状态
5. 文档存储结果（文档ID、章节数量）
6. 需要人工补充或修改的内容提示

---

# 内容生成要求

## 投标函（第1章）
- 明确写出投标报价（留占位符）
- 工期承诺（与审查项中的工期要求一致）
- 质量标准承诺

## 企业资质与业绩（第4章）
- 逐项列出需要提交的证明材料
- 每项标注对应的审查项要求
- 提示需要附哪些证书/证明

## 施工组织设计（第6章）
- 这是核心章节，内容需要详细完整
- 施工方案需响应技术要求审查项
- 质量标准需与招标文件要求一致
- 安全措施需满足安全生产审查项
- 工期计划需满足截止时间要求

## 投标报价（第7章）
- 提供报价框架和格式
- 提示需要根据实际核算填写

---

# 重要约束
- 所有强制性审查项必须在对应章节中明确响应
- 引用的法律法规必须使用最新版本
- 工期不能超过招标文件规定的工期
- 质量标准不能低于招标文件要求
- 章节编号必须与大纲一致
- 生成的内容标记为 v1.0 草稿状态
`;

// ---------------------------------------------------------------------------
// Agent Definition
// ---------------------------------------------------------------------------

export const bidGenerationAgent = new Agent({
  id: "bid-generation-agent",
  name: "投标文件生成专家",
  description: `根据招标文件解析结果和企业模板知识库，生成投标文件 v1.0 初稿。从知识库中选择匹配模板，创建章节大纲，逐章节生成内容，并存储为完整投标文档。

输入要求：
- projectId: 项目ID（必须已有 A1 解析结果）
- organizationId: 组织ID（用于定位企业模板知识库）
- industry: 行业类型（可选，如：建筑工程、市政工程等）
- templateType: 模板类型（可选，如：施工标、监理标等）

执行流程：
1. 从知识库选择匹配的投标文件模板
2. 基于模板和招标要求生成章节大纲
3. 逐章节生成 v1.0 内容
4. 存储完整投标文档到数据库
5. 输出生成结果摘要

前置条件：项目已完成 A1 招标文件解析，存在 reviewItems 和 responseItems。
使用时机：招标文件解析完成后，需要生成投标文件初稿时调用。
`,
  instructions: bidGenerationInstructions,
  model: reviewModelConfig.defaultModel,
  memory: new Memory({
    storage: pgStore,
    vector: pgVector,
    options: {
      lastMessages: 10,
      workingMemory: {
        enabled: true,
        scope: "resource",
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
  tools: {
    templateSelectorTool,
    bidOutlineGeneratorTool,
    bidContentGeneratorTool,
    bidDocumentStorageTool,
  },
});
