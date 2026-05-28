"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CallTrendsPanelProps {
  data: Array<{ date: string; calls: number }> | null;
  loading: boolean;
}

export function CallTrendsPanel({ data, loading }: CallTrendsPanelProps) {
  const chartData = (data ?? []).map((d) => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-purple-500" />
          调用趋势
        </CardTitle>
        <CardDescription>近 30 天模型调用趋势</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="calls"
                stroke="#8b5cf6"
                fill="url(#callGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-muted-foreground">暂无调用数据</div>
        )}
      </CardContent>
    </Card>
  );
}
