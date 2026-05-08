"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ClipboardCheck, Mail, Lock, Eye, EyeOff, Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

function validateEmail(email: string): string | undefined {
  if (!email) return "请输入邮箱地址";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "请输入有效的邮箱地址";
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return "请输入密码";
  if (password.length < 8) return "密码至少需要8个字符";
  return undefined;
}

function BrandSection() {
  return (
    <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center lg:bg-gradient-to-br lg:from-primary/80 lg:to-primary lg:px-12">
      <div className="max-w-lg space-y-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-[28px] font-bold text-white">智能招标审查平台</span>
        </div>

        <h1 className="text-[48px] font-bold text-white leading-tight">
          智能审查招标文件
        </h1>

        <p className="text-lg text-white/90">
          AI驱动的招标文件智能审查与分析平台
        </p>

        <div className="flex items-center justify-center gap-3 pt-4">
          <span className="px-4 py-1.5 rounded-full bg-white/20 text-sm text-white">智能解析</span>
          <span className="px-4 py-1.5 rounded-full bg-white/20 text-sm text-white">合规审查</span>
          <span className="px-4 py-1.5 rounded-full bg-white/20 text-sm text-white">精准定位</span>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const callbackUrl = searchParams.get("callbackUrl") || "/projects";

  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });

  const handleEmailBlur = () => {
    setTouched((prev) => ({ ...prev, email: true }));
    setErrors((prev) => ({ ...prev, email: validateEmail(email) }));
  };

  const handlePasswordBlur = () => {
    setTouched((prev) => ({ ...prev, password: true }));
    setErrors((prev) => ({ ...prev, password: validatePassword(password) }));
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (touched.email) {
      setErrors((prev) => ({ ...prev, email: validateEmail(value) }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (touched.password) {
      setErrors((prev) => ({ ...prev, password: validatePassword(value) }));
    }
  };

  const validateForm = (): boolean => {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setErrors({ email: emailError, password: passwordError });
    setTouched({ email: true, password: true });
    return !emailError && !passwordError;
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        rememberMe,
        redirect: false,
      });

      if (result?.error) {
        const errorMessage = result.error.toLowerCase();
        if (errorMessage.includes("credentials") || errorMessage.includes("invalid")) {
          setErrors({ general: "邮箱或密码错误，请重试" });
          toast({
            title: "登录失败",
            description: "邮箱或密码错误，请检查后重试",
            variant: "destructive",
          });
        } else if (errorMessage.includes("not verified") || errorMessage.includes("activate")) {
          setErrors({ general: "账号尚未激活，请查收激活邮件" });
          toast({
            title: "账号未激活",
            description: "请查收您的邮箱，点击激活链接",
            variant: "destructive",
          });
        } else {
          setErrors({ general: "登录失败，请稍后重试" });
          toast({
            title: "登录失败",
            description: "发生了未知错误，请稍后重试",
            variant: "destructive",
          });
        }
        return;
      }

      if (result?.ok) {
        toast({
          title: "登录成功",
          description: "正在跳转...",
        });
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setErrors({ general: "网络连接失败，请检查网络" });
      toast({
        title: "网络错误",
        description: "网络连接失败，请检查您的网络",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOAuthSignIn(provider: string) {
    setIsOAuthLoading(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      toast({
        title: "登录失败",
        description: "社交登录失败，请稍后重试",
        variant: "destructive",
      });
      setIsOAuthLoading(null);
    }
  }

  const isFormValid = email.length > 0 && password.length > 0 && !errors.email && !errors.password;

  return (
    <div className="min-h-screen flex">
      <BrandSection />
      
      <div className="flex-1 flex items-center justify-center bg-background p-4 sm:p-8">
        <div className="w-full max-w-[400px]">
          <div className="hidden sm:flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-foreground">智能招标审查平台</span>
            </div>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium text-primary bg-muted rounded-lg hover:bg-muted/70 transition-colors"
            >
              注册
            </Link>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="sm:hidden space-y-1 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-7 w-7 text-primary" />
                  <span className="text-lg font-bold text-foreground">智能招标审查平台</span>
                </div>
                <Link href="/register" className="text-sm font-medium text-primary">
                  注册
                </Link>
              </div>
            </CardHeader>

            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-semibold">欢迎回来</CardTitle>
              <CardDescription>请输入您的账号信息登录</CardDescription>
            </CardHeader>

            <form onSubmit={onSubmit}>
              <CardContent className="space-y-4">
                {errors.general && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                    {errors.general}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱地址</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={handleEmailChange}
                      onBlur={handleEmailBlur}
                      disabled={isLoading}
                      className={cn(
                        "h-11 pl-10",
                        errors.email && touched.email && "border-destructive focus-visible:ring-destructive"
                      )}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      aria-invalid={errors.email && touched.email ? "true" : "false"}
                    />
                  </div>
                  {errors.email && touched.email && (
                    <p id="email-error" className="text-sm text-destructive">
                      {errors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">密码</Label>
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
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={handlePasswordChange}
                      onBlur={handlePasswordBlur}
                      disabled={isLoading}
                      className={cn(
                        "h-11 pl-10 pr-10",
                        errors.password && touched.password && "border-destructive focus-visible:ring-destructive"
                      )}
                      aria-describedby={errors.password ? "password-error" : undefined}
                      aria-invalid={errors.password && touched.password ? "true" : "false"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && touched.password && (
                    <p id="password-error" className="text-sm text-destructive">
                      {errors.password}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                    className="h-4 w-4 rounded border-input accent-blue-600"
                  />
                  <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer">
                    记住我
                  </Label>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={isLoading || !isFormValid}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    "登录"
                  )}
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-500">
                      或继续使用
                    </span>
                  </div>
                </div>
                <div className="grid gap-3">
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full h-11"
                    onClick={() => handleOAuthSignIn("github")}
                    disabled={isLoading || isOAuthLoading !== null}
                  >
                    {isOAuthLoading === "github" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Github className="mr-2 h-4 w-4" />
                    )}
                    使用 GitHub 登录
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full h-11"
                    onClick={() => handleOAuthSignIn("google")}
                    disabled={isLoading || isOAuthLoading !== null}
                  >
                    {isOAuthLoading === "google" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                    )}
                    使用 Google 登录
                  </Button>
                </div>
                <p className="text-center text-sm text-slate-600">
                  还没有账号?{" "}
                  <Link href="/register" className="font-medium text-primary hover:underline">
                    立即注册
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">智能招标审查平台</span>
          </div>
          <CardTitle className="text-2xl font-semibold">欢迎回来</CardTitle>
          <CardDescription>请输入您的账号信息登录</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-11 bg-slate-100 animate-pulse rounded-md" />
          <div className="h-11 bg-slate-100 animate-pulse rounded-md" />
          <div className="h-11 bg-blue-100 animate-pulse rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}
