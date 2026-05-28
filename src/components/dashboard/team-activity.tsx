"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import type { TeamActivity } from "@/lib/services/dashboard-service";

interface TeamActivityPanelProps {
  data: TeamActivity | null;
  loading: boolean;
}

export function TeamActivityPanel({ data, loading }: TeamActivityPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4 text-green-500" />
          团队动态
        </CardTitle>
        <CardDescription>最近操作记录</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : data?.recentActions.length ? (
          <div className="space-y-3">
            {data.recentActions.map((action, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {action.userName.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{action.userName}</span>
                    <Badge
                      variant="outline"
                      className={
                        action.action === "调用成功"
                          ? "border-green-300 text-green-700 bg-green-50 text-xs"
                          : "border-red-300 text-red-700 bg-red-50 text-xs"
                      }
                    >
                      {action.action}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{action.detail}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    {new Date(action.createdAt).toLocaleString("zh-CN")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">暂无操作记录</div>
        )}
      </CardContent>
    </Card>
  );
}
