# 智能投标预审智能体 AI审查系统文档

## 1. 系统概述

### 1.1 技术架构

智能投标预审智能体的 AI审查系统基于 **Mastra** 多智能体框架构建，采用 **Supervisor-Agent** 协作模式：

| 项目 | 技术 |
|------|------|
| **AI框架** | Mastra v1.32.1 |
| **AI SDK** | Vercel AI SDK v6.0.176 |
| **模型服务** | 阿里云 DashScope (Qwen/GLM) |
| **存储** | PostgreSQL (Memory + Vector) |

### 1.2 核心能力

- **审查项提取**：从招标文件自动提取5类固定审查项
- **投标文件审查**：验证投标文件是否满足审查项要求
- **图像风险分析**：检查图片中的Logo、水印等暗标风险
- **报告生成**：汇总结果并结构化落库

---

## 2. 智能体架构

### 2.1 Agent 职责矩阵

| Agent | 角色 | 职责 | 输入 | 输出 |
|-------|------|------|------|------|
| **tender-review-supervisor** | 总协调者 | 协调专业团队完成完整审查（每个子智能体只委托一次） | projectId, reportId, bidDocumentId | 完成状态, score, recommendation |
| **extraction-agent** | 审查项提取专家 | 从招标文件提取5类固定审查项 | projectId, documentId | extractionItems[] |
| **tender-review-agent** | 投标文件审查专家 | 基于审查项逐条审查投标文件 | reportId, projectId, bidDocumentId | reviewItemResults[], issues[] |
| **image-review-agent** | 图像风险分析专家 | 分析图片暗标风险（Logo、水印等） | 图片内容 | hasRisk, riskType, riskText |
| **report-generation-agent** | 报告生成专家 | 汇总结果并落库 | reportId, projectId, documentId | 完整审查报告 |

### 2.2 协作流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Supervisor Agent                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Step 0: get-standard-documents-parse-status(projectId)      │ │
│  │ - 检查标准文件（tender_doc/legal_doc）解析状态               │ │
│  │ - 检查 isExtractionComplete 判断是否需要提取                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Step 1: extraction-agent（仅当 isExtractionComplete=false） │ │
│  │ - 提取5类审查项：完整性、关键信息一致性、质量目标、         │ │
│  │   项目名称一致性、编制依据                                   │ │
│  │ - 输出: extractionItems[]                                   │ │
│  │ ⚠️ 只委托一次，不管结果如何都不重复                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Step 2: tender-review-agent                                 │ │
│  │ - 获取审查项 get-review-items(projectId)                    │ │
│  │ - 读取投标文件 document-reader(projectId, bidDocumentId)    │ │
│  │ - 逐条审查，产出 reviewItemResults[] 和 issues[]            │ │
│  │ - 调用 structured-review-storage 保存审查项结果              │ │
│  │ ⚠️ 只委托一次，不管结果如何都不重复                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Step 3: report-generation-agent                             │ │
│  │ - 获取报告状态 get-report(reportId)                         │ │
│  │ - 获取图片风险 get-image-risks(documentId)                  │ │
│  │ - 生成 Markdown 格式摘要                                     │ │
│  │ - 调用 structured-review-storage 完成落库                   │ │
│  │ ⚠️ 只委托一次，不管结果如何都不重复                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Step 4: 输出简短摘要，宣布审查流程完成                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 智能体详细说明

### 3.1 tender-review-supervisor (总协调者)

**配置**：
```typescript
{
  id: "tender-review-supervisor",
  name: "招标审查总协调专家",
  model: "alibaba-coding-plan-cn/qwen3.6-plus",
  memory: {
    lastMessages: 20,
    workingMemory: { enabled: true, scope: "resource" },
    generateTitle: true
  },
  agents: {
    extractionAgent,
    tenderReviewAgent,
    reportGenerationAgent,
  },
  tools: {
    getStandardDocumentsParseStatusTool,
  }
}
```

**执行规则（固定流程，每步只做一次）**：
1. 调用 `get-standard-documents-parse-status` 检查解析和提取状态
2. 如果 `isExtractionComplete=false`，委托 extraction-agent（只一次）
3. 委托 tender-review-agent 审查投标文件（只一次）
4. 委托 report-generation-agent 汇总并落库（只一次）
5. 输出审查完成摘要

**关键约束**：
- 每个子智能体最多委托 1 次
- 不管子智能体返回什么结果，都不重新委托
- 子智能体返回后直接进入下一步

### 3.2 extraction-agent (审查项提取专家)

**配置**：
```typescript
{
  id: "extraction-agent",
  name: "技术标审查项提取专家",
  model: "alibaba-coding-plan-cn/qwen3.6-plus",
  tools: {
    extractionItemStorageTool,
    documentReaderTool,
    getReviewItemsTool,
  }
}
```

**提取流程**：
```
Step 1: get-review-items(documentId) 查询已有审查项
Step 2: document-reader(projectId, documentId) 全文读取
Step 3: extraction-item-storage 存储审查项（支持覆盖已有项）
```

**审查项类型（仅允许 5 类，每种最多 1 条）**：

| 类型 | 提取内容 |
|------|---------|
| **完整性** | 技术标目录完整内容 |
| **关键信息一致性** | 工期、开工/竣工日期、项目编号、标段号、建设地点、招标人、投标截止时间等 |
| **质量目标** | 质量等级、验收标准、创优目标、文明工地 |
| **项目名称一致性** | 正式项目名称、标段名、暗标要求、禁止出现其他项目名 |
| **编制依据** | 明确编号/名称的国标、行标、法规 |

**存储字段**：
```typescript
{
  projectId: string,
  documentId: string,
  items: [{
    id: "已有项UUID（覆盖时传入）",
    section: "技术标" | "商务标",
    title: "审查项类型",
    checkpoint: "审查判定标准",
    consequence: 0.9,  // 权重 0-1
    blocks: [{ blockId, pageNumber, blockIndex }],
  }],
  extractedBy: "extraction-agent"
}
```

### 3.3 tender-review-agent (投标文件审查专家)

**配置**：
```typescript
{
  id: "tender-review-agent",
  name: "投标文件审查专家",
  model: "alibaba-coding-plan-cn/qwen3.6-plus",
  memory: { enabled: true, scope: "resource" },
  tools: {
    resolveReviewReportTool,
    getReportTool,
    getReviewItemsTool,
    documentReaderTool,
    structuredReviewStorageTool,
  }
}
```

**审查流程**：
```
Step 1: resolve-review-report 验证或创建报告ID
Step 2: get-review-items(projectId) 获取审查项
Step 3: document-reader(projectId, bidDocumentId) 读取投标文件
Step 4: 逐条审查每个审查项：
        - pass: 满足要求
        - fail: 存在问题
        - needs_manual_review: 证据不足
Step 5: structured-review-storage 保存结果
```

**审查项结果状态**：
| 状态 | 含义 |
|------|------|
| `pass` | 投标文件满足该审查项 |
| `fail` | 投标文件存在该审查项对应的问题 |
| `needs_manual_review` | 证据不足或无法确认 |

### 3.4 image-review-agent (图像风险分析专家)

**配置**：
```typescript
{
  id: "image-review-agent",
  name: "图像风险分析专家",
  model: "alibaba-coding-plan-cn/qwen3.6-plus",
  tools: {}  // 独立调用，通过图片输入
}
```

**职责**：分析图片是否存在招标审查风险（暗标风险）

**风险类型**：
- 企业Logo（企业标识）
- 水印
- 其他项目名称

**输出格式**：
```json
{
  "hasRisk": true,
  "riskType": "企业Logo",
  "riskText": "某某建设集团",
  "confidence": 0.85
}
```

### 3.5 report-generation-agent (报告生成专家)

**配置**：
```typescript
{
  id: "report-generation-agent",
  name: "审查报告撰写专家",
  model: "alibaba-coding-plan-cn/glm-5",  // 推理模型
  memory: { enabled: true, scope: "resource" },
  tools: {
    getReportTool,
    getImageRisksTool,
    issueStorageTool,
    structuredReviewStorageTool,
  }
}
```

**报告生成流程**：
```
Step 1: get-report(reportId) 获取报告状态和已有审查数据
Step 2: get-image-risks(documentId) 获取图片暗标风险
Step 3: 如果无数据 → 输出"暂无审查数据"并结束
Step 4: 如果有数据 → 生成 Markdown 摘要
Step 5: structured-review-storage 落库（更新报告状态为 completed）
```

---

## 4. 工具定义

### 4.1 工具清单

| 工具 | 文件 | 用途 |
|------|------|------|
| documentReaderTool | `document-reader-tool.ts` | 分页读取文档内容和区块 |
| extractionItemStorageTool | `extraction-item-storage-tool.ts` | 存储或覆盖审查项 |
| getReviewItemsTool | `get-review-items-tool.ts` | 获取项目审查项列表 |
| getStandardDocumentsParseStatusTool | `get-standard-documents-parse-status-tool.ts` | 检查标准文件解析和提取状态 |
| getReportTool | `get-report-tool.ts` | 获取报告信息 |
| resolveReviewReportTool | `resolve-review-report-tool.ts` | 验证或创建审查报告 |
| structuredReviewStorageTool | `structured-review-storage-tool.ts` | 结构化审查结果存储 |
| issueStorageTool | `issue-storage-tool.ts` | 问题存储 |
| getImageRisksTool | `get-image-risks-tool.ts` | 获取图片风险分析结果 |

### 4.2 documentReaderTool (文档读取)

**输入参数**：
```typescript
{
  projectId: string,      // 项目ID
  documentId: string,     // 文档ID（可选）
  startPage?: number,     // 起始页码
  endPage?: number        // 结束页码
}
```

**输出**：
```typescript
{
  documents: [{
    id: string,
    name: string,
    docType: string,
    totalPages: number,
    blocks: [{
      id: string,
      pageNumber: number,
      blockIndex: number,
      content: string,
    }]
  }],
  blockCount: number,
  summary: string,
}
```

### 4.3 extractionItemStorageTool (审查项存储)

**输入参数**：
```typescript
{
  projectId: string,
  documentId: string,
  items: [{
    id?: string,           // 已有项UUID（传入则覆盖）
    section?: "技术标" | "商务标",
    title: string,         // 审查项类型
    checkpoint: string,    // 审查判定标准
    consequence?: number,  // 权重 0-1
    blocks: [{ blockId, pageNumber, blockIndex }],
  }],
  extractedBy?: string,
}
```

**输出**：
```typescript
{
  storedItemIds: string[],
  totalStored: number,
  updatedIds: string[],
  newIds: string[],
  success: boolean,
}
```

### 4.4 getStandardDocumentsParseStatusTool (标准文档状态)

**输入参数**：
```typescript
{
  projectId: string,
}
```

**输出**：
```typescript
{
  projectId: string,
  isReadyForReview: boolean,      // 所有标准文档解析完成
  isExtractionComplete: boolean,  // 至少有一个审查项
  totalStandardDocuments: number,
  totalExtractionItems: number,
  parseStats: { pending, processing, completed, failed },
  documents: [{
    id, name, originalName, docType,
    parseStatus, parseError, parsedAt,
    extractionItemsCount,
  }],
  summary: string,
}
```

### 4.5 structuredReviewStorageTool (结构化存储)

**输入参数**：
```typescript
{
  reportId: string,
  score: number,              // 0-100
  recommendation: "pass" | "fail" | "revise",
  summary: string,            // Markdown 格式摘要
  issues?: [{
    blockId?: string,
    checkpointId?: string,
    category: string,
    severity: "critical" | "major" | "minor" | "suggestion",
    title: string,
    description: string,
    location: { pageNumber, blockIndex, bbox?, textSnippet?, highlightText? },
    suggestion?: string,
    agentSource?: string,
  }],
  reviewItemResults?: [{
    reviewItemId: string,
    status: "pass" | "fail" | "needs_manual_review",
    reason: string,
    evidenceBlockIds?: string[],
    confidence?: number,
  }],
  aiAnalysis?: object,
  modelConfigUsed?: object,
}
```

**关键规则**：
- issues 和 reviewItemResults 可以是 JSON 数组或 JSON 字符串
- reviewItemId 可使用真实UUID或序号（如 "1", "2"），工具会自动映射
- 成功落库后报告状态自动更新为 `completed`
- 失败时报告状态更新为 `failed`

### 4.6 getImageRisksTool (图片风险查询)

**输入参数**：
```typescript
{
  documentId: string,
  onlyHasRisk?: boolean,  // 默认 true，只返回有风险的图片
}
```

**输出**：
```typescript
{
  images: [{
    id, pageNumber, imagePath, status,
    hasRisk, riskType, riskText, confidence,
  }],
  stats: { total, hasRisk, completed, failed },
  summary: string,
}
```

---

## 5. Memory 系统

### 5.1 配置

```typescript
const defaultMemory = new Memory({
  storage: pgStore,          // PostgreSQL 存储
  vector: pgVector,          // 向量存储
  options: {
    lastMessages: 20,        // 最近 20 条消息作为上下文
    workingMemory: {
      enabled: true,
      scope: "resource",     // 资源级工作记忆
    },
    generateTitle: true,     // 自动生成对话标题
  },
});
```

### 5.2 Working Memory Template

**Supervisor**：
```
项目审查上下文：
- 项目名称：{{projectName}}
- 项目类型：{{projectType}}
- 审查偏好：{{preferences}}
- 已完成审查次数：{{reviewCount}}
- 常见问题类型：{{commonIssues}}
```

**Report Generation Agent**：
```
审查报告信息：
- 报告ID：{{reportId}}
- 项目ID：{{projectId}}
- 文档ID：{{documentId}}
- 文档名称：{{documentName}}
- 审查完成时间：{{completedAt}}
- 发现问题数：{{issueCount}}
- 综合评分：{{score}}
```

---

## 6. 模型配置

### 6.1 当前配置

```typescript
export const reviewModelConfig = {
  // 优先使用 coding-plan 路由；未配置时回退到常规 alibaba 路由
  defaultModel: process.env.ALIBABA_CODING_PLAN_API_KEY
    ? "alibaba-coding-plan-cn/qwen3.6-plus"
    : "alibaba-cn/qwen3.6-plus",
  reasoningModel: process.env.ALIBABA_CODING_PLAN_API_KEY
    ? "alibaba-coding-plan-cn/glm-5"
    : "alibaba-cn/glm-5",
  maxSteps: 30,
} as const;
```

### 6.2 模型说明

| 模型 | 用途 | 特点 |
|------|------|------|
| **qwen3.6-plus** | 默认审查模型 | 通义千问，中文理解强，用于提取和审查 |
| **glm-5** | 推理模型 | GLM 系列，推理能力强，用于报告生成 |

### 6.3 API Key 配置

```bash
# 阿里云 DashScope API Key
ALIBABA_API_KEY=sk-xxx

# Coding Plan 路由（可选，优先使用）
ALIBABA_CODING_PLAN_API_KEY=sk-xxx
```

---

## 7. 审查流程详细说明

### 7.1 审查项提取流程

```
Step 1: 检查已有审查项
        get-review-items(documentId)
        ↓
Step 2: 全文读取招标文件
        document-reader(projectId, documentId)
        大文档可分批：startPage=1, endPage=30
        ↓
Step 3: 提取5类固定审查项
        - 完整性（目录）
        - 关键信息一致性（工期、时间、编号等）
        - 质量目标（质量等级、验收标准）
        - 项目名称一致性（项目名、暗标要求）
        - 编制依据（国标、行标、法规）
        ↓
Step 4: 存储到数据库
        extraction-item-storage
        - 已有同 title 项 → 传入 id 覆盖
        - 新项 → 不传 id，自动新增
```

### 7.2 投标文件审查流程

```
Step 1: 验证/创建报告ID
        resolve-review-report(projectId, bidDocumentId, reportId)
        ↓
Step 2: 获取审查项
        get-review-items(projectId)
        ↓
Step 3: 读取投标文件
        document-reader(projectId, bidDocumentId)
        ↓
Step 4: 逐条审查
        对每个审查项：
        - 查找投标文件中的证据 block
        - 判断是否满足要求
        - 记录结果: pass / fail / needs_manual_review
        - 发现问题时创建 issue
        ↓
Step 5: 保存审查项结果
        structured-review-storage
        ⚠️ 只传 reviewItemResults 和 issues
        ⚠️ 不传 summary/score/recommendation（由 report-generation-agent 负责）
```

### 7.3 报告生成流程

```
Step 1: 获取报告状态
        get-report(reportId)
        ↓
Step 2: 获取图片风险
        get-image-risks(documentId)
        ↓
Step 3: 检查数据
        如果 reviewItemResultsCount === 0 且图片风险为 0
        → 输出"暂无审查数据"并结束
        ↓
Step 4: 生成 Markdown 摘要
        模板包含：
        - 审查概况表
        - 招标文件重点内容解析
        - 招标文件与投标文件对比报告
        - 投标文件单独审核报告（暗标检查）
        - 审查问题汇总与整改情况
        - 审查结论
        ↓
Step 5: 落库存储
        structured-review-storage
        报告状态自动设为 completed
```

---

## 8. 报告摘要模板

报告生成智能体必须按以下 Markdown 模板生成 summary：

```markdown
# {{项目名称}}投标文件审查报告

> 报告编号：{{报告编号}}

---

# 一、审查概况

| 项目 | 内容 | 项目 | 内容 |
|---|---|---|---|
| 审查项目名称 | {{项目名称}} | 审查日期 | {{当前日期}} |
| 招标文件编号 | | 投标文件编制单位 | |
| 审查人员 | AI智能审查 | 审查方式 | AI智能审查 + 人工复核 |
| 审查范围 | ... | 审查依据 | ... |

---

# 二、招标文件重点内容解析

## 2.1 核心时间节点
## 2.2 业绩要求解析
## 2.3 项目核心内容
## 2.4 招标文件风险标记

---

# 三、招标文件与投标文件对比报告

## 3.1 内容对比（核心响应性）
## 3.2 关键参数对比

---

# 四、投标文件单独审核报告

## 4.1 编制依据审查
## 4.2 暗标检查
## 4.3 内容完整度检查
## 4.4 关键参数复核
## 4.5 其他细节审核

---

# 五、审查问题汇总与整改情况

## 5.1 问题分类汇总

| 问题等级 | 问题数量 | 问题描述 | 对应审查环节 | 整改建议 |
|---|---|---|---|---|
| 废标风险项（红色） | | | | 必须整改 |
| 严重扣分项（橙色） | | | | 优先整改 |
| 一般不符项（黄色） | | | | 限期整改 |
| 优化建议项（蓝色） | | | | 按需整改 |

## 5.2 整改复核情况

---

# 六、审查结论

- [ ] 合格
- [ ] 基本合格
- [ ] 不合格

**本次审查结论：{{根据 recommendation 填写}}**
```

---

## 9. 数据模型

### 9.1 核心表说明

| 表 | 业务含义 |
| --- | --- |
| `documents` | 项目文档，记录文件类型、解析状态、提取项数量 |
| `document_parsed_results` | 文档解析主结果，保存全文和结构化内容 |
| `document_blocks` | 文档区块，保存页码、区块序号、内容 |
| `extraction_items` | 从招标文件提取的审查项（5类固定） |
| `review_reports` | 审查报告主表，记录状态、评分、建议结论 |
| `review_issues` | 审查发现的问题清单 |
| `review_item_results` | 每个审查项的审查结果 |
| `image_risk_analysis` | 图片风险分析结果 |

### 9.2 报告状态流转

```
pending → in_progress → completed
                    ↘ failed
```

| 状态 | 含义 |
|------|------|
| `pending` | 报告已创建，等待审查 |
| `in_progress` | 审查进行中 |
| `completed` | 审查完成，结果已落库 |
| `failed` | 审查失败 |

---

## 10. 与现有文档的关系

**docs/minerU/智能审查流程设计文档.md** 详细描述了：
- 审查流程业务设计
- 数据模型设计
- 审查项定义

本文档侧重于：
- Mastra 技术架构实现
- Agent 职责划分与协作
- 工具定义与使用
- Memory 和模型配置

两份文档互为补充，共同构成 AI 审查系统的完整技术说明。