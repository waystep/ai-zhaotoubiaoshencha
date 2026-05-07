"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FileText, Upload, Loader2, CheckCircle, XCircle, Clock, Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: string;
  name: string;
  docType: string;
  parseStatus: string;
  createdAt: string;
}

export default function ProjectDocumentsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [parsingIds, setParsingIds] = useState<string[]>([]);

  useEffect(() => {
    fetchDocuments();
  }, [projectId]);

  async function fetchDocuments() {
    try {
      const response = await fetch(`/api/projects/${projectId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("获取文档列表失败:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleParse(documentId: string) {
    try {
      const response = await fetch(`/api/documents/${documentId}/parse`, {
        method: "POST",
      });

      if (response.ok) {
        toast({
          title: "解析任务已启动",
          description: "文档正在解析中，请稍后刷新查看结果",
        });
        fetchDocuments();
      } else {
        const error = await response.json();
        toast({
          title: "解析失败",
          description: error.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "网络错误",
        description: "请检查您的网络连接",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(documentId: string, documentName: string) {
    if (!confirm(`确定要删除文档 "${documentName}" 吗？此操作不可撤销。`)) {
      return;
    }

    setDeletingIds(prev => [...prev, documentId]);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "删除成功",
          description: "文档已删除",
        });
        setDocuments(prev => prev.filter(d => d.id !== documentId));
      } else {
        const error = await response.json();
        toast({
          title: "删除失败",
          description: error.error || "删除文档失败",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "网络错误",
        description: "请检查您的网络连接",
        variant: "destructive",
      });
    } finally {
      setDeletingIds(prev => prev.filter(id => id !== documentId));
    }
  }

  async function handleReparse(documentId: string) {
    setParsingIds(prev => [...prev, documentId]);
    try {
      const response = await fetch(`/api/documents/${documentId}/parse`, {
        method: "POST",
      });

      if (response.ok) {
        toast({
          title: "重新解析已启动",
          description: "文档正在解析中，请稍后刷新查看结果",
        });
        fetchDocuments();
      } else {
        const error = await response.json();
        toast({
          title: "解析失败",
          description: error.error || error.details,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "网络错误",
        description: "请检查您的网络连接",
        variant: "destructive",
      });
    } finally {
      setParsingIds(prev => prev.filter(id => id !== documentId));
    }
  }

  const getDocTypeLabel = (docType: string) => {
    switch (docType) {
      case "tender_doc":
        return "招标文件";
      case "legal_doc":
        return "法律文件";
      case "bid_doc":
        return "投标文件";
      case "review_report":
        return "审查报告";
      default:
        return docType;
    }
  };

  const getParseStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "processing":
        return <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getParseStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "已解析";
      case "processing":
        return "解析中";
      case "failed":
        return "解析失败";
      default:
        return "待解析";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">文档管理</h2>
          <p className="text-muted-foreground">
            管理项目相关文档
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无文档</h3>
            <p className="text-muted-foreground text-center mb-4">
              上传招标文件、法律文件或投标文件开始审查流程
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">{doc.name}</CardTitle>
                    <CardDescription>
                      {getDocTypeLabel(doc.docType)} ·
                      {new Date(doc.createdAt).toLocaleDateString("zh-CN")}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getParseStatusIcon(doc.parseStatus)}
                    <span className="text-sm text-muted-foreground">
                      {getParseStatusLabel(doc.parseStatus)}
                    </span>
                  </div>
                  {doc.parseStatus === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleParse(doc.id)}
                      disabled={parsingIds.includes(doc.id)}
                    >
                      {parsingIds.includes(doc.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "解析"
                      )}
                    </Button>
                  )}
                  {doc.parseStatus === "failed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReparse(doc.id)}
                      disabled={parsingIds.includes(doc.id)}
                    >
                      {parsingIds.includes(doc.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          重新解析
                        </>
                      )}
                    </Button>
                  )}
                  {doc.parseStatus === "completed" && (
                    <Link href={`/projects/${projectId}/documents/${doc.id}`}>
                      <Button size="sm" variant="outline">
                        查看详情
                      </Button>
                    </Link>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(doc.id, doc.name)}
                    disabled={deletingIds.includes(doc.id) || doc.parseStatus === "processing"}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {deletingIds.includes(doc.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}