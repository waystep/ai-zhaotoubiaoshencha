# 智能招标审查平台 API 概览文档

## 1. API 设计原则

### 1.1 RESTful 设计

| 原则 | 说明 |
|------|------|
| **资源导向** | URL 表示资源，如 `/api/projects` |
| **HTTP 方法** | GET/POST/PUT/DELETE 表示操作 |
| **状态码** | 正确使用 HTTP 状态码 |
| **JSON 格式** | 请求/响应使用 JSON |

### 1.2 URL 结构

```
/api/[module]/[resource]/[action]

示例：
- /api/projects              # 项目模块
- /api/projects/[id]         # 项目资源
- /api/documents/[id]/parse  # 文档解析操作
```

---

## 2. 认证机制

### 2.1 认证方式

使用 NextAuth v5 JWT 认证：

```typescript
// API 中获取会话
import { auth } from '@/lib/auth/config';

const session = await auth();
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// session 包含
{
  user: {
    id: string,
    email: string,
    name: string,
    role: string,
    orgId: string
  }
}
```

### 2.2 权限验证

```typescript
// 验证组织权限
const membership = await db.query.organizationMembers.findFirst({
  where: and(
    eq(organizationMembers.userId, session.user.id),
    eq(organizationMembers.orgId, targetOrgId)
  ),
});

if (!membership) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## 3. 路由结构总览

### 3.1 API 端点汇总

| 模块 | 端点 | 方法 |
|------|------|------|
| **认证** | `/api/auth/[...nextauth]` | GET/POST |
| | `/api/auth/register` | POST |
| | `/api/auth/forgot-password` | POST |
| | `/api/auth/reset-password` | POST |
| **项目** | `/api/projects` | GET/POST |
| | `/api/projects/[projectId]` | GET/PUT/DELETE |
| | `/api/projects/[projectId]/documents` | GET/POST |
| | `/api/projects/[projectId]/reports` | GET/POST |
| **文档** | `/api/documents` | GET |
| | `/api/documents/[documentId]` | GET/DELETE |
| | `/api/documents/[documentId]/parse` | GET/POST |
| | `/api/documents/[documentId]/extract` | GET/POST |
| | `/api/documents/[documentId]/blocks` | GET |
| | `/api/documents/[documentId]/file` | GET |
| **报告** | `/api/reports` | GET |
| | `/api/reports/[reportId]` | GET/DELETE |
| | `/api/reports/[reportId]/issues` | GET/POST/PUT |
| **AI** | `/api/chat` | GET/POST |
| | `/api/ai/review` | POST |
| | `/api/mastra/review` | POST |
| | `/api/mastra/stream` | POST |
| **统计** | `/api/analytics/overview` | GET |
| | `/api/analytics/top` | GET |
| | `/api/analytics/trends` | GET |
| **其他** | `/api/upload` | POST |
| | `/api/mineru/health` | GET |
| | `/api/cron/check-documents` | GET |

---

## 4. 请求/响应格式

### 4.1 请求格式

**JSON Body**：
```json
{
  "name": "项目名称",
  "projectNo": "PRJ-001",
  "description": "项目描述"
}
```

**Query Parameters**：
```
/api/documents?page=1&pageSize=20&docType=tender_doc
```

**Path Parameters**：
```
/api/projects/[projectId]/documents
```

### 4.2 响应格式

**成功响应 - 单个资源**：
```json
{
  "id": "uuid",
  "name": "名称",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**成功响应 - 资源列表**：
```json
{
  "data": [...],
  "total": 100,
  "page": 1
}
```

**错误响应**：
```json
{
  "error": "错误信息",
  "code": "ERROR_CODE",
  "status": 400
}
```

---

## 5. 错误处理

### 5.1 HTTP 状态码

| 状态码 | 说明 | 使用场景 |
|--------|------|---------|
| 200 | 成功 | GET/PUT 成功 |
| 201 | 创建成功 | POST 创建成功 |
| 400 | 请求错误 | 参数验证失败 |
| 401 | 未认证 | 未登录 |
| 403 | 无权限 | 权限不足 |
| 404 | 未找到 | 资源不存在 |
| 500 | 服务器错误 | 内部错误 |

### 5.2 错误代码

| 代码 | 说明 |
|------|------|
| `VALIDATION_ERROR` | 参数验证失败 |
| `UNAUTHORIZED` | 未认证 |
| `FORBIDDEN` | 无权限 |
| `NOT_FOUND` | 资源不存在 |
| `PARSE_ERROR` | 文档解析错误 |
| `AI_ERROR` | AI 处理错误 |
| `DATABASE_ERROR` | 数据库错误 |

---

## 6. 流式响应

### 6.1 AI Chat 流式

```typescript
// POST /api/chat
// 响应: SSE 流
Content-Type: text/event-stream

data: {"type":"text","content":"正在分析..."}
data: {"type":"text","content":"文档内容..."}
data: {"type":"done","message":"分析完成"}
```

### 6.2 Mastra 流式

```typescript
// POST /api/mastra/stream
// 响应: SSE 流
data: {"agent":"content-review","status":"processing"}
data: {"agent":"content-review","result":{...}}
data: {"type":"complete","report":{...}}
```

---

## 7. 文件上传

### 7.1 上传端点

```
POST /api/upload

Content-Type: multipart/form-data

Body:
- file: 文件 (PDF/Word/Excel/PPT)
- projectId: 项目ID
- docType: 文档类型
```

### 7.2 文件限制

| 类型 | 说明 |
|------|------|
| **格式** | PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX |
| **大小** | 最大 100MB |
| **命名** | 保留原始文件名 |

---

## 8. 分页与过滤

### 8.1 分页参数

```
?page=1&pageSize=20

响应:
{
  "data": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5
}
```

### 8.2 过滤参数

```
/api/documents?docType=tender_doc&parseStatus=completed
/api/reports?status=completed&severity=critical
```

---

## 9. API 版本管理

当前未使用版本号，未来如有重大变更可：

- 通过 URL: `/api/v2/projects`
- 通过 Header: `Accept: application/vnd.api.v2+json`

---

## 10. API 测试

### 10.1 测试工具

- **curl**: 命令行测试
- **Postman**: API 测试工具
- **Thunder Client**: VS Code 插件

### 10.2 测试示例

```bash
# 获取项目列表
curl -H "Cookie: authjs.session-token=xxx" \
  http://localhost:3000/api/projects

# 创建项目
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=xxx" \
  -d '{"name":"测试项目","projectNo":"PRJ-001"}' \
  http://localhost:3000/api/projects

# 上传文档
curl -X POST \
  -H "Cookie: authjs.session-token=xxx" \
  -F "file=@document.pdf" \
  -F "projectId=xxx" \
  -F "docType=tender_doc" \
  http://localhost:3000/api/upload
```

---

## 11. 各模块 API 详细文档

详细 API 文档见：

| 模块 | 文档位置 |
|------|---------|
| 认证 | `docs/api/认证API.md` |
| 项目 | `docs/api/项目API.md` |
| 文档 | `docs/api/文档API.md` |
| 报告 | `docs/api/报告API.md` |
| AI | `docs/api/AI接口.md` |
| 统计 | `docs/api/统计API.md` |