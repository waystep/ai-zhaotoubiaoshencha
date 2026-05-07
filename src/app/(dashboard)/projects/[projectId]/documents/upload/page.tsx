"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Upload, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function DocumentUploadPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>("tender_doc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      // 检查文件类型
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "文件类型不支持",
          description: "请上传 PDF 或 Office 文档",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      toast({
        title: "请选择文件",
        description: "请先选择要上传的文档",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // 1. 上传文件到服务器
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        console.error("上传失败:", errorData);
        toast({
          title: "文件上传失败",
          description: errorData.error || "请检查文件格式和大小",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const uploadData = await uploadResponse.json();

      if (!uploadData.file?.storagePath) {
        toast({
          title: "上传响应异常",
          description: "服务器未返回正确的文件路径",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // 2. 创建文档记录（使用正确的绝对路径）
      const docResponse = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType,
          name: selectedFile.name,
          originalName: uploadData.file.originalName || selectedFile.name,
          fileSize: uploadData.file.fileSize || selectedFile.size,
          mimeType: uploadData.file.mimeType || selectedFile.type,
          storagePath: uploadData.file.storagePath,
        }),
      });

      if (docResponse.ok) {
        toast({
          title: "上传成功",
          description: "文档已上传，可以开始解析",
        });
        router.push(`/projects/${projectId}/documents`);
        router.refresh();
      } else {
        const error = await docResponse.json();
        toast({
          title: "创建记录失败",
          description: error.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "上传失败",
        description: "请检查您的网络连接",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">上传文档</h2>
        <p className="text-muted-foreground">
          上传招标文件、法律文件或投标文件
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            文档上传
          </CardTitle>
          <CardDescription>
            支持 PDF、Word、Excel 格式文件
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="docType">文档类型</Label>
            <select
              id="docType"
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              disabled={isLoading}
            >
              <option value="tender_doc">招标文件</option>
              <option value="legal_doc">法律文件</option>
              <option value="bid_doc">投标文件</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">选择文件</Label>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={handleFileChange}
                disabled={isLoading}
              />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    点击选择文件或拖拽文件到此处
                  </p>
                  <p className="text-xs text-muted-foreground">
                    支持 PDF、Word、Excel 格式
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <Button onClick={handleUpload} disabled={isLoading || !selectedFile}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  上传文档
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              取消
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}