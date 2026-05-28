"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database } from "lucide-react";
import type { KnowledgeStats as KnowledgeStatsType } from "@/lib/services/dashboard-service";

interface KnowledgeStatsPanelProps {
  data: KnowledgeStatsType | null;
  loading: boolean;
}

const typeLabels: Record<string, string> = {
  law: "法律法规",
  regulation: "规范性文件",
  standard: "技术标准",
  template: "模板文件",
  manual: "操作手册",
  case: "案例",
};

export function KnowledgeStatsPanel({ data, loading }: KnowledgeStatsPanelProps) {
  const vectorizedPct =
    data && data.totalItems > 0
      ? Math.round((data.vectorizedItems / data.totalItems) * 100)
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-4 w-4 text-teal-500" />
          知识库统计
        </CardTitle>
        <CardDescription>
          {data?.totalBases ?? 0} 个库 · {data?.totalItems ?? 0} 条知识
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : (
          <>
            {/* Vectorization progress */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">向量化进度</span>
                <span className="tabular-nums">{vectorizedPct}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all"
                  style={{ width: `${vectorizedPct}%` }}
                />
              </div>
            </div>

            {/* By type */}
            {data?.byType.length ? (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">按类型</h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.byType.map((item) => (
                    <Badge key={item.type} variant="outline" className="text-xs">
                      {typeLabels[item.type] ?? item.type} {item.count}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <Link
              href="/admin/knowledge"
              className="block text-xs text-muted-foreground hover:underline mt-2"
            >
              管理知识库 →
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
