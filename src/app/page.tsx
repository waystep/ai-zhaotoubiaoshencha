import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileText, BarChart3, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">智能招标审查平台</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">登录</Button>
            </Link>
            <Link href="/register">
              <Button>立即使用</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            <span className="text-primary">AI驱动</span>的招标文件智能审查
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            自动解析招标文件，智能审查投标文件合规性，精准定位问题位置，
            生成专业审查报告，提升招标审查效率与准确性。
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                开始使用 <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg">
                了解更多
              </Button>
            </Link>
          </div>
        </section>

        <section id="features" className="container mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-center mb-12">核心功能</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <FolderOpen className="h-10 w-10 text-primary mb-2" />
                <CardTitle>项目管理</CardTitle>
                <CardDescription>
                  创建招标项目，管理招标文件、法律文件和投标文件。
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <FileText className="h-10 w-10 text-primary mb-2" />
                <CardTitle>智能解析</CardTitle>
                <CardDescription>
                  自动解析PDF、Office文档，提取结构化内容和关键信息。
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <ClipboardCheck className="h-10 w-10 text-primary mb-2" />
                <CardTitle>合规审查</CardTitle>
                <CardDescription>
                  AI智能审查投标文件合规性，精准定位问题到具体页码区块。
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>报告生成</CardTitle>
                <CardDescription>
                  自动生成审查报告，包含问题清单、评分和整改建议。
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-center mb-12">工作流程</h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold mb-2">项目立项</h3>
              <p className="text-muted-foreground text-sm">创建招标项目</p>
            </div>
            <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-semibold mb-2">上传文件</h3>
              <p className="text-muted-foreground text-sm">招标文件、投标文件</p>
            </div>
            <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold mb-2">智能解析</h3>
              <p className="text-muted-foreground text-sm">AI文档解析</p>
            </div>
            <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-primary">4</span>
              </div>
              <h3 className="font-semibold mb-2">审查报告</h3>
              <p className="text-muted-foreground text-sm">生成审查报告</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>&copy; 2026 智能招标审查平台. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}