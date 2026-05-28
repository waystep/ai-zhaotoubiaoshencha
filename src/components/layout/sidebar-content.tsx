"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNavLink } from "./sidebar-nav-link";
import type { SidebarSection } from "@/lib/nav/sidebar-config";

export function SidebarContent({
  sections,
  projectSection,
  pathname,
  pendingHref,
  onNavigateIntent,
  isCollapsed,
  showCreateProject,
}: {
  sections: SidebarSection[];
  projectSection?: SidebarSection | null;
  pathname: string;
  pendingHref: string | null;
  onNavigateIntent: (href: string) => void;
  isCollapsed: boolean;
  showCreateProject: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {/* Project workspace section */}
        {projectSection && (
          <>
            <div>
              {!isCollapsed && (
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {projectSection.label}
                </div>
              )}
              <div className="space-y-0.5">
                {projectSection.items.map((item) => (
                  <SidebarNavLink
                    key={item.href}
                    href={item.href}
                    pathname={pathname}
                    name={item.name}
                    icon={item.icon}
                    pendingHref={pendingHref}
                    onNavigateIntent={onNavigateIntent}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </div>
            </div>
            {!isCollapsed && <div className="border-t" />}
          </>
        )}

        {/* Regular sections */}
        {sections.map((section) => (
          <div key={section.label}>
            {!isCollapsed && (
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  href={item.href}
                  pathname={pathname}
                  name={item.name}
                  icon={item.icon}
                  pendingHref={pendingHref}
                  onNavigateIntent={onNavigateIntent}
                  isCollapsed={isCollapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Create project button */}
      {showCreateProject && (
        <div className="border-t p-3">
          {isCollapsed ? (
            <Link href="/projects/new">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Plus className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Link href="/projects/new">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                创建项目
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
