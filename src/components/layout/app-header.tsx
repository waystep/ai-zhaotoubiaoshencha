"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ClipboardCheck,
  LogOut,
  Menu,
  Search,
  Bell,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ActiveTab } from "@/lib/nav/sidebar-config";

export function AppHeader({
  activeTab,
  onTabChange,
  userName,
  userEmail,
  userImage,
  onToggleMobileSidebar,
}: {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  onToggleMobileSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background/95 backdrop-blur px-4">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden mr-2 h-8 w-8"
        onClick={onToggleMobileSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold hidden sm:inline">智能投标预审平台</span>
      </Link>

      {/* Center tabs */}
      <div className="flex items-center gap-1 mx-auto">
        <button
          onClick={() => onTabChange("business")}
          className={cn(
            "px-4 py-1.5 text-sm rounded-md transition-colors",
            activeTab === "business"
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          业务功能
        </button>
        <button
          onClick={() => onTabChange("admin")}
          className={cn(
            "px-4 py-1.5 text-sm rounded-md transition-colors",
            activeTab === "admin"
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          后台设置
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <Avatar className="h-6 w-6">
                <AvatarImage src={userImage || ""} />
                <AvatarFallback>{userName?.[0] || "U"}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <div className="truncate text-sm font-medium">
                {userName || "User"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {userEmail}
              </div>
            </div>
            <DropdownMenuSeparator />
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
    </header>
  );
}
