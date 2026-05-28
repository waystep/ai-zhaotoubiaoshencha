"use client";

import { KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SSOPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2">SSO 认证</h2>
        <p className="text-muted-foreground">单点登录与身份提供商配置</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            SAML SSO 配置
          </CardTitle>
          <CardDescription>配置企业 SSO 登录，对接 SAML 2.0 身份提供商（功能开发中）</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[200px] flex items-center justify-center text-muted-foreground text-sm">
          敬请期待
        </CardContent>
      </Card>
    </div>
  );
}
