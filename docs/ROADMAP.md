# Looma 执行计划

## 当前状态

### ✅ 已完成
- [x] 项目脚手架 (Next.js 15 + App Router + TypeScript)
- [x] Drizzle ORM 配置和数据库 Schema
- [x] NextAuth.js v5 认证配置
- [x] shadcn/ui 组件库初始化
- [x] Tailwind CSS 配置
- [x] 基础类型定义
- [x] 主页、登录页、注册页 UI
- [x] 仪表板布局
- [x] 基本 API 路由

### 🔧 待配置
- [ ] 数据库连接和迁移
- [ ] 环境变量配置
- [ ] OAuth Provider 配置

---

## 详细执行计划

### Phase 1: 核心框架完善 (当前阶段)

#### 1.1 数据库和迁移
- [ ] 配置本地 PostgreSQL 数据库
- [ ] 运行数据库迁移: `npm run db:push`
- [ ] 创建数据库种子数据: `npm run db:seed`
- [ ] 验证数据库连接

#### 1.2 认证系统完善
- [ ] 完善注册 API 错误处理
- [ ] 添加邮箱验证功能
- [ ] 配置 OAuth Provider (GitHub/Google)
- [ ] 实现会话管理和 token 刷新
- [ ] 添加密码重置功能

#### 1.3 基础 UI 组件
- [ ] 安装更多 shadcn 组件
  - [ ] form (表单组件)
  - [ ] select
  - [ ] textarea
  - [ ] checkbox
  - [ ] dialog
  - [ ] table
  - [ ] tabs
  - [ ] badge
  - [ ] tooltip
- [ ] 创建应用级 UI 组件
  - [ ] Header/Navigation
  - [ ] Sidebar
  - [ ] DataTable
  - [ ] EmptyState
  - [ ] LoadingSpinner

#### 1.4 路由和权限
- [ ] 创建中间件进行路由保护
- [ ] 实现基于角色的权限控制
- [ ] 添加 API 权限中间件

**预计时间: 1-2 周**

---

### Phase 2: 组织架构模块

#### 2.1 组织管理
- [ ] 创建组织详情页面
- [ ] 实现组织设置编辑
- [ ] 添加组织 Logo 上传

#### 2.2 成员管理
- [ ] 成员列表页面
- [ ] 邀请成员功能
- [ ] 角色分配界面
- [ ] 成员移除功能

#### 2.3 部门管理
- [ ] 部门树形结构展示
- [ ] 部门 CRUD 操作
- [ ] 部门成员分配

#### 2.4 API 实现
- [ ] `/api/organizations` - 组织管理
- [ ] `/api/organizations/:id/members` - 成员管理
- [ ] `/api/departments` - 部门管理
- [ ] 权限验证中间件

**预计时间: 1-2 周**

---

### Phase 3: 表单引擎 MVP

#### 3.1 表单设计器
- [ ] 表单设计器页面
- [ ] 拖拽式字段组件
- [ ] 字段类型:
  - [ ] Text
  - [ ] Textarea
  - [ ] Number
  - [ ] Email
  - [ ] Phone
  - [ ] Date/DateTime
  - [ ] Select/Dropdown
  - [ ] Radio
  - [ ] Checkbox
  - [ ] Switch
  - [ ] File Upload
  - [ ] Rich Text Editor
- [ ] 字段属性面板
- [ ] 表单布局设置
- [ ] 表单预览

#### 3.2 表单渲染器
- [ ] 动态表单渲染组件
- [ ] 表单校验 (Zod)
- [ ] 条件逻辑显示
- [ ] 表单提交处理

#### 3.3 数据管理
- [ ] 表单提交记录列表
- [ ] 提交详情查看
- [ ] 数据导出 (CSV/JSON/Excel)
- [ ] 数据导入

#### 3.4 API 实现
- [ ] `GET /api/forms` - 表单列表
- [ ] `POST /api/forms` - 创建表单
- [ ] `GET /api/forms/:id` - 获取表单
- [ ] `PUT /api/forms/:id` - 更新表单
- [ ] `DELETE /api/forms/:id` - 删除表单
- [ ] `POST /api/forms/:id/submit` - 提交表单
- [ ] `GET /api/forms/:id/submissions` - 提交记录

**预计时间: 3-4 周**

---

### Phase 4: 工作流引擎 MVP

#### 4.1 工作流设计器
- [ ] React Flow 集成
- [ ] 节点类型:
  - [ ] Trigger: Form Submit, Schedule, Webhook, Manual
  - [ ] Action: Notification, HTTP Request, Database, Email, Approval
  - [ ] Logic: Condition, Loop, Parallel, Subworkflow
  - [ ] AI: LLM, Classifier, Extractor
- [ ] 边/连接器配置
- [ ] 工作流验证
- [ ] 版本控制

#### 4.2 工作流运行时
- [ ] 工作流执行引擎
- [ ] 审批节点实现
- [ ] 条件分支路由
- [ ] 错误处理和重试
- [ ] 执行日志

#### 4.3 触发器系统
- [ ] Cron 定时触发
- [ ] Webhook 端点
- [ ] 表单提交触发
- [ ] API 触发

#### 4.4 API 实现
- [ ] `GET /api/workflows` - 工作流列表
- [ ] `POST /api/workflows` - 创建工作流
- [ ] `GET /api/workflows/:id` - 获取工作流
- [ ] `PUT /api/workflows/:id` - 更新工作流
- [ ] `DELETE /api/workflows/:id` - 删除工作流
- [ ] `POST /api/workflows/:id/execute` - 执行工作流
- [ ] `GET /api/workflows/:id/instances` - 流程实例

**预计时间: 4-6 周**

---

### Phase 5: AI 对话基础

#### 5.1 CopilotKit 集成
- [ ] CopilotKit Provider 配置
- [ ] AI 助手界面组件
- [ ] 上下文管理
- [ ] 对话历史

#### 5.2 AG-UI 协议
- [ ] AG-UI 事件处理
- [ ] 流式响应处理
- [ ] 工具调用界面

#### 5.3 基础 AI 功能
- [ ] 自然语言表单生成
- [ ] 智能字段推荐
- [ ] 表单数据分析

**预计时间: 2-3 周**

---

### Phase 6: 智能体系统 MVP

#### 6.1 智能体设计器
- [ ] 节点类型:
  - [ ] LLM 调用
  - [ ] 工具执行
  - [ ] 知识库检索
  - [ ] 记忆系统
  - [ ] 条件判断
- [ ] 可视化编排界面
- [ ] 模板市场

#### 6.2 LangGraph 集成
- [ ] 状态机定义
- [ ] 工具注册系统
- [ ] 多 Agent 协作
- [ ] 人机交互节点

#### 6.3 智能体执行
- [ ] 异步执行引擎
- [ ] 流式输出
- [ ] 执行日志和追踪
- [ ] 错误恢复

#### 6.4 API 实现
- [ ] `GET /api/agents` - 智能体列表
- [ ] `POST /api/agents` - 创建智能体
- [ ] `GET /api/agents/:id` - 获取智能体
- [ ] `PUT /api/agents/:id` - 更新智能体
- [ ] `DELETE /api/agents/:id` - 删除智能体
- [ ] `POST /api/agents/:id/chat` - 与智能体对话
- [ ] `GET /api/agents/:id/executions` - 执行历史

**预计时间: 4-6 周**

---

## 技术债务和优化

### 性能优化
- [ ] 添加 Redis 缓存层
- [ ] 实现数据库查询优化
- [ ] 前端代码分割
- [ ] 图片和资源优化

### 安全加固
- [ ] Rate Limiting 实现
- [ ] CSRF 保护
- [ ] XSS 防护审计
- [ ] 安全 Headers

### 监控和日志
- [ ] 错误追踪 (Sentry)
- [ ] 性能监控
- [ ] 用户行为分析

---

## 测试计划

### 单元测试
- [ ] 业务逻辑函数
- [ ] 表单校验
- [ ] 工作流执行引擎
- [ ] 权限检查

### 集成测试
- [ ] API 端点
- [ ] 数据库操作
- [ ] 认证流程

### E2E 测试
- [ ] 用户注册和登录
- [ ] 表单创建和提交
- [ ] 工作流创建和执行

---

## 部署准备

### 开发环境
- [ ] Docker Compose 配置
- [ ] 开发文档

### 生产环境
- [ ] Vercel/Railway 部署配置
- [ ] PostgreSQL (Neon/Supabase)
- [ ] Redis (Upstash)
- [ ] CI/CD 流程

---

## 里程碑

| 阶段 | 内容 | 预计周期 | 状态 |
|------|------|----------|------|
| P0 | 项目初始化 + 核心框架 | 1-2 周 | ✅ 完成 |
| P1 | 数据库 + 认证完善 | 1-2 周 | 🔄 当前 |
| P2 | 组织架构模块 | 1-2 周 | 📋 待开始 |
| P3 | 表单引擎 MVP | 3-4 周 | 📋 待开始 |
| P4 | 工作流引擎 MVP | 4-6 周 | 📋 待开始 |
| P5 | AI 对话基础 | 2-3 周 | 📋 待开始 |
| P6 | 智能体系统 MVP | 4-6 周 | 📋 待开始 |

---

## 下一步行动

### 立即执行 (本周)
1. 配置本地 PostgreSQL 数据库
2. 运行 `npm run db:push` 同步 Schema
3. 完善认证 API 错误处理
4. 添加更多 shadcn UI 组件
5. 创建中间件保护仪表板路由

### 短期目标 (2-4 周)
1. 完成 Phase 2: 组织架构模块
2. 完成 Phase 3: 表单引擎 MVP
3. 开始 Phase 5: AI 对话集成

### 中期目标 (1-2 月)
1. 完成 Phase 4: 工作流引擎
2. 完成 Phase 6: 智能体系统

---

*最后更新: 2026-04-15*
