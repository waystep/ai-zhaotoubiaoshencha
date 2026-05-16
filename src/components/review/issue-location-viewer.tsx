"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface IssueLocation {
  pageNumber: number;
  blockIndex: number;
  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  textSnippet?: string;
  highlightText?: string;
}

interface ReviewIssue {
  id: string;
  category: string;
  severity: "critical" | "major" | "minor" | "suggestion";
  title: string;
  description: string;
  location: IssueLocation;
  suggestion?: string | null | undefined;
  isResolved: boolean;
}

interface IssueLocationViewerProps {
  issues: ReviewIssue[];
  currentPage?: number;
  onIssueClick?: (issue: ReviewIssue) => void;
  onIssueHover?: (issue: ReviewIssue | null) => void;
  hoveredIssueId?: string;
  issueNoById?: Record<string, number>;
}

const severityColors = {
  critical: "bg-red-100 text-red-700 border-red-200",
  major: "bg-orange-100 text-orange-700 border-orange-200",
  minor: "bg-yellow-100 text-yellow-700 border-yellow-200",
  suggestion: "bg-blue-100 text-blue-700 border-blue-200",
};

const severityLabels = {
  critical: "严重",
  major: "重要",
  minor: "轻微",
  suggestion: "建议",
};

export function IssueLocationViewer({
  issues,
  currentPage,
  onIssueClick,
  onIssueHover,
  hoveredIssueId,
  issueNoById,
}: IssueLocationViewerProps) {
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<"follow" | "all">("all");
  const [severity, setSeverity] = useState<"all" | ReviewIssue["severity"]>("all");
  const [resolved, setResolved] = useState<"all" | "resolved" | "unresolved">("all");
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  function toggleIssue(issueId: string) {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  }

  const filteredIssues = useMemo(() => {
    let list = issues;
    if (scope === "follow" && currentPage) {
      list = list.filter((i) => i.location.pageNumber === currentPage);
    }
    if (severity !== "all") {
      list = list.filter((i) => i.severity === severity);
    }
    if (resolved !== "all") {
      const wantResolved = resolved === "resolved";
      list = list.filter((i) => i.isResolved === wantResolved);
    }
    return list;
  }, [issues, scope, currentPage, severity, resolved]);

  const hoveredIssue = useMemo(() => {
    if (!hoveredIssueId) return null;
    return issues.find((i) => i.id === hoveredIssueId) ?? null;
  }, [hoveredIssueId, issues]);

  const hoveredVisible = useMemo(() => {
    if (!hoveredIssueId) return false;
    return filteredIssues.some((i) => i.id === hoveredIssueId);
  }, [hoveredIssueId, filteredIssues]);

  // hover 仅用于联动/高亮，不自动展开（避免打断阅读）

  function revealIssueInList(issueId: string) {
    // if current filters exclude it, switch to all first
    if (!filteredIssues.some((i) => i.id === issueId)) {
      setScope("all");
      setSeverity("all");
      setResolved("all");
      requestAnimationFrame(() => revealIssueInList(issueId));
      return;
    }

    setExpandedIssues((prev) => {
      const next = new Set(prev);
      next.add(issueId);
      return next;
    });

    requestAnimationFrame(() => {
      const el = itemRefs.current.get(issueId);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  // 按严重程度分组
  const groupedIssues = useMemo(() => {
    return {
      critical: filteredIssues.filter((i) => i.severity === "critical"),
      major: filteredIssues.filter((i) => i.severity === "major"),
      minor: filteredIssues.filter((i) => i.severity === "minor"),
      suggestion: filteredIssues.filter((i) => i.severity === "suggestion"),
    };
  }, [filteredIssues]);

  return (
    <div className="space-y-3">
      {/* 问题统计与筛选 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-red-700">
            <span className="font-semibold">{groupedIssues.critical.length}</span>
            <span className="ml-1">严重</span>
          </span>
          <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-orange-700">
            <span className="font-semibold">{groupedIssues.major.length}</span>
            <span className="ml-1">重要</span>
          </span>
          <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-yellow-700">
            <span className="font-semibold">{groupedIssues.minor.length}</span>
            <span className="ml-1">轻微</span>
          </span>
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-blue-700">
            <span className="font-semibold">{groupedIssues.suggestion.length}</span>
            <span className="ml-1">建议</span>
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "follow" | "all")}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="范围"
          >
            <option value="follow">当前页</option>
            <option value="all">全部</option>
          </select>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as typeof severity)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="严重程度"
          >
            <option value="all">全部</option>
            <option value="critical">严重</option>
            <option value="major">重要</option>
            <option value="minor">轻微</option>
            <option value="suggestion">建议</option>
          </select>
          <select
            value={resolved}
            onChange={(e) => setResolved(e.target.value as typeof resolved)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="处理状态"
          >
            <option value="all">全部</option>
            <option value="unresolved">待处理</option>
            <option value="resolved">已解决</option>
          </select>
        </div>
      </div>

      {/* 问题列表 */}
      {hoveredIssue && !hoveredVisible && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2 text-xs">
          <div className="min-w-0 text-muted-foreground">
            <span className="font-medium text-foreground">
              #{issueNoById?.[hoveredIssue.id] ?? "-"} {hoveredIssue.title}
            </span>{" "}
            · 第 {hoveredIssue.location.pageNumber} 页
          </div>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => revealIssueInList(hoveredIssue.id)}>
            在列表中定位
          </Button>
        </div>
      )}
      {filteredIssues.length === 0 ? (
        <p className="text-muted-foreground text-center py-3 text-sm">
          {scope === "follow" && currentPage ? "当前页未发现问题" : "暂无数据"}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredIssues.map((issue) => (
            <div
              key={issue.id}
              ref={(el) => {
                if (!el) {
                  itemRefs.current.delete(issue.id);
                  return;
                }
                itemRefs.current.set(issue.id, el);
              }}
              className={`rounded-lg border cursor-pointer transition-all ${
               hoveredIssueId === issue.id
                    ? "border-primary/60 ring-2 ring-primary/10"
                    : "border-transparent hover:border-gray-200"
              } ${severityColors[issue.severity]}`}
              onClick={() => onIssueClick?.(issue)}
              onMouseEnter={() => onIssueHover?.(issue)}
              onMouseLeave={() => onIssueHover?.(null)}
            >
              <div
                className="p-2"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleIssue(issue.id);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-background px-1 text-xs font-semibold tabular-nums shrink-0">
                      {issueNoById?.[issue.id] ?? ""}
                    </span>
                    <Badge className={`${severityColors[issue.severity]} text-xs px-2 py-0.5`}>
                      {severityLabels[issue.severity]}
                    </Badge>
                    <span className="font-medium text-sm truncate">{issue.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      P{issue.location.pageNumber}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5 text-xs gap-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        onIssueClick?.(issue);
                      }}
                      title="定位到 PDF"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    {expandedIssues.has(issue.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>

                {expandedIssues.has(issue.id) && (
                  <div className="mt-2 space-y-1.5 text-sm">
                    <p>{issue.description}</p>

                    {issue.location.textSnippet && (
                      <div className="bg-white/50 p-1.5 rounded font-mono text-xs">
                        「{issue.location.textSnippet}」
                        {issue.location.highlightText && (
                          <mark className="bg-yellow-300 px-0.5 rounded ml-0.5">
                            {issue.location.highlightText}
                          </mark>
                        )}
                      </div>
                    )}

                    {issue.suggestion && (
                      <p className="text-muted-foreground">
                        <span className="font-medium">建议：</span>
                        {issue.suggestion}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {issue.category}
                      </Badge>
                      <Badge
                        variant={issue.isResolved ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {issue.isResolved ? "已解决" : "待处理"}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}