# Looma — AI Native Zero-Code Platform

## 项目概述

**Looma** 是一个AI原生的零代码平台，融合传统SaaS能力与AI智能交互，让用户通过自然语言对话和可视化拖拽完成业务流程搭建。

### 核心特性

1. **业务零代码引擎** — 表单、流程、触发器、组织架构的拖拽式搭建
2. **AI对话交互** — 自然语言完成平台大部分操作
3. **智能体搭建** — 无代码创建AI Agent工作流（类n8n）

### 技术选型

| 层级 | 技术栈 | 说明 |
|------|--------|------|
| 前端框架 | Next.js 15 (App Router) | 全栈开发框架，支持前后端分离 |
| AI协议 | AG-UI | Agent-User交互协议，连接LangGraph与前端 |
| 智能体编排 | LangGraph | 多智能体工作流编排 |
| 智能体SDK | LangChain / CopilotKit | AI能力抽象层 |
| 数据库 | PostgreSQL + Drizzle ORM | 关系型数据持久化 |
| 认证 | NextAuth.js v5 | 企业级认证方案 |
| UI组件 | shadcn/ui + Radix | 设计系统基础 |
| 拖拽引擎 | dnd-kit / React Flow | 流程/表单可视化 |

---

## 功能规划 (Roadmap)

### Phase 1: MVP — 核心框架 (4-6周)

#### 1.1 项目脚手架
- [ ] Next.js 15 项目初始化（App Router + TypeScript）
- [ ] Drizzle ORM + PostgreSQL 配置
- [ ] shadcn/ui 组件库初始化
- [ ] 项目目录结构规范

#### 1.2 认证与权限
- [ ] NextAuth.js 多Provider认证（邮箱/GitHub/Google）
- [ ] RBAC权限模型设计（角色-权限-资源）
- [ ] 租户隔离机制（多租户SaaS）
- [ ] API权限中间件

#### 1.3 组织架构模块
- [ ] 企业/团队管理
- [ ] 部门树形结构
- [ ] 用户与角色绑定
- [ ] 成员邀请与角色分配

#### 1.4 AI对话基础
- [ ] AG-UI 协议集成
- [ ] CopilotKit 前端SDK
- [ ] 基础聊天界面
- [ ] 上下文管理与记忆

### Phase 2: 零代码表单引擎 (6-8周)

#### 2.1 表单设计器
- [ ] 拖拽式字段组件
- [ ] 字段类型：文本/数字/日期/选择/文件/子表单
- [ ] 表单布局：栅格、响应式
- [ ] 表单校验规则引擎

#### 2.2 表单渲染与数据
- [ ] 动态表单渲染器
- [ ] 表单提交与数据持久化
- [ ] 表单版本管理
- [ ] 数据导入/导出

#### 2.3 表单与AI集成
- [ ] AI辅助表单生成（自然语言描述→表单）
- [ ] 智能字段推荐
- [ ] 表单数据分析洞察

### Phase 3: 流程引擎 (6-8周)

#### 3.1 流程设计器
- [ ] React Flow 集成
- [ ] 节点类型：触发器/审批/条件/动作
- [ ] 流程连线与分支
- [ ] 流程版本控制

#### 3.2 流程运行时
- [ ] 流程执行引擎
- [ ] 审批节点实现
- [ ] 条件分支路由
- [ ] 流程实例管理

#### 3.3 触发器系统
- [ ] 定时触发 (Cron)
- [ ] Webhook触发
- [ ] 表单提交触发
- [ ] API触发

### Phase 4: 智能体搭建 (8-10周)

#### 4.1 智能体设计器
- [ ] 节点类型：LLM调用/工具/知识库/记忆
- [ ] 可视化编排界面
- [ ] 智能体模板市场

#### 4.2 LangGraph集成
- [ ] 状态机定义
- [ ] 工具注册系统
- [ ] 多Agent协作
- [ ] 人机交互节点

#### 4.3 智能体执行
- [ ] 异步执行引擎
- [ ] 执行日志与追踪
- [ ] 流式输出
- [ ] 错误恢复

### Phase 5: 企业增强 (持续迭代)

#### 5.1 高级权限
- [ ] 数据行级权限
- [ ] 字段级权限
- [ ] 审计日志

#### 5.2 集成能力
- [ ] MCP协议支持
- [ ] 外部API连接器
- [ ] Webhook事件

#### 5.3 性能与扩展
- [ ] 缓存层优化
- [ ] 队列系统（BullMQ）
- [ ] 多实例部署

---

## 功能模块详情

### M1: 认证与授权

#### 用户认证
```
用户注册 → 邮箱验证 → 登录 → 会话管理
                ↓
        OAuth Provider (GitHub/Google)
```

#### RBAC权限模型
```
Role (角色)
├── Admin: 超级管理员，拥有所有权限
├── Owner: 租户所有者
├── Manager: 部门经理
├── Member: 普通成员
└── Guest: 访客

Permission (权限)
├── resource:action 格式
├── 例如: form:create, form:read, form:update, form:delete
├── workflow:execute, agent:deploy, settings:manage
```

#### 多租户隔离
```
Tenant (租户)
├── id, name, plan, settings
├── Users[] → Role[]
├── Forms[] → Visibility: public/private/tenant
├── Workflows[]
└── Agents[]
```

### M2: 表单引擎

#### 字段类型
| 类型 | 组件 | 校验 |
|------|------|------|
| Text | Input | 必填/长度/正则 |
| Number | Input-number | 必填/范围 |
| Date | DatePicker | 必填/范围 |
| Select | Dropdown/Radio/Checkbox | 必填/选项 |
| File | Upload | 类型/大小 |
| RichText | Editor | 长度 |
| Reference | Link to another form | 关联校验 |

#### 字段属性
```typescript
interface FieldSchema {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  defaultValue?: any;
  validation: ValidationRule[];
  appearance: {
    width: number; // 栅格宽度 1-12
    order: number;
  };
  condition?: ConditionalLogic; // 显示条件
}
```

### M3: 流程引擎

#### 节点类型
```
Trigger (触发器)
├── Form Submit: 表单提交触发
├── Schedule: 定时触发
├── Webhook: 外部调用
└── Manual: 手动触发

Action (动作)
├── Notification: 发送通知
├── HTTP Request: 调用外部API
├── Database: 数据库操作
├── Email: 发送邮件
└── Approval: 审批节点

Logic (逻辑)
├── Condition: 条件分支
├── Loop: 循环
├── Parallel: 并行执行
└── Subworkflow: 子流程调用

AI (智能)
├── LLM: 大语言模型调用
├── Classifier: 内容分类
└── Extractor: 信息抽取
```

#### 流程数据结构
```typescript
interface WorkflowDefinition {
  id: string;
  version: number;
  nodes: WorkflowNode[];
  edges: Edge[];
  variables: Record<string, any>;
  errorHandlers: ErrorHandler[];
}
```

### M4: 智能体系统

#### Agent架构
```
Agent
├── Graph Definition (LangGraph StateGraph)
├── Tools[] (可调用工具)
├── Memory (记忆系统)
├── Knowledge (知识库引用)
└── Policies (执行策略)

State
├── messages: ConversationMessage[]
├── context: BusinessContext
├── memory: RetrievedMemory[]
└── metadata: AgentMetadata
```

#### 内置工具
```typescript
interface AgentTool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  handler: (params: any) => Promise<any>;
  category: 'database' | 'http' | 'file' | 'ai' | 'custom';
}
```

---

## 数据模型

### 核心实体关系

```
Organization (组织)
├── id, name, plan, settings
│
├── Department (部门)
│   ├── id, org_id, parent_id, name
│   └── has Members[]
│
├── User (用户)
│   ├── id, email, name, avatar
│   ├── org_id, department_id
│   ├── roles[]
│   └── preferences
│
├── Form (表单)
│   ├── id, org_id, name, schema (JSON)
│   ├── settings, version
│   └── has Submissions[]
│
├── Workflow (流程)
│   ├── id, org_id, name, definition (JSON)
│   ├── version, status
│   └── has Instances[]
│
└── Agent (智能体)
    ├── id, org_id, name
    ├── graph_definition (JSON)
    ├── tools[], memory_config
    └── has Executions[]
```

### 数据库Schema片段
```typescript
// 组织
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  plan: varchar('plan', { length: 50 }).default('free'),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 成员关系
export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id),
  userId: uuid('user_id').references(() => users.id),
  role: varchar('role', { length: 50 }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id),
  joinedAt: timestamp('joined_at').defaultNow(),
});
```

---

## 项目结构

```
Looma/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # 认证相关路由
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/        # 主应用路由组
│   │   │   ├── layout.tsx
│   │   │   ├── forms/          # 表单模块
│   │   │   ├── workflows/      # 流程模块
│   │   │   ├── agents/         # 智能体模块
│   │   │   ├── settings/        # 设置模块
│   │   │   └── page.tsx
│   │   ├── api/                 # API路由
│   │   │   ├── auth/
│   │   │   ├── forms/
│   │   │   ├── workflows/
│   │   │   └── agents/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/              # 组件库
│   │   ├── ui/                 # shadcn/ui基础组件
│   │   ├── forms/              # 表单相关组件
│   │   ├── workflow/           # 流程编辑器组件
│   │   ├── agents/             # 智能体组件
│   │   └── layout/             # 布局组件
│   │
│   ├── lib/                    # 核心库
│   │   ├── db/                # 数据库相关
│   │   │   ├── schema.ts      # Drizzle schema
│   │   │   ├── client.ts      # DB client
│   │   │   └── migrations/    # 迁移文件
│   │   ├── auth/              # 认证逻辑
│   │   │   ├── config.ts      # NextAuth配置
│   │   │   ├── permissions.ts # 权限检查
│   │   │   └── rbac.ts        # RBAC实现
│   │   ├── ai/                # AI相关
│   │   │   ├── agents/         # Agent定义
│   │   │   ├── prompts/       # Prompt模板
│   │   │   └── tools/         # 工具注册
│   │   ├── workflow/          # 流程引擎
│   │   ├── forms/             # 表单引擎
│   │   └── utils/             # 工具函数
│   │
│   ├── types/                  # TypeScript类型
│   │   ├── forms.ts
│   │   ├── workflows.ts
│   │   ├── agents.ts
│   │   └── auth.ts
│   │
│   └── styles/                 # 全局样式
│       └── globals.css
│
├── docs/                       # 文档
│   ├── architecture/           # 架构文档
│   ├── api/                   # API文档
│   └── guides/                # 使用指南
│
├── drizzle.config.ts          # Drizzle配置
├── next.config.ts             # Next.js配置
├── package.json
└── tsconfig.json
```

---

## 技术架构

### 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Next.js    │  │   shadcn    │  │  React Flow /   │  │
│  │  App Router │  │     UI      │  │    dnd-kit      │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                    AG-UI Protocol Layer                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  CopilotKit │  │  Streaming  │  │  Event System  │  │
│  │   Frontend  │  │   Handler   │  │                 │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                    API Gateway Layer                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Next.js    │  │  Rate Limit │  │    Auth         │  │
│  │  Route Hand │  │   Middleware│  │   Middleware   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                    Business Logic Layer                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Form      │  │  Workflow   │  │     Agent       │  │
│  │   Engine    │  │   Engine    │  │    Engine       │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                    LangGraph Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   State     │  │   Graph     │  │     Tools       │  │
│  │  Definition │  │   Runtime   │  │   Registry      │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                    Data Access Layer                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Drizzle   │  │  PostgreSQL │  │     Redis       │  │
│  │    ORM      │  │             │  │   (Queue)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 前后端分离架构

```
                    ┌─────────────────┐
                    │   Mobile App    │
                    └────────┬────────┘
                             │ REST/GraphQL
                    ┌────────▼────────┐
                    │   API Gateway  │
                    │   (Kong/Nginx) │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐   ┌────────▼───────┐   ┌────────▼───────┐
│  Form Service  │   │ Workflow Svc  │   │  Agent Service │
│  (独立微服务)  │   │  (独立微服务)  │   │  (LangGraph)   │
└───────────────┘   └───────────────┘   └────────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    └─────────────────┘
```

### AI交互流程 (AG-UI)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   User   │───▶│ Frontend │───▶│  AG-UI   │───▶│ LangGraph│
│          │◀───│  (React) │◀───│ Protocol │◀───│  Agent   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                         │              │
                         │   Events     │
                         ▼              ▼
                  ┌──────────┐   ┌──────────┐
                  │ CopilotKit│   │  Tools   │
                  │  Runtime  │   │  Execute │
                  └──────────┘   └──────────┘
```

---

## API设计

### RESTful API结构

```
认证
POST   /api/auth/register        注册
POST   /api/auth/login           登录
POST   /api/auth/logout          登出
GET    /api/auth/session         获取会话
POST   /api/auth/verify-email    邮箱验证

组织
GET    /api/organizations        获取组织列表
POST   /api/organizations        创建组织
GET    /api/organizations/:id    获取组织详情
PUT    /api/organizations/:id    更新组织
GET    /api/organizations/:id/members   成员列表
POST   /api/organizations/:id/invite    邀请成员

表单
GET    /api/forms                表单列表
POST   /api/forms                创建表单
GET    /api/forms/:id            获取表单
PUT    /api/forms/:id            更新表单
DELETE /api/forms/:id            删除表单
POST   /api/forms/:id/submit     提交表单
GET    /api/forms/:id/submissions 获取提交记录

流程
GET    /api/workflows            流程列表
POST   /api/workflows            创建流程
GET    /api/workflows/:id        获取流程
PUT    /api/workflows/:id        更新流程
DELETE /api/workflows/:id        删除流程
POST   /api/workflows/:id/enable 启用流程
POST   /api/workflows/:id/execute 执行流程
GET    /api/workflows/:id/instances 流程实例

智能体
GET    /api/agents               智能体列表
POST   /api/agents                创建智能体
GET    /api/agents/:id            获取智能体
PUT    /api/agents/:id            更新智能体
DELETE /api/agents/:id           删除智能体
POST   /api/agents/:id/chat       与智能体对话
GET    /api/agents/:id/executions 执行历史
```

### API响应格式

```typescript
// 成功响应
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [...]
  }
}
```

---

## 安全性考虑

### 认证安全
- 密码：bcrypt + salt，复杂度要求
- 会话：JWT + HTTP-only Cookie
- OAuth：仅信任已验证的Provider
- MFA支持（Phase 2）

### 数据安全
- 所有API强制HTTPS
- SQL注入防护（Drizzle ORM参数化查询）
- XSS防护（React自动转义）
- CSRF Token验证
- Rate Limiting

### 权限控制
- 资源级别权限检查
- 行级数据隔离（多租户）
- 操作审计日志
- 敏感操作二次确认

---

## 开发规范

### Git规范
```
feature/<feature-name>     新功能
fix/<bug-description>     Bug修复
refactor/<module>         重构
docs/<topic>              文档更新
```

### 代码规范
- TypeScript strict模式
- ESLint + Prettier
- 组件使用Server Component优先
- 敏感操作必须类型定义
- 错误处理必须覆盖

### 测试要求
- 单元测试：核心业务逻辑
- 集成测试：API端点
- E2E测试：关键用户流程

---

## 部署架构

### 开发环境
```
本地Docker Compose
├── PostgreSQL
├── Redis
└── Next.js (dev)
```

### 生产环境
```
Vercel / Railway / Self-hosted
├── Next.js (SSR/SSG)
├── PostgreSQL (Neon/Supabase)
├── Redis (Upstash)
└── LangGraph Server (独立部署)
```

---

## 里程碑

| 阶段 | 内容 | 预计周期 |
|------|------|----------|
| P0 | 项目初始化 + 认证系统 | 2周 |
| P1 | 组织架构 + 表单基础 | 2周 |
| P2 | 表单引擎完善 + AI对话 | 3周 |
| P3 | 流程引擎 MVP | 4周 |
| P4 | 智能体搭建 MVP | 5周 |
| P5 | 优化 + 企业增强 | 持续 |

---

*文档版本: v0.1.0*
*最后更新: 2026-04-15*
