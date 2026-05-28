"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { ModelUsage as ModelUsageType } from "@/lib/services/dashboard-service";

interface ModelUsagePanelProps {
  data: ModelUsageType | null;
  loading: boolean;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const agentKeyLabels: Record<string, string> = {
  A1: "招标解析",
  A2: "投标生成",
  A3: "投标预审",
  A4: "风险定位",
  A5: "法律解析",
  A6: "报告生成",
  A7: "文档解析",
};

export function ModelUsagePanel({ data, loading }: ModelUsagePanelProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-blue-500" />
            模型使用
          </CardTitle>
          <CardDescription>模型与智能体调用统计</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    );
  }

  const modelChartData = (data?.byModel ?? []).map((m) => ({
    name: m.modelName.length > 8 ? m.modelName.slice(0, 8) + "…" : m.modelName,
    calls: m.calls,
    avgTokens: m.avgTokens,
  }));

  const agentChartData = (data?.byAgent ?? []).map((a) => ({
    name: agentKeyLabels[a.agentKey] ?? a.agentName,
    calls: a.calls,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-blue-500" />
          模型使用
        </CardTitle>
        <CardDescription>
          调用 {data?.totalCalls ?? 0} 次 · 成功率 {data?.successRate ?? 0}%
          {data?.avgDurationMs != null ? ` · 平均 ${data.avgDurationMs}ms` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model calls bar chart */}
        {modelChartData.length > 0 ? (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">按模型</h4>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={modelChartData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="calls" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">暂无调用数据</span>
        )}

        {/* Agent distribution pie */}
        {agentChartData.length > 0 ? (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">按智能体</h4>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={120}>
                <PieChart>
                  <Pie
                    data={agentChartData}
                    dataKey="calls"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={50}
                  >
                    {agentChartData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 text-xs">
                {agentChartData.map((item, idx) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span>{item.name}</span>
                    <Badge variant="secondary" className="text-xs tabular-nums">{item.calls}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
