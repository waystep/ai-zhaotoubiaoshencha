"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppHeader } from "@/components/layout/app-header";
import { Sidebar } from "@/components/layout/sidebar";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import {
  businessSections,
  adminSections,
  buildProjectSection,
  deriveActiveTab,
  deriveDefaultRoute,
} from "@/lib/nav/sidebar-config";
import type { SidebarSection } from "@/lib/nav/sidebar-config";

type ProjectOption = {
  id: string;
  name: string;
  projectNo: string;
};

type ProjectApiItem = ProjectOption & {
  [key: string]: unknown;
};

function selectedProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  if (!match) return null;
  if (match[1] === "new") return null;
  return match[1];
}

function projectsRouteSegment(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match?.[1] ?? null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Hydrate sidebar collapse state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setIsCollapsed(true);
  }, []);

  const selectedProjectId = selectedProjectIdFromPath(pathname);
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const activeTab = deriveActiveTab(pathname);

  const projectListFetchKey = useMemo(
    () => `${session?.user?.id ?? ""}:${projectsRouteSegment(pathname) ?? ""}`,
    [pathname, session?.user?.id],
  );

  // Fetch project list
  useEffect(() => {
    let ignore = false;
    async function fetchProjects() {
      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (ignore) return;
        setProjects(
          ((data.projects ?? []) as ProjectApiItem[]).map((p) => ({
            id: p.id,
            name: p.name,
            projectNo: p.projectNo,
          })),
        );
      } catch (error) {
        console.error("获取项目列表失败:", error);
      }
    }
    void fetchProjects();
    return () => { ignore = true; };
  }, [projectListFetchKey]);

  // Clear pending nav on route change
  useEffect(() => {
    setPendingNavHref(null);
    setIsMobileOpen(false);
  }, [pathname]);

  // Derive sidebar sections based on active tab
  const sections = activeTab === "business" ? businessSections : adminSections;
  const projectSection: SidebarSection | null =
    selectedProjectId && selectedProject
      ? buildProjectSection(selectedProjectId, selectedProject.name)
      : null;

  function handleSidebarNavIntent(href: string) {
    if (pathname === href || pathname === href.split("?")[0]) return;
    setPendingNavHref(href);
  }

  function handleTabChange(tab: "business" | "admin") {
    router.push(deriveDefaultRoute(tab));
  }

  function handleToggleCollapse() {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader
        activeTab={activeTab}
        onTabChange={handleTabChange}
        userName={session?.user?.name}
        userEmail={session?.user?.email}
        userImage={session?.user?.image}
        onToggleMobileSidebar={() => setIsMobileOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          sections={sections}
          projectSection={projectSection}
          pathname={pathname}
          pendingHref={pendingNavHref}
          onNavigateIntent={handleSidebarNavIntent}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          isMobileOpen={isMobileOpen}
          onMobileClose={() => setIsMobileOpen(false)}
          showCreateProject={activeTab === "business"}
        />

        <main className="flex min-w-0 flex-1 flex-col relative">
          <div
            id="dashboard-scroll"
            className="absolute inset-0 overflow-auto [scrollbar-gutter:stable]"
          >
            <div className="px-6 py-4">
              <BreadcrumbNav
                pathname={pathname}
                projectName={selectedProject?.name ?? null}
              />
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
