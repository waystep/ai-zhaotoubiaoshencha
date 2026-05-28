"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Activity,
  Database,
} from "lucide-react";
import type { DashboardOverview, KnowledgeStats, ModelUsage } from "@/lib/services/dashboard-service";

interface StatCardsProps {
  overview: DashboardOverview | null;
  knowledgeStats: KnowledgeStats | null;
  modelUsage: ModelUsage | null;
  loading: boolean;
}

export function StatCards({ overview, knowledgeStats, modelUsage, loading }: StatCardsProps) {
  const cards = [
    {
      title: "项目总数",
      value: loading ? "--" : overview?.projectsCount ?? 0,
      subtitle: "招标审查项目",
      icon: FolderOpen,
      detail: null,
    },
    {
      title: "文档总数",
      value: loading ? "--" : overview?.documents.total ?? 0,
      subtitle: "已上传文档",
      icon: FileText,
      detail: overview ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50 text-xs">
            解析中 {overview.documents.processing}
          </Badge>
          <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 text-xs">
            完成 {overview.documents.completed}
          </Badge>
          <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50 text-xs">
            失败 {overview.documents.failed}
          </Badge>
        </div>
      ) : null,
    },
    {
      title: "审查报告",
      value: loading ? "--" : overview?.reports.total ?? 0,
      subtitle: `平均评分 ${overview?.reports.avgScore != null ? overview.reports.avgScore.toFixed(1) : "--"}`,
      icon: ClipboardCheck,
      detail: overview ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50 text-xs">
            进行中 {overview.reports.in_progress}
          </Badge>
          <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 text-xs">
            完成 {overview.reports.completed}
          </Badge>
        </div>
      ) : null,
    },
    {
      title: "风险问题",
      value: loading ? "--" : overview?.issues.total ?? 0,
      subtitle: `已解决 ${overview?.issues.resolved ?? 0}`,
      icon: AlertTriangle,
      detail: overview ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50 text-xs">
            严重 {overview.issues.critical}
          </Badge>
          <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50 text-xs">
            重要 {overview.issues.major}
          </Badge>
          <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50 text-xs">
            轻微 {overview.issues.minor}
          </Badge>
        </div>
      ) : null,
    },
    {
      title: "知识库",
      value: loading ? "--" : knowledgeStats?.totalItems ?? 0,
      subtitle: `${knowledgeStats?.totalBases ?? 0} 个库，${knowledgeStats?.vectorizedItems ?? 0} 已向量化`,
      icon: Database,
      detail: null,
    },
    {
      title: "模型调用",
      value: loading ? "--" : modelUsage?.totalCalls ?? 0,
      subtitle: `成功率 ${modelUsage?.successRate ?? 0}%`,
      icon: Activity,
      detail: null,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">{card.title}</CardTitle>
            <card.icon className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-stat text-2xl">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            {card.detail}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
