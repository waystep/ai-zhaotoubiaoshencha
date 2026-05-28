"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TenderMetrics } from "@/lib/services/dashboard-service";

interface TenderAnalysisPanelProps {
  data: TenderMetrics | null;
  loading: boolean;
}

export function TenderAnalysisPanel({ data, loading }: TenderAnalysisPanelProps) {
  const sectionData = (data?.bySection ?? []).map((s) => ({
    name: s.section || "未分类",
    count: s.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          招标解析
        </CardTitle>
        <CardDescription>
          提取审查要点 {data?.totalExtractionItems ?? 0} 条
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : (
          <>
            {/* Section distribution */}
            {sectionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={sectionData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-muted-foreground">暂无数据</span>
            )}

            {/* Top projects */}
            {data?.topProjects.length ? (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">审查要点最多的项目</h4>
                <div className="space-y-1.5">
                  {data.topProjects.map((proj) => (
                    <Link
                      key={proj.projectId}
                      href={`/projects/${proj.projectId}`}
                      className="flex items-center justify-between text-sm hover:underline"
                    >
                      <span className="truncate max-w-[160px]">{proj.name}</span>
                      <Badge variant="secondary" className="text-xs tabular-nums">
                        {proj.itemCount} 条
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
