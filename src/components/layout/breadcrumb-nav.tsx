"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

const PROJECT_SUB_LABELS: Record<string, string> = {
  documents: "文档管理",
  upload: "上传文件",
  analysis: "招标解析",
  review: "投标预审",
  draft: "投标编制",
  reports: "审查报告",
  "extraction-items": "审查项",
  settings: "项目设置",
  new: "新建",
  chat: "会话",
};

const ADMIN_SUB_LABELS: Record<string, string> = {
  knowledge: "知识库",
  rules: "审查规则",
  models: "模型管理",
  "agent-configs": "智能体配置",
  "agent-bindings": "预设模式",
  integrations: "Webhook 管理",
  "data-import": "数据导入",
  sso: "SSO 认证",
  "audit-log": "操作日志",
};

function segmentLabel(seg: string, index: number, segments: string[]): string {
  // /projects/:id/...
  if (segments[0] === "projects" && index === 1) return "项目详情";
  // /admin/*
  if (segments[0] === "admin") return ADMIN_SUB_LABELS[seg] ?? seg;
  // /projects/:id/*
  if (segments[0] === "projects" && segments[1] && index >= 2) {
    return PROJECT_SUB_LABELS[seg] ?? seg;
  }
  return seg;
}

function isUUIDish(s: string): boolean {
  return /^[0-9a-f]{8}-/i.test(s);
}

export function buildBreadcrumbs(
  pathname: string,
  projectName: string | null,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];

  if (pathname === "/") {
    items.push({ label: "控制台" });
    return items;
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "projects") {
    items.push({ label: "概览", href: "/" });
    items.push({ label: "全部项目", href: "/projects" });

    if (segments[1] && segments[1] !== "new") {
      items.push({
        label: projectName ?? "项目",
        href: `/projects/${segments[1]}/documents`,
      });

      for (let i = 2; i < segments.length; i++) {
        const seg = segments[i];
        if (isUUIDish(seg)) {
          // Document or report ID — show generic label
          const prev = segments[i - 1];
          if (prev === "documents") {
            items.push({ label: "文档详情" });
          } else if (prev === "reports") {
            items.push({ label: "报告详情" });
          }
          continue;
        }
        const label = segmentLabel(seg, i, segments);
        if (i < segments.length - 1) {
          items.push({ label, href: pathname.split("/").slice(0, i + 1).join("/") });
        } else {
          items.push({ label });
        }
      }
    } else if (segments[1] === "new") {
      items.push({ label: "新建项目" });
    }
  } else if (segments[0] === "admin") {
    items.push({ label: "后台设置", href: "/admin/models" });

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      if (isUUIDish(seg)) continue;
      const label = segmentLabel(seg, i, segments);
      if (i < segments.length - 1) {
        items.push({ label, href: pathname.split("/").slice(0, i + 1).join("/") });
      } else {
        items.push({ label });
      }
    }
  } else if (segments[0] === "settings") {
    items.push({ label: "系统设置" });
  } else if (segments[0] === "chat") {
    items.push({ label: "AI 助手" });
  } else if (segments[0] === "analytics") {
    items.push({ label: "数据统计" });
  } else if (segments[0] === "documents") {
    items.push({ label: "概览", href: "/" });
    items.push({ label: "文件管理" });
  } else {
    items.push({ label: segments[segments.length - 1] });
  }

  return items;
}

export function BreadcrumbNav({
  pathname,
  projectName,
}: {
  pathname: string;
  projectName: string | null;
}) {
  const items = buildBreadcrumbs(pathname, projectName);

  if (items.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <Home className="h-3.5 w-3.5" />
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          {item.href && i < items.length - 1 ? (
            <Link
              href={item.href}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? "text-foreground font-medium" : ""}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
