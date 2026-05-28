"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FolderOpen, Plus, RefreshCw } from "lucide-react";
import { StatCards } from "@/components/dashboard/stat-cards";
import { TenderAnalysisPanel } from "@/components/dashboard/tender-analysis";
import { RiskInsightsPanel } from "@/components/dashboard/risk-insights";
import { ModelUsagePanel } from "@/components/dashboard/model-usage";
import { CallTrendsPanel } from "@/components/dashboard/call-trends";
import { TeamActivityPanel } from "@/components/dashboard/team-activity";
import { KnowledgeStatsPanel } from "@/components/dashboard/knowledge-stats";
import type {
  DashboardOverview,
  TenderMetrics,
  RiskInsights,
  ModelUsage,
  TeamActivity,
  KnowledgeStats,
} from "@/lib/services/dashboard-service";

interface DashboardData {
  overview: DashboardOverview;
  tenderMetrics: TenderMetrics;
  riskInsights: RiskInsights;
  modelUsage: ModelUsage;
  teamActivity: TeamActivity;
  knowledgeStats: KnowledgeStats;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/overview", { cache: "no-store" });
      if (!res.ok) throw new Error("请求失败");
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载仪表盘失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h2">控制台</h2>
          <p className="text-muted-foreground">
            智能投标预审平台 · 数据总览
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            刷新
          </Button>
          <Link href="/projects/new">
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              新建项目
            </Button>
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Row 1: Stat cards */}
      <StatCards
        overview={data?.overview ?? null}
        knowledgeStats={data?.knowledgeStats ?? null}
        modelUsage={data?.modelUsage ?? null}
        loading={loading}
      />

      {/* Row 2: Call trends (full width) */}
      <CallTrendsPanel
        data={data?.modelUsage?.byDay ?? null}
        loading={loading}
      />

      {/* Row 3: 3-column layout */}
      <div className="grid gap-4 lg:grid-cols-3">
        <TenderAnalysisPanel
          data={data?.tenderMetrics ?? null}
          loading={loading}
        />
        <RiskInsightsPanel
          data={data?.riskInsights ?? null}
          loading={loading}
        />
        <ModelUsagePanel
          data={data?.modelUsage ?? null}
          loading={loading}
        />
      </div>

      {/* Row 4: 2-column layout */}
      <div className="grid gap-4 lg:grid-cols-2">
        <KnowledgeStatsPanel
          data={data?.knowledgeStats ?? null}
          loading={loading}
        />
        <TeamActivityPanel
          data={data?.teamActivity ?? null}
          loading={loading}
        />
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Link href="/projects">
          <Button variant="outline" size="sm">
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            项目列表
          </Button>
        </Link>
        <Link href="/analytics">
          <Button variant="outline" size="sm">
            详细统计
          </Button>
        </Link>
        <Link href="/admin/models">
          <Button variant="outline" size="sm">
            模型管理
          </Button>
        </Link>
      </div>
    </div>
  );
}
