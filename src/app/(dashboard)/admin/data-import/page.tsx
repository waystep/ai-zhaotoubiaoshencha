"use client";

import { HardDriveUpload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DataImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2">数据导入</h2>
        <p className="text-muted-foreground">批量导入外部数据与文件</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDriveUpload className="h-5 w-5 text-primary" />
            数据导入工具
          </CardTitle>
          <CardDescription>支持批量导入知识库、规则、项目数据等（功能开发中）</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[200px] flex items-center justify-center text-muted-foreground text-sm">
          敬请期待
        </CardContent>
      </Card>
    </div>
  );
}
