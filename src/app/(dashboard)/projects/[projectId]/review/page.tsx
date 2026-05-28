"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { severityLabel } from "@/lib/ui/labels";

// ==================== Types ====================

interface IssueLocation {
  pageNumber: number;
  blockIndex: number;
  textSnippet?: string;
  highlightText?: string;
  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

interface Issue {
  id: string;
  blockId?: string | null;
  checkpointId?: string | null;
  category: string;
  severity: "critical" | "major" | "minor" | "suggestion";
  title: string;
  description: string;
  location: IssueLocation;
  suggestion?: string | null;
  isResolved: boolean;
}

interface ReviewItemResult {
  id: string;
  reviewItemId: string;
  status: "pass" | "fail" | "needs_manual_review";
  reason: string;
  evidenceBlockIds: string[];
  confidence?: string | null;
  reviewItem: {
    id: string;
    section?: string | null;
    title: string;
    checkpoint?: string | null;
  };
}

interface Report {
  id: string;
  status: string;
  aiScore: string | null;
  summary: string | null;
  recommendation: string | null;
  createdAt: string;
  completedAt: string | null;
  document: {
    id: string;
    name: string;
    docType: string;
    parseStatus: string;
    mimeType: string;
  };
  project: {
    id: string;
    name: string;
    projectNo: string;
  };
  issues: Issue[];
  reviewItemResults: ReviewItemResult[];
  structuredSummary?: {
    responseCoverageSummary: {
      total: number;
      answered: number;
      partiallyAnswered: number;
      unanswered: number;
      notApplicable: number;
    };
    reviewItemsSummary: {
      total: number;
      pass: number;
      fail: number;
      needsManualReview: number;
    };
  };
}

interface ReviewStatus {
  projectId: string;
  reports: Array<{
    id: string;
    documentId: string;
    status: string;
    aiScore: string | null;
    recommendation: string | null;
    summary: string | null;
    createdAt: string;
    completedAt: string | null;
    documentName: string | null;
    documentType: string | null;
    hasSummary: boolean;
  }>;
}

// ==================== Constants ====================

const RISK_CATEGORY_TABS = [
  { key: "all", label: "全部风险" },
  { key: "qualification", label: "资格性风险" },
  { key: "compliance", label: "符合性风险" },
  { key: "technical", label: "技术性风险" },
  { key: "commercial", label: "商务性风险" },
] as const;

const SEVERITY_CONFIG = {
  critical: {
    label: "严重",
    bgClass: "bg-red-100 text-red-700 border-red-200",
    dotClass: "bg-red-500",
    iconClass: "text-red-500",
  },
  major: {
    label: "重要",
    bgClass: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dotClass: "bg-yellow-500",
    iconClass: "text-yellow-500",
  },
  minor: {
    label: "轻微",
    bgClass: "bg-green-100 text-green-700 border-green-200",
    dotClass: "bg-green-500",
    iconClass: "text-green-500",
  },
  suggestion: {
    label: "建议",
    bgClass: "bg-blue-100 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
    iconClass: "text-blue-500",
  },
} as const;

// ==================== Helpers ====================

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function getGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  return "D";
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "text-green-600";
    case "B":
      return "text-blue-600";
    case "C":
      return "text-yellow-600";
    case "D":
      return "text-red-600";
    default:
      return "text-gray-500";
  }
}

function categorizeIssue(issue: Issue): string {
  const cat = (issue.category || "").toLowerCase();
  if (
    cat.includes("资质") ||
    cat.includes("qualif") ||
    cat.includes("资格")
  )
    return "qualification";
  if (
    cat.includes("符合") ||
    cat.includes("compli") ||
    cat.includes("合规")
  )
    return "compliance";
  if (cat.includes("技术") || cat.includes("techni")) return "technical";
  if (
    cat.includes("商务") ||
    cat.includes("commer") ||
    cat.includes("价格") ||
    cat.includes("price")
  )
    return "commercial";
  return "technical";
}

// ==================== Sub-Components ====================

/** SVG circular gauge for risk score */
function ScoreGauge({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80
      ? "#22c55e"
      : score >= 60
        ? "#eab308"
        : score >= 40
          ? "#f97316"
          : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn("text-2xl font-bold", getScoreColor(score))}>
          {Math.round(score)}
        </span>
        <span className="text-xs text-muted-foreground">评分</span>
      </div>
    </div>
  );
}

/** Simple SVG pie chart for risk distribution */
function RiskPieChart({
  distribution,
  size = 100,
}: {
  distribution: Record<string, number>;
  size?: number;
}) {
  const center = size / 2;
  const radius = size / 2 - 4;
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        暂无风险
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    critical: "#ef4444",
    major: "#eab308",
    minor: "#22c55e",
    suggestion: "#3b82f6",
  };

  let currentAngle = 0;
  const slices = Object.entries(distribution)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => {
      const angle = (value / total) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      return { key, value, startAngle, angle, color: colorMap[key] || "#94a3b8" };
    });

  function describeArc(
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number
  ) {
    const start = ((startAngle - 90) * Math.PI) / 180;
    const end = ((endAngle - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size}>
        {slices.map((slice, idx) => (
          <path
            key={idx}
            d={describeArc(center, center, radius, slice.startAngle, slice.startAngle + slice.angle)}
            fill={slice.color}
            stroke="white"
            strokeWidth="1"
          />
        ))}
      </svg>
      <div className="space-y-1">
        {slices.map((slice) => (
          <div key={slice.key} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-muted-foreground">
              {severityLabel(slice.key)}: {slice.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskItemCard({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  const config = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.suggestion;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "rounded-lg border bg-background transition-colors hover:bg-muted/20",
          issue.severity === "critical" && "border-l-4 border-l-red-400",
          issue.severity === "major" && "border-l-4 border-l-yellow-400"
        )}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 p-3 text-left">
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <Badge className={cn("text-xs shrink-0", config.bgClass)}>
              {config.label}
            </Badge>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">{issue.title}</span>
            </div>
            {issue.location?.pageNumber > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <MapPin className="h-3 w-3" />
                P{issue.location.pageNumber}
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t bg-muted/10 space-y-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">问题描述</p>
              <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
            </div>
            {issue.location?.pageNumber > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">位置</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    第{issue.location.pageNumber}页 区块#{issue.location.blockIndex}
                  </Badge>
                  {issue.location.textSnippet && (
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {issue.location.textSnippet}
                    </span>
                  )}
                </div>
              </div>
            )}
            {issue.suggestion && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">修改建议</p>
                <p className="text-sm whitespace-pre-wrap bg-green-50 border border-green-100 rounded p-2">
                  {issue.suggestion}
                </p>
              </div>
            )}
            {issue.isResolved && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="h-3 w-3" />
                已解决
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ==================== Main Page ====================

export default function EnhancedReviewPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { toast } = useToast();

  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [reTriggering, setReTriggering] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Fetch review status (list of reports)
  const fetchReviewStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/review-bid`);
      if (res.ok) {
        const data = await res.json();
        setReviewStatus(data);
        // Auto-select the latest completed report, or the latest report
        const reports = data.reports || [];
        const latestCompleted = reports.find(
          (r: { status: string }) => r.status === "completed"
        );
        const latestReport = latestCompleted || reports[0];
        if (latestReport) {
          await fetchReport(latestReport.id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch review status:", e);
    }
  }, [projectId]);

  // Fetch a specific report
  const fetchReport = useCallback(
    async (reportId: string) => {
      try {
        const res = await fetch(`/api/reports/${reportId}`);
        if (res.ok) {
          const data = await res.json();
          setReport(data.report);
        }
      } catch (e) {
        console.error("Failed to fetch report:", e);
      }
    },
    []
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchReviewStatus();
      setLoading(false);
    })();
  }, [fetchReviewStatus]);

  // Auto-refresh when report is in progress
  useEffect(() => {
    if (!report || report.status !== "in_progress") return;
    const timer = window.setInterval(() => {
      if (report?.id) fetchReport(report.id);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [report?.id, report?.status, fetchReport]);

  // Derived data
  const score = report?.aiScore ? Number(report.aiScore) : null;
  const grade = score !== null ? getGrade(score) : null;

  const issuesByCategory = useMemo(() => {
    if (!report?.issues) return {};
    const groups: Record<string, Issue[]> = {};
    for (const cat of RISK_CATEGORY_TABS) {
      groups[cat.key] = [];
    }
    for (const issue of report.issues) {
      const cat = categorizeIssue(issue);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(issue);
      // Also push to "all"
      if (!groups["all"]) groups["all"] = [];
      groups["all"].push(issue);
    }
    return groups;
  }, [report?.issues]);

  const severityDistribution = useMemo(() => {
    const dist: Record<string, number> = {
      critical: 0,
      major: 0,
      minor: 0,
      suggestion: 0,
    };
    if (report?.issues) {
      for (const issue of report.issues) {
        dist[issue.severity] = (dist[issue.severity] || 0) + 1;
      }
    }
    return dist;
  }, [report?.issues]);

  const reviewSummaryStats = useMemo(() => {
    if (!report?.reviewItemResults) return null;
    const results = report.reviewItemResults;
    return {
      total: results.length,
      pass: results.filter((r) => r.status === "pass").length,
      fail: results.filter((r) => r.status === "fail").length,
      needsReview: results.filter((r) => r.status === "needs_manual_review").length,
    };
  }, [report?.reviewItemResults]);

  // Re-trigger review
  const handleReTrigger = useCallback(async () => {
    if (!report) return;
    setReTriggering(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/review-bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: report.document.id,
          reportId: report.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "审查触发失败");
      }
      toast({ title: "审查已触发", description: "正在重新审查投标文件..." });
      setTimeout(() => fetchReport(report.id), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "触发审查失败";
      toast({ title: "触发失败", description: msg, variant: "destructive" });
    } finally {
      setReTriggering(false);
    }
  }, [report, projectId, toast, fetchReport]);

  // Export handlers (stubs for now - Phase 4)
  const handleExportPDF = useCallback(() => {
    toast({ title: "导出 PDF", description: "PDF 导出功能将在后续版本中实现" });
  }, [toast]);

  const handleExportWord = useCallback(() => {
    toast({ title: "导出 Word", description: "Word 导出功能将在后续版本中实现" });
  }, [toast]);

  const handleExportExcel = useCallback(() => {
    toast({ title: "导出 Excel", description: "Excel 风险清单导出将在后续版本中实现" });
  }, [toast]);

  const handleExportJSON = useCallback(() => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `review-report-${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  // ==================== Render ====================

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasReports = (reviewStatus?.reports?.length ?? 0) > 0;

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${projectId}/reports`}
          className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回审查报告列表
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h2">审查报告</h2>
            <p className="text-muted-foreground">
              投标文件审查结果与风险分析
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {report && (
              <Button
                variant="outline"
                onClick={handleReTrigger}
                disabled={reTriggering || report.status === "in_progress"}
              >
                {reTriggering ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                )}
                重新审查
              </Button>
            )}
            {/* Report selector dropdown */}
            {(reviewStatus?.reports?.length ?? 0) > 1 && (
              <div className="flex gap-1">
                {reviewStatus!.reports.map((r) => (
                  <Button
                    key={r.id}
                    size="sm"
                    variant={report?.id === r.id ? "default" : "outline"}
                    onClick={() => fetchReport(r.id)}
                    className="max-w-[160px]"
                  >
                    <span className="truncate text-xs">{r.documentName || r.id.slice(0, 8)}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* No reports */}
      {!hasReports && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldAlert className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-h5">暂无审查报告</h3>
            <p className="text-muted-foreground text-center mb-4">
              请先创建审查任务，对投标文件进行合规性审查
            </p>
            <Link href={`/projects/${projectId}/reports/new`}>
              <Button>创建审查任务</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Report in progress */}
      {report && report.status === "in_progress" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-yellow-500" />
            <h3 className="mb-2 text-h5">正在审查中</h3>
            <p className="text-muted-foreground text-center">
              AI 正在分析投标文件，请稍后查看结果。页面将自动刷新。
            </p>
          </CardContent>
        </Card>
      )}

      {/* Report failed */}
      {report && report.status === "failed" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="mb-4 h-12 w-12 text-red-500" />
            <h3 className="mb-2 text-h5">审查失败</h3>
            <p className="text-muted-foreground text-center mb-4">
              本次审查过程中出现错误，请尝试重新审查
            </p>
            <Button onClick={handleReTrigger} disabled={reTriggering}>
              重新审查
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Report pending */}
      {report && report.status === "pending" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-h5">等待审查</h3>
            <p className="text-muted-foreground text-center mb-4">
              审查任务已创建，点击"重新审查"开始分析
            </p>
            <Button onClick={handleReTrigger} disabled={reTriggering}>
              {reTriggering ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              开始审查
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Completed report - main content */}
      {report && report.status === "completed" && (
        <>
          {/* Risk Summary Panel */}
          <div className="grid gap-4 md:grid-cols-[auto_1fr_auto]">
            {/* Score Gauge */}
            <Card className="flex items-center justify-center p-4">
              <div className="flex flex-col items-center gap-2">
                <ScoreGauge score={score ?? 0} size={120} />
                <div className="text-center">
                  <div className={cn("text-2xl font-bold", getGradeColor(grade ?? ""))}>
                    等级 {grade ?? "-"}
                  </div>
                </div>
              </div>
            </Card>

            {/* Summary Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">审查摘要</CardTitle>
                <CardDescription>
                  {report.document.name} ({report.project.name})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">风险项</p>
                    <p className="text-lg font-semibold">{report.issues?.length ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">审查项</p>
                    <p className="text-lg font-semibold">
                      {reviewSummaryStats?.total ?? 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50">
                    <p className="text-xs text-muted-foreground">通过</p>
                    <p className="text-lg font-semibold text-green-600">
                      {reviewSummaryStats?.pass ?? 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50">
                    <p className="text-xs text-muted-foreground">不满足</p>
                    <p className="text-lg font-semibold text-red-600">
                      {reviewSummaryStats?.fail ?? 0}
                    </p>
                  </div>
                </div>

                {/* Structured summary from A6 */}
                {report.structuredSummary && (
                  <div className="mt-3 flex items-center gap-3 text-xs flex-wrap">
                    <span className="text-muted-foreground">
                      审查项: 共 {report.structuredSummary.reviewItemsSummary.total}
                    </span>
                    <span className="text-green-600">
                      通过 {report.structuredSummary.reviewItemsSummary.pass}
                    </span>
                    <span className="text-red-600">
                      不满足 {report.structuredSummary.reviewItemsSummary.fail}
                    </span>
                    <span className="text-yellow-600">
                      待复核 {report.structuredSummary.reviewItemsSummary.needsManualReview}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Risk Distribution Pie */}
            <Card className="flex items-center justify-center p-4">
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs font-medium text-muted-foreground">风险分布</p>
                <RiskPieChart distribution={severityDistribution} size={90} />
              </div>
            </Card>
          </div>

          {/* Recommendation badge */}
          {report.recommendation && (
            <div
              className={cn(
                "rounded-lg p-4",
                report.recommendation === "pass" && "bg-green-50 border border-green-200",
                report.recommendation === "fail" && "bg-red-50 border border-red-200",
                report.recommendation === "revise" && "bg-yellow-50 border border-yellow-200"
              )}
            >
              <div className="flex items-center gap-2">
                {report.recommendation === "pass" ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : report.recommendation === "fail" ? (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <TriangleAlert className="h-5 w-5 text-yellow-600" />
                )}
                <span className="font-semibold">
                  建议结论:{" "}
                  {report.recommendation === "pass"
                    ? "通过"
                    : report.recommendation === "fail"
                      ? "不通过"
                      : "整改后通过"}
                </span>
              </div>
              {report.summary && (
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                  {report.summary}
                </p>
              )}
            </div>
          )}

          {/* Risk Items Grouped by Category */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto">
              {RISK_CATEGORY_TABS.map((cat) => {
                const count = issuesByCategory[cat.key]?.length || 0;
                return (
                  <TabsTrigger key={cat.key} value={cat.key} className="gap-1.5">
                    {cat.label}
                    {count > 0 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "ml-1 text-xs px-1.5 py-0",
                          cat.key !== "all" && count > 0 && "border-orange-300 text-orange-700"
                        )}
                      >
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {RISK_CATEGORY_TABS.map((cat) => {
              const catIssues = issuesByCategory[cat.key] || [];
              return (
                <TabsContent key={cat.key} value={cat.key}>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{cat.label}</CardTitle>
                      <CardDescription>
                        共 {catIssues.length} 项风险
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {catIssues.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          该分类下暂无风险项
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {catIssues.map((issue) => (
                            <RiskItemCard key={issue.id} issue={issue} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>

          {/* Review Item Results Summary */}
          {report.reviewItemResults && report.reviewItemResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">审查项结果汇总</CardTitle>
                <CardDescription>
                  按审查项逐条对比结果
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-1">
                  {report.reviewItemResults.map((result) => {
                    const statusConfig: Record<string, { label: string; class: string }> = {
                      pass: { label: "通过", class: "bg-green-100 text-green-700" },
                      fail: { label: "不满足", class: "bg-red-100 text-red-700" },
                      needs_manual_review: {
                        label: "待复核",
                        class: "bg-yellow-100 text-yellow-700",
                      },
                    };
                    const cfg = statusConfig[result.status] || statusConfig.needs_manual_review;
                    return (
                      <div
                        key={result.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/20 text-sm"
                      >
                        <Badge className={cn("text-xs shrink-0", cfg.class)}>
                          {cfg.label}
                        </Badge>
                        <span className="truncate flex-1">{result.reviewItem.title}</span>
                        {result.reviewItem.section && (
                          <Badge variant="outline" className="text-xs shrink-0 border-blue-300 text-blue-700">
                            {result.reviewItem.section}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export Buttons */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 py-4">
              <span className="text-sm font-medium text-muted-foreground mr-2">导出:</span>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportWord}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Word
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                Excel 风险清单
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportJSON}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                JSON
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Report exists but not completed */}
      {report && report.status !== "completed" && report.status !== "in_progress" && report.status !== "failed" && report.status !== "pending" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-h5">未知状态</h3>
            <p className="text-muted-foreground text-center">
              报告状态: {report.status}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
