"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  ClipboardCheck,
  FolderOpen,
  BarChart3,
  LogOut,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "项目列表", href: "/projects", icon: FolderOpen },
  // { name: "文件管理", href: "/documents", icon: FileText },
  // { name: "审查报告", href: "/reports", icon: ClipboardCheck },
  { name: "统计分析", href: "/analytics", icon: BarChart3 },
  { name: "设置", href: "/settings", icon: Settings },
];

function navItemIsActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return href !== "/" && pathname.startsWith(`${href}/`);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const currentNav =
    navigation.find((item) => navItemIsActive(pathname, item.href)) ?? null;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 border-r bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50 flex flex-col">
        <div className="p-4 border-b">
          <Link href="/" className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/50">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">智能招标审查平台</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = navItemIsActive(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity",
                    isActive ? "opacity-100" : "opacity-0"
                  )}
                  aria-hidden
                />
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-auto py-2"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session?.user?.image || ""} />
                  <AvatarFallback>
                    {session?.user?.name?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium">
                    {session?.user?.name || "User"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {session?.user?.email}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/settings">设置</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-card/70 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">当前位置</div>
              <div className="truncate text-sm font-medium">
                {currentNav?.name || "工作台"}
              </div>
            </div>
          </div>
        </header>
        {/* scrollbar-gutter: 避免主滚动条显隐时挤占内容宽度，引发 ResizeObserver / PDF 整页重绘闪动 */}
        <div
          id="dashboard-scroll"
          className="min-h-0 flex-1 overflow-auto p-6 [scrollbar-gutter:stable]"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
