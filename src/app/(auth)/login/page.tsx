"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  ClipboardCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Smartphone,
  MessageSquare,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormErrors {
  account?: string;
  password?: string;
  phone?: string;
  code?: string;
  email?: string;
  general?: string;
}

interface SSOProvider {
  id: string;
  name: string;
  protocol: string;
  organizationId: string | null;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validatePhone(phone: string): string | undefined {
  if (!phone) return "请输入手机号";
  if (!/^1[3-9]\d{9}$/.test(phone)) return "请输入有效的11位手机号";
  return undefined;
}

function validateCode(code: string): string | undefined {
  if (!code) return "请输入验证码";
  if (!/^\d{4,6}$/.test(code)) return "验证码格式不正确";
  return undefined;
}

function validateAccount(account: string): string | undefined {
  if (!account) return "请输入手机号/账号/邮箱";
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return "请输入密码";
  if (password.length < 8) return "密码至少需要8个字符";
  return undefined;
}

function validateEmail(email: string): string | undefined {
  if (!email) return "请输入邮箱地址";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "请输入有效的邮箱地址";
  return undefined;
}

// ---------------------------------------------------------------------------
// Brand section (left panel on desktop)
// ---------------------------------------------------------------------------

function BrandSection() {
  return (
    <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center lg:bg-gradient-to-br lg:from-primary/80 lg:to-primary lg:px-12">
      <div className="max-w-lg space-y-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-[28px] font-bold text-white">
            智能投标预审智能体
          </span>
        </div>

        <h1 className="text-[48px] font-bold text-white leading-tight">
          智能审查招标文件
        </h1>

        <p className="text-lg text-white/90">
          AI驱动的招标文件智能审查与分析平台
        </p>

        <div className="flex items-center justify-center gap-3 pt-4">
          <span className="px-4 py-1.5 rounded-full bg-white/20 text-sm text-white">
            智能解析
          </span>
          <span className="px-4 py-1.5 rounded-full bg-white/20 text-sm text-white">
            合规审查
          </span>
          <span className="px-4 py-1.5 rounded-full bg-white/20 text-sm text-white">
            精准定位
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Third-party login icons
// ---------------------------------------------------------------------------

function FeishuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M3.5 7.5C5.5 3 11 1.5 15 3.5C17.5 4.7 19 7 19.5 9.5C20 12 19 14.5 17 16L21 20H12C7 20 1.5 12 3.5 7.5Z"
        fill="#3370FF"
      />
      <path
        d="M7 8.5L10 12H4L7 8.5Z"
        fill="white"
      />
    </svg>
  );
}

function WeChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M8.5 7C5.5 7 3 9 3 11.5C3 13 4 14.3 5.5 15.1L5 17L7 15.8C7.5 15.9 8 16 8.5 16C8.7 16 8.8 16 9 16C8.8 15.6 8.7 15.3 8.7 14.9C8.7 12.4 11.1 10.3 14.1 10.3C14.4 10.3 14.6 10.3 14.9 10.4C14.3 8.4 11.6 7 8.5 7ZM6.5 10C6 10 5.5 9.5 5.5 9C5.5 8.5 6 8 6.5 8C7 8 7.5 8.5 7.5 9C7.5 9.5 7 10 6.5 10ZM10.5 10C10 10 9.5 9.5 9.5 9C9.5 8.5 10 8 10.5 8C11 8 11.5 8.5 11.5 9C11.5 9.5 11 10 10.5 10Z"
        fill="#07C160"
      />
      <path
        d="M21 14.9C21 12.7 18.8 11 16.1 11C13.4 11 11.2 12.7 11.2 14.9C11.2 17.1 13.4 18.8 16.1 18.8C16.6 18.8 17.1 18.7 17.5 18.6L19.2 19.6L18.8 18C20.1 17.3 21 16.2 21 14.9ZM14.5 14C14.1 14 13.7 13.6 13.7 13.2C13.7 12.8 14.1 12.4 14.5 12.4C14.9 12.4 15.3 12.8 15.3 13.2C15.3 13.6 14.9 14 14.5 14ZM17.8 14C17.4 14 17 13.6 17 13.2C17 12.8 17.4 12.4 17.8 12.4C18.2 12.4 18.6 12.8 18.6 13.2C18.6 13.6 18.2 14 17.8 14Z"
        fill="#07C160"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main LoginForm component
// ---------------------------------------------------------------------------

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const callbackUrl = searchParams.get("callbackUrl") || "/projects";

  // Active tab
  const [activeTab, setActiveTab] = useState("account");

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<string | null>(null);

  // Account+Password tab state
  const [account, setAccount] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [showAccountPassword, setShowAccountPassword] = useState(false);

  // Phone+SMS tab state
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);

  // Email tab state
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  // Form errors
  const [errors, setErrors] = useState<FormErrors>({});

  // SSO providers
  const [ssoProviders, setSsoProviders] = useState<SSOProvider[]>([]);
  const [selectedSSO, setSelectedSSO] = useState<string>("");
  const [showSSODropdown, setShowSSODropdown] = useState(false);

  // Load SSO providers on mount
  useEffect(() => {
    async function loadSSOProviders() {
      try {
        const res = await fetch("/api/auth/sso/providers");
        if (res.ok) {
          const { data } = await res.json();
          setSsoProviders(data || []);
          if (data?.length > 0) {
            setSelectedSSO(data[0].id);
          }
        }
      } catch {
        // Silently ignore — SSO is optional
      }
    }
    loadSSOProviders();
  }, []);

  // Countdown timer for SMS verification
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Error handler helper
  const handleError = useCallback(
    (title: string, description: string) => {
      toast({ title, description, variant: "destructive" });
    },
    [toast]
  );

  // -------------------------------------------------------------------------
  // Account+Password submit
  // -------------------------------------------------------------------------
  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();

    const accountError = validateAccount(account);
    const passwordError = validatePassword(accountPassword);
    setErrors({ account: accountError, password: passwordError });
    if (accountError || passwordError) return;

    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: account,
        password: accountPassword,
        redirect: false,
      });

      if (result?.error) {
        const msg = result.error.toLowerCase();
        if (msg.includes("credentials") || msg.includes("invalid")) {
          setErrors({ general: "账号或密码错误，请重试" });
          handleError("登录失败", "账号或密码错误，请检查后重试");
        } else if (msg.includes("not verified") || msg.includes("activate")) {
          setErrors({ general: "账号尚未激活，请查收激活邮件" });
          handleError("账号未激活", "请查收您的邮箱，点击激活链接");
        } else {
          setErrors({ general: "登录失败，请稍后重试" });
          handleError("登录失败", "发生了未知错误，请稍后重试");
        }
        return;
      }

      if (result?.ok) {
        toast({ title: "登录成功", description: "正在跳转..." });
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setErrors({ general: "网络连接失败，请检查网络" });
      handleError("网络错误", "网络连接失败，请检查您的网络");
    } finally {
      setIsLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Phone SMS submit
  // -------------------------------------------------------------------------
  async function handleSendSMS() {
    const phoneError = validatePhone(phone);
    if (phoneError) {
      setErrors((prev) => ({ ...prev, phone: phoneError }));
      return;
    }

    setIsSendingCode(true);
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "login" }),
      });

      const data = await res.json();

      if (!res.ok) {
        handleError("发送失败", data.error || "验证码发送失败，请稍后再试");
        return;
      }

      setCountdown(60);
      toast({ title: "验证码已发送", description: "请查收手机短信" });
    } catch {
      handleError("网络错误", "网络连接失败，请检查您的网络");
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();

    const phoneError = validatePhone(phone);
    const codeError = validateCode(smsCode);
    setErrors({ phone: phoneError, code: codeError });
    if (phoneError || codeError) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: smsCode }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        if (data.needsRegistration) {
          handleError("手机号未注册", "该手机号尚未注册，请先注册账号");
        } else {
          handleError("验证失败", data.error || "验证码无效或已过期");
        }
        return;
      }

      // The /api/auth/sms/verify already calls signIn internally,
      // so we just redirect
      toast({ title: "登录成功", description: "正在跳转..." });
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setErrors({ general: "网络连接失败，请检查网络" });
      handleError("网络错误", "网络连接失败，请检查您的网络");
    } finally {
      setIsLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Email+Password submit
  // -------------------------------------------------------------------------
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();

    const emailError = validateEmail(email);
    const passwordError = validatePassword(emailPassword);
    setErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password: emailPassword,
        redirect: false,
      });

      if (result?.error) {
        const msg = result.error.toLowerCase();
        if (msg.includes("credentials") || msg.includes("invalid")) {
          setErrors({ general: "邮箱或密码错误，请重试" });
          handleError("登录失败", "邮箱或密码错误，请检查后重试");
        } else {
          setErrors({ general: "登录失败，请稍后重试" });
          handleError("登录失败", "发生了未知错误，请稍后重试");
        }
        return;
      }

      if (result?.ok) {
        toast({ title: "登录成功", description: "正在跳转..." });
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setErrors({ general: "网络连接失败，请检查网络" });
      handleError("网络错误", "网络连接失败，请检查您的网络");
    } finally {
      setIsLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Third-party login
  // -------------------------------------------------------------------------
  async function handleFeishuLogin() {
    setIsOAuthLoading("feishu");
    try {
      // Build Feishu OAuth URL
      const appId = process.env.NEXT_PUBLIC_FEISHU_APP_ID || "";
      const redirectUri = encodeURIComponent(
        process.env.NEXT_PUBLIC_FEISHU_REDIRECT_URI ||
          `${window.location.origin}/api/auth/sso/feishu-callback`
      );
      const state = encodeURIComponent(callbackUrl);
      const authUrl = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${redirectUri}&state=${state}`;
      window.location.href = authUrl;
    } catch {
      handleError("登录失败", "飞书登录失败，请稍后重试");
      setIsOAuthLoading(null);
    }
  }

  async function handleWeChatLogin() {
    setIsOAuthLoading("wechat");
    try {
      const appId = process.env.NEXT_PUBLIC_WECHAT_APP_ID || "";
      const redirectUri = encodeURIComponent(
        process.env.NEXT_PUBLIC_WECHAT_REDIRECT_URI ||
          `${window.location.origin}/api/auth/sso/wechat-callback`
      );
      const state = encodeURIComponent(callbackUrl);
      const authUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
      window.location.href = authUrl;
    } catch {
      handleError("登录失败", "微信登录失败，请稍后重试");
      setIsOAuthLoading(null);
    }
  }

  async function handleSSOLogin() {
    if (!selectedSSO) {
      handleError("请选择", "请选择一个SSO登录方式");
      return;
    }
    setIsOAuthLoading("sso");
    try {
      const baseUrl = window.location.origin;
      window.location.href = `${baseUrl}/api/auth/sso/${selectedSSO}`;
    } catch {
      handleError("登录失败", "SSO登录失败，请稍后重试");
      setIsOAuthLoading(null);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const hasSSOProviders = ssoProviders.length > 0;

  return (
    <div className="min-h-screen flex">
      <BrandSection />

      <div className="flex-1 flex items-center justify-center bg-background p-4 sm:p-8">
        <div className="w-full max-w-[440px]">
          {/* Mobile header */}
          <div className="hidden sm:flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-foreground">
                智能投标预审智能体
              </span>
            </div>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium text-primary bg-muted rounded-lg hover:bg-muted/70 transition-colors"
            >
              注册
            </Link>
          </div>

          <Card className="shadow-sm">
            {/* Mobile-only brand */}
            <CardHeader className="sm:hidden space-y-1 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-7 w-7 text-primary" />
                  <span className="text-lg font-bold text-foreground">
                    智能投标预审智能体
                  </span>
                </div>
                <Link
                  href="/register"
                  className="text-sm font-medium text-primary"
                >
                  注册
                </Link>
              </div>
            </CardHeader>

            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-semibold">
                欢迎回来
              </CardTitle>
              <CardDescription>请选择登录方式登录您的账号</CardDescription>
            </CardHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="px-6">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="account">账号密码</TabsTrigger>
                  <TabsTrigger value="phone">手机验证码</TabsTrigger>
                  <TabsTrigger value="email">邮箱</TabsTrigger>
                </TabsList>
              </div>

              {/* General error banner */}
              {errors.general && (
                <div className="mx-6 mt-4 bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                  {errors.general}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────── */}
              {/* Tab 1: Account + Password */}
              {/* ────────────────────────────────────────────────────────── */}
              <TabsContent value="account">
                <form onSubmit={handleAccountSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="account">手机号/账号/邮箱</Label>
                      <Input
                        id="account"
                        name="account"
                        type="text"
                        placeholder="请输入手机号、账号或邮箱"
                        value={account}
                        onChange={(e) => {
                          setAccount(e.target.value);
                          if (errors.account)
                            setErrors((prev) => ({ ...prev, account: undefined }));
                        }}
                        disabled={isLoading}
                        className={cn(
                          "h-11",
                          errors.account &&
                            "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {errors.account && (
                        <p className="text-sm text-destructive">
                          {errors.account}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="account-password">密码</Label>
                        <Link
                          href="/forgot-password"
                          className="text-sm text-primary hover:underline"
                        >
                          忘记密码?
                        </Link>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="account-password"
                          name="password"
                          type={showAccountPassword ? "text" : "password"}
                          placeholder="请输入密码"
                          value={accountPassword}
                          onChange={(e) => {
                            setAccountPassword(e.target.value);
                            if (errors.password)
                              setErrors((prev) => ({
                                ...prev,
                                password: undefined,
                              }));
                          }}
                          disabled={isLoading}
                          className={cn(
                            "h-11 pl-10 pr-10",
                            errors.password &&
                              "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowAccountPassword(!showAccountPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          aria-label={
                            showAccountPassword ? "隐藏密码" : "显示密码"
                          }
                        >
                          {showAccountPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-sm text-destructive">
                          {errors.password}
                        </p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col space-y-4">
                    <Button
                      type="submit"
                      className="w-full h-11"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          登录中...
                        </>
                      ) : (
                        "登 录"
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>

              {/* ────────────────────────────────────────────────────────── */}
              {/* Tab 2: Phone + SMS Code */}
              {/* ────────────────────────────────────────────────────────── */}
              <TabsContent value="phone">
                <form onSubmit={handlePhoneSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">手机号</Label>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="请输入手机号"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            if (errors.phone)
                              setErrors((prev) => ({
                                ...prev,
                                phone: undefined,
                              }));
                          }}
                          disabled={isLoading}
                          className={cn(
                            "h-11 pl-10",
                            errors.phone &&
                              "border-destructive focus-visible:ring-destructive"
                          )}
                          maxLength={11}
                        />
                      </div>
                      {errors.phone && (
                        <p className="text-sm text-destructive">
                          {errors.phone}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sms-code">验证码</Label>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="sms-code"
                            name="code"
                            type="text"
                            placeholder="请输入验证码"
                            value={smsCode}
                            onChange={(e) => {
                              setSmsCode(e.target.value);
                              if (errors.code)
                                setErrors((prev) => ({
                                  ...prev,
                                  code: undefined,
                                }));
                            }}
                            disabled={isLoading}
                            className={cn(
                              "h-11 pl-10",
                              errors.code &&
                                "border-destructive focus-visible:ring-destructive"
                            )}
                            maxLength={6}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 shrink-0 px-4"
                          disabled={countdown > 0 || isSendingCode || !phone}
                          onClick={handleSendSMS}
                        >
                          {isSendingCode ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : countdown > 0 ? (
                            `${countdown}s`
                          ) : (
                            "获取验证码"
                          )}
                        </Button>
                      </div>
                      {errors.code && (
                        <p className="text-sm text-destructive">
                          {errors.code}
                        </p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col space-y-4">
                    <Button
                      type="submit"
                      className="w-full h-11"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          登录中...
                        </>
                      ) : (
                        "登 录"
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>

              {/* ────────────────────────────────────────────────────────── */}
              {/* Tab 3: Email + Password */}
              {/* ────────────────────────────────────────────────────────── */}
              <TabsContent value="email">
                <form onSubmit={handleEmailSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">邮箱地址</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          name="email"
                          type="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email)
                              setErrors((prev) => ({
                                ...prev,
                                email: undefined,
                              }));
                          }}
                          disabled={isLoading}
                          className={cn(
                            "h-11 pl-10",
                            errors.email &&
                              "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                      </div>
                      {errors.email && (
                        <p className="text-sm text-destructive">
                          {errors.email}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="email-password">密码</Label>
                        <Link
                          href="/forgot-password"
                          className="text-sm text-primary hover:underline"
                        >
                          忘记密码?
                        </Link>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email-password"
                          name="password"
                          type={showEmailPassword ? "text" : "password"}
                          placeholder="请输入密码"
                          value={emailPassword}
                          onChange={(e) => {
                            setEmailPassword(e.target.value);
                            if (errors.password)
                              setErrors((prev) => ({
                                ...prev,
                                password: undefined,
                              }));
                          }}
                          disabled={isLoading}
                          className={cn(
                            "h-11 pl-10 pr-10",
                            errors.password &&
                              "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowEmailPassword(!showEmailPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          aria-label={
                            showEmailPassword ? "隐藏密码" : "显示密码"
                          }
                        >
                          {showEmailPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-sm text-destructive">
                          {errors.password}
                        </p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col space-y-4">
                    <Button
                      type="submit"
                      className="w-full h-11"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          登录中...
                        </>
                      ) : (
                        "登 录"
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>
            </Tabs>

            {/* ────────────────────────────────────────────────────────── */}
            {/* Third-party login section */}
            {/* ────────────────────────────────────────────────────────── */}
            <div className="px-6 pb-2">
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    第三方登录
                  </span>
                </div>
              </div>
            </div>

            <CardContent className="pt-0">
              <div className="flex items-center justify-center gap-4">
                {/* Feishu */}
                <Button
                  variant="outline"
                  type="button"
                  className="flex-1 h-11"
                  onClick={handleFeishuLogin}
                  disabled={isOAuthLoading !== null}
                >
                  {isOAuthLoading === "feishu" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FeishuIcon className="mr-2 h-4 w-4" />
                  )}
                  飞书
                </Button>

                {/* WeChat */}
                <Button
                  variant="outline"
                  type="button"
                  className="flex-1 h-11"
                  onClick={handleWeChatLogin}
                  disabled={isOAuthLoading !== null}
                >
                  {isOAuthLoading === "wechat" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <WeChatIcon className="mr-2 h-4 w-4" />
                  )}
                  微信
                </Button>

                {/* Enterprise SSO */}
                {hasSSOProviders ? (
                  <div className="relative flex-1">
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full h-11"
                      onClick={() => setShowSSODropdown(!showSSODropdown)}
                      disabled={isOAuthLoading !== null}
                    >
                      {isOAuthLoading === "sso" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Building2 className="mr-2 h-4 w-4" />
                      )}
                      企业SSO
                    </Button>
                    {showSSODropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 overflow-hidden">
                        {ssoProviders.map((provider) => (
                          <button
                            key={provider.id}
                            type="button"
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
                            onClick={() => {
                              setSelectedSSO(provider.id);
                              setShowSSODropdown(false);
                              handleSSOLogin();
                            }}
                          >
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{provider.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {provider.protocol.toUpperCase()}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    type="button"
                    className="flex-1 h-11"
                    disabled={true}
                    title="暂未配置企业SSO"
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    企业SSO
                  </Button>
                )}
              </div>
            </CardContent>

            {/* Register link */}
            <CardFooter className="flex flex-col pt-0">
              <p className="text-center text-sm text-slate-600">
                还没有账号?{" "}
                <Link
                  href="/register"
                  className="font-medium text-primary hover:underline"
                >
                  立即注册
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">智能投标预审智能体</span>
          </div>
          <CardTitle className="text-2xl font-semibold">欢迎回来</CardTitle>
          <CardDescription>请选择登录方式登录您的账号</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 bg-slate-100 animate-pulse rounded-full" />
          <div className="h-11 bg-slate-100 animate-pulse rounded-md" />
          <div className="h-11 bg-slate-100 animate-pulse rounded-md" />
          <div className="h-11 bg-blue-100 animate-pulse rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}
