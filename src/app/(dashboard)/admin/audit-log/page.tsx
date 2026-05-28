"use client";

import { ScrollText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuditLogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2">操作日志</h2>
        <p className="text-muted-foreground">系统操作记录与审计追踪</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            审计日志
          </CardTitle>
          <CardDescription>记录系统中的所有关键操作，支持按用户、时间、类型筛选（功能开发中）</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[200px] flex items-center justify-center text-muted-foreground text-sm">
          敬请期待
        </CardContent>
      </Card>
    </div>
  );
}
