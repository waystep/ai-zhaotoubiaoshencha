"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { RiskInsights } from "@/lib/services/dashboard-service";

interface RiskInsightsPanelProps {
  data: RiskInsights | null;
  loading: boolean;
}

const severityColors: Record<string, string> = {
  critical: "border-red-300 text-red-700 bg-red-50",
  major: "border-orange-300 text-orange-700 bg-orange-50",
  minor: "border-yellow-300 text-yellow-700 bg-yellow-50",
  suggestion: "border-blue-300 text-blue-700 bg-blue-50",
};

const severityLabels: Record<string, string> = {
  critical: "严重",
  major: "重要",
  minor: "轻微",
  suggestion: "建议",
};

const categoryLabels: Record<string, string> = {
  qualification: "资质",
  experience: "业绩",
  compliance: "合规",
  technical: "技术",
  format: "格式",
  bid_rejection: "废标",
  legal: "法律",
};

export function RiskInsightsPanel({ data, loading }: RiskInsightsPanelProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            风险洞察
          </CardTitle>
          <CardDescription>风险问题分布与高危项目</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          风险洞察
        </CardTitle>
        <CardDescription>风险问题分布与高危项目</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Severity distribution */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">严重程度分布</h4>
          <div className="flex flex-wrap gap-2">
            {data?.bySeverity.map((item) => (
              <Badge
                key={item.severity}
                variant="outline"
                className={severityColors[item.severity] ?? ""}
              >
                {severityLabels[item.severity] ?? item.severity} {item.count}
              </Badge>
            )) || <span className="text-xs text-muted-foreground">暂无数据</span>}
          </div>
        </div>

        {/* Category breakdown */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">问题类别</h4>
          {data?.byCategory.length ? (
            <div className="space-y-1.5">
              {data.byCategory.map((item) => (
                <div key={item.category} className="flex items-center justify-between">
                  <span className="text-sm">
                    {categoryLabels[item.category] ?? item.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-400 rounded-full"
                        style={{
                          width: `${Math.min((item.count / (data.byCategory[0]?.count || 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">暂无数据</span>
          )}
        </div>

        {/* High-risk projects */}
        {data?.highRiskProjects.length ? (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">高危项目</h4>
            <div className="space-y-1.5">
              {data.highRiskProjects.map((proj) => (
                <Link
                  key={proj.projectId}
                  href={`/projects/${proj.projectId}`}
                  className="flex items-center justify-between text-sm hover:underline"
                >
                  <span className="truncate max-w-[160px]">{proj.name}</span>
                  <Badge variant="destructive" className="text-xs">{proj.criticalCount} 严重</Badge>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
