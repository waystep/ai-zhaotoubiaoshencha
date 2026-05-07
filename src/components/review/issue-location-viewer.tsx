"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  selectedIssueId?: string;
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
  selectedIssueId,
}: IssueLocationViewerProps) {
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

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

  // 过滤当前页的问题
  const currentPageIssues = currentPage
    ? issues.filter((i) => i.location.pageNumber === currentPage)
    : issues;

  // 按严重程度分组
  const groupedIssues = {
    critical: currentPageIssues.filter((i) => i.severity === "critical"),
    major: currentPageIssues.filter((i) => i.severity === "major"),
    minor: currentPageIssues.filter((i) => i.severity === "minor"),
    suggestion: currentPageIssues.filter((i) => i.severity === "suggestion"),
  };

  return (
    <div className="space-y-4">
      {/* 问题统计 */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-700">
            {groupedIssues.critical.length}
          </div>
          <div className="text-xs text-red-600">严重问题</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-700">
            {groupedIssues.major.length}
          </div>
          <div className="text-xs text-orange-600">重要问题</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-700">
            {groupedIssues.minor.length}
          </div>
          <div className="text-xs text-yellow-600">轻微问题</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">
            {groupedIssues.suggestion.length}
          </div>
          <div className="text-xs text-blue-600">建议项</div>
        </div>
      </div>

      {/* 问题列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            问题定位
            {currentPage && (
              <Badge variant="outline">第 {currentPage} 页</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentPageIssues.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {currentPage
                ? "当前页未发现问题"
                : "暂无审查问题"}
            </p>
          ) : (
            <div className="space-y-3">
              {currentPageIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`rounded-lg border cursor-pointer transition-all ${
                    selectedIssueId === issue.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-gray-200"
                  } ${severityColors[issue.severity]}`}
                  onClick={() => onIssueClick?.(issue)}
                >
                  <div
                    className="p-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleIssue(issue.id);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={severityColors[issue.severity]}>
                          {severityLabels[issue.severity]}
                        </Badge>
                        <span className="font-medium">{issue.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">
                          第 {issue.location.pageNumber} 页
                        </span>
                        {expandedIssues.has(issue.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>

                    {expandedIssues.has(issue.id) && (
                      <div className="mt-3 space-y-2">
                        <p className="text-sm">{issue.description}</p>

                        {issue.location.textSnippet && (
                          <div className="bg-white/50 p-2 rounded text-sm font-mono">
                            "{issue.location.textSnippet}"
                            {issue.location.highlightText && (
                              <mark className="bg-yellow-300 px-1 rounded ml-1">
                                {issue.location.highlightText}
                              </mark>
                            )}
                          </div>
                        )}

                        {issue.suggestion && (
                          <p className="text-sm text-muted-foreground">
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
        </CardContent>
      </Card>
    </div>
  );
}