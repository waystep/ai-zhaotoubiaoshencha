# 登录模块 UI 设计规范

## 概述

登录模块是用户进入系统的入口，需要提供：
1. 邮箱/密码登录
2. OAuth 社交登录 (GitHub, Google)
3. 忘记密码功能
4. 用户注册入口

## 页面布局

### 桌面端布局 (≥768px)

```
┌─────────────────────────────────────────────────────────┐
│                     顶部导航栏                           │
│  ┌─────┐                                    ┌──────────┐  │
│  │Logo │                                    │ 注册     │  │
│  └─────┘                                    └──────────┘  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────────┐   ┌─────────────────────────┐   │
│  │                    │   │                         │   │
│  │                    │   │    登录卡片 (居中)        │   │
│  │    品牌展示区       │   │    400px 宽度           │   │
│  │    (可选背景图)     │   │                         │   │
│  │                    │   │    - Logo               │   │
│  │                    │   │    - 标题               │   │
│  │                    │   │    - 表单                │   │
│  │                    │   │    - OAuth 按钮          │   │
│  │                    │   │    - 注册链接            │   │
│  │                    │   │                         │   │
│  └────────────────────┘   └─────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 移动端布局 (<768px)

```
┌─────────────────────┐
│  Logo        注册    │
├─────────────────────┤
│                     │
│    登录卡片         │
│    全宽 - padding   │
│                     │
│    Logo             │
│    标题             │
│    表单             │
│    OAuth 按钮        │
│    注册链接          │
│                     │
└─────────────────────┘
```

## 组件规范

### 1. Logo 区域
- **图标**: Bot 图标 (lucide-react)
- **颜色**: primary (#3B82F6)
- **尺寸**: 48x48px
- **文字**: "Looma"
- **字体**: Inter Bold, 24px

### 2. 标题区域
- **主标题**: "欢迎回来" / "Welcome back"
- **副标题**: "请输入您的账号信息登录" / "Enter your credentials to sign in"
- **字体**: 
  - 主标题: Inter Semibold, 28px
  - 副标题: Inter Regular, 14px, muted-foreground

### 3. 表单区域

#### 邮箱输入框
- **标签**: "邮箱地址" / "Email"
- **占位符**: "name@example.com"
- **类型**: email
- **验证**: 必填，邮箱格式
- **状态**: default, focus, error, disabled
- **图标**: Mail (左侧)

#### 密码输入框
- **标签**: "密码" / "Password"
- **占位符**: "••••••••"
- **类型**: password
- **验证**: 必填，最少 8 字符
- **状态**: default, focus, error, disabled
- **图标**: Lock (左侧)
- **附加**: 显示/隐藏切换按钮 (右侧)

#### 记住登录
- **类型**: Checkbox
- **标签**: "记住我" / "Remember me"
- **持续时间**: 30 天

#### 忘记密码链接
- **文字**: "忘记密码?" / "Forgot password?"
- **样式**: text-primary, hover:underline
- **链接**: /forgot-password

### 4. 登录按钮
- **文字**: "登录" / "Sign in"
- **加载状态**: "登录中..." / "Signing in..."
- **样式**: w-full, h-10
- **禁用条件**: 表单未填完或正在提交

### 5. 分隔线
- **文字**: "或继续使用" / "Or continue with"
- **样式**: 上边框 + 居中文字 + 背景色

### 6. OAuth 按钮

#### GitHub 登录
- **图标**: GitHub 图标
- **文字**: "使用 GitHub 登录"
- **样式**: variant="outline", w-full

#### Google 登录
- **图标**: Google G 图标
- **文字**: "使用 Google 登录"
- **样式**: variant="outline", w-full

### 7. 注册链接
- **文字**: "还没有账号?" + "立即注册"
- **链接**: /register

## 交互规范

### 表单验证
- **实时验证**: 用户输入时进行基本验证
- **提交验证**: 完整表单验证后提交
- **错误提示**: 输入框下方红色文字说明

### 错误处理
| 场景 | 提示信息 |
|------|----------|
| 邮箱格式错误 | "请输入有效的邮箱地址" |
| 密码为空 | "请输入密码" |
| 登录失败 | "邮箱或密码错误，请重试" |
| 网络错误 | "网络连接失败，请检查网络" |
| 账号未激活 | "账号尚未激活，请查收激活邮件" |

### 加载状态
- 按钮显示 spinner + "登录中..."
- 输入框禁用
- OAuth 按钮显示 loading 状态

### 成功跳转
- 默认跳转: /dashboard
- URL 参数 redirect_uri 优先

## 状态管理

### 表单状态
```typescript
interface LoginFormState {
  email: string;
  password: string;
  rememberMe: boolean;
  isLoading: boolean;
  errors: {
    email?: string;
    password?: string;
    general?: string;
  };
}
```

### 登录状态
```typescript
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}
```

## API 接口

### 邮箱登录
```
POST /api/auth/login
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "password123",
  "rememberMe": true
}

Response (Success - 200):
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "image": "avatar_url"
  },
  "redirectUrl": "/dashboard"
}

Response (Error - 401):
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "邮箱或密码错误"
  }
}
```

### OAuth 登录
```
GET /api/auth/signin/github
→ 重定向到 GitHub 授权页面

GET /api/auth/callback/github
→ 授权成功后重定向到 /dashboard
```

## 安全规范

1. **密码传输**: HTTPS + POST body (非 URL 参数)
2. **密码存储**: bcrypt 加密存储
3. **会话管理**: JWT + HTTP-only Cookie
4. **CSRF 保护**: NextAuth.js 内置
5. **Rate Limiting**: 5分钟内最多 5 次登录尝试

## 可访问性 (A11y)

1. 所有输入框有对应的 label
2. 错误状态有 aria-describedby 关联
3. 键盘可完全操作
4. 焦点状态清晰可见
5. 颜色对比度符合 WCAG AA 标准
6. 表单提交有明确的 loading 反馈

## 设计文件

### Pencil 设计文件
- 文件路径: `designs/login/login-module.pen`
- 包含:
  - 桌面端登录页面
  - 移动端登录页面
  - 组件状态变体
  - 错误状态展示

### 相关页面
- `/login` - 登录页
- `/register` - 注册页
- `/forgot-password` - 忘记密码页
- `/dashboard` - 登录后跳转页

---

*最后更新: 2026-04-16*
