import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { tenderProjects } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { FolderOpen, Plus, FileText, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  // 获取项目列表
  let projects: typeof tenderProjects.$inferSelect[] = [];
  try {
    if (session.user?.orgId) {
      projects = await db.query.tenderProjects.findMany({
        where: eq(tenderProjects.orgId, session.user.orgId),
        orderBy: [desc(tenderProjects.createdAt)],
        limit: 20,
      });
    }
  } catch (error) {
    console.error("获取项目列表失败:", error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">项目列表</h2>
          <p className="text-muted-foreground">
            管理您的招标审查项目
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            创建项目
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无项目</h3>
            <p className="text-muted-foreground text-center mb-4">
              点击上方按钮创建您的第一个招标审查项目
            </p>
            <Link href="/projects/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                创建项目
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:border-primary transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    {project.name}
                  </CardTitle>
                  <CardDescription>
                    项目编号: {project.projectNo}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      <span>文档</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ClipboardCheck className="h-4 w-4" />
                      <span>审查报告</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        project.status === "draft"
                          ? "bg-gray-100 text-gray-600"
                          : project.status === "published"
                          ? "bg-blue-100 text-blue-600"
                          : project.status === "reviewing"
                          ? "bg-yellow-100 text-yellow-600"
                          : project.status === "completed"
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {project.status === "draft"
                        ? "草稿"
                        : project.status === "published"
                        ? "已发布"
                        : project.status === "bidding"
                        ? "投标中"
                        : project.status === "reviewing"
                        ? "审查中"
                        : project.status === "completed"
                        ? "已完成"
                        : "已归档"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}