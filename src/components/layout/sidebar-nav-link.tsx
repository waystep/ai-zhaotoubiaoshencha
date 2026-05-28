"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";

function navItemIsActive(pathname: string, href: string): boolean {
  const baseHref = href.split("?")[0] || href;
  if (pathname === baseHref) return true;
  return baseHref !== "/" && pathname.startsWith(`${baseHref}/`);
}

export function SidebarNavLink({
  href,
  pathname,
  name,
  icon: Icon,
  pendingHref,
  onNavigateIntent,
  isCollapsed = false,
}: {
  href: string;
  pathname: string;
  name: string;
  icon: LucideIcon;
  pendingHref: string | null;
  onNavigateIntent: (href: string) => void;
  isCollapsed?: boolean;
}) {
  const isActive = navItemIsActive(pathname, href);
  const isPending = pendingHref === href;

  const link = (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      aria-busy={isPending}
      onClick={() => onNavigateIntent(href)}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
        "active:scale-[0.98] motion-reduce:active:scale-100",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        isPending && "bg-muted/50 text-foreground",
        isCollapsed && "justify-center px-2",
      )}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
      ) : (
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {!isCollapsed && name}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {name}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
