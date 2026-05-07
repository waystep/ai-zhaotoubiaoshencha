"use client";

import { useState, useEffect } from "react";
import { ClipboardCheck, Loader2, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface Report {
  id: string;
  status: string;
  aiScore: string | null;
  createdAt: string;
  document: {
    id: string;
    name: string;
    docType: string;
  };
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    try {
      const response = await fetch("/api/reports");
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports);
      }
    } catch (error) {
      console.error("获取报告列表失败:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "in_progress":
        return <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "已完成";
      case "in_progress":
        return "审查中";
      default:
        return "待审查";
    }
  };

  const getDocTypeLabel = (docType: string) => {
    switch (docType) {
      case "tender_doc":
        return "招标文件";
      case "legal_doc":
        return "法律文件";
      case "bid_doc":
        return "投标文件";
      default:
        return docType;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">审查报告</h2>
          <p className="text-muted-foreground">
            查看所有审查报告和问题清单
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无审查报告</h3>
            <p className="text-muted-foreground text-center mb-4">
              请先创建项目并上传文档，然后发起审查任务
            </p>
            <Link href="/projects">
              <Card className="hover:border-primary transition-colors">
                <CardContent className="p-4">
                  查看项目列表
                </CardContent>
              </Card>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`}>
              <Card className="hover:border-primary transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-4">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">
                        {report.document.name}
                      </CardTitle>
                      <CardDescription>
                        {getDocTypeLabel(report.document.docType)} ·
                        {new Date(report.createdAt).toLocaleDateString("zh-CN")}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {report.aiScore && (
                      <div className="text-lg font-semibold text-primary">
                        {report.aiScore}分
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {getStatusIcon(report.status)}
                      <span className="text-sm text-muted-foreground">
                        {getStatusLabel(report.status)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}