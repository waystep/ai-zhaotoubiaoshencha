"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarContent } from "./sidebar-content";
import { cn } from "@/lib/utils";
import { PanelLeftClose, PanelRightOpen } from "lucide-react";
import type { SidebarSection } from "@/lib/nav/sidebar-config";

export function Sidebar({
  sections,
  projectSection,
  pathname,
  pendingHref,
  onNavigateIntent,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
  showCreateProject,
}: {
  sections: SidebarSection[];
  projectSection?: SidebarSection | null;
  pathname: string;
  pendingHref: string | null;
  onNavigateIntent: (href: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  showCreateProject: boolean;
}) {
  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-card/30 shrink-0 transition-all duration-200",
          isCollapsed ? "w-16" : "w-56",
        )}
      >
        <SidebarContent
          sections={sections}
          projectSection={projectSection}
          pathname={pathname}
          pendingHref={pendingHref}
          onNavigateIntent={(href) => {
            onNavigateIntent(href);
          }}
          isCollapsed={isCollapsed}
          showCreateProject={showCreateProject}
        />
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onToggleCollapse}
          >
            {isCollapsed ? (
              <PanelRightOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      <Dialog open={isMobileOpen} onOpenChange={(open) => { if (!open) onMobileClose(); }}>
        <DialogContent className="fixed inset-y-0 left-0 h-full w-72 max-w-xs p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">导航菜单</DialogTitle>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                <ClipboardCheck className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold">智能投标预审平台</span>
            </div>
            <SidebarContent
              sections={sections}
              projectSection={projectSection}
              pathname={pathname}
              pendingHref={pendingHref}
              onNavigateIntent={(href) => {
                onNavigateIntent(href);
                onMobileClose();
              }}
              isCollapsed={false}
              showCreateProject={showCreateProject}
            />
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
