import {
  LayoutDashboard,
  FolderOpen,
  Upload,
  FileText,
  FileSearch,
  Shield,
  FilePenLine,
  ClipboardCheck,
  BookOpen,
  Scale,
  HardDriveUpload,
  Cpu,
  Settings2,
  Zap,
  Webhook,
  KeyRound,
  Settings,
  ScrollText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SidebarItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

export type SidebarSection = {
  label: string;
  items: SidebarItem[];
};

export type ActiveTab = "business" | "admin";

// ---------------------------------------------------------------------------
// Business sections (业务功能 tab)
// ---------------------------------------------------------------------------

export const businessSections: SidebarSection[] = [
  {
    label: "概览",
    items: [
      { name: "控制台", href: "/", icon: LayoutDashboard },
      { name: "全部项目", href: "/projects", icon: FolderOpen },
    ],
  },
];

// ---------------------------------------------------------------------------
// Admin sections (后台设置 tab)
// ---------------------------------------------------------------------------

export const adminSections: SidebarSection[] = [
  {
    label: "数据管理",
    items: [
      { name: "知识库", href: "/admin/knowledge", icon: BookOpen },
      { name: "审查规则", href: "/admin/rules", icon: Scale },
      { name: "数据导入", href: "/admin/data-import", icon: HardDriveUpload },
    ],
  },
  {
    label: "AI 配置",
    items: [
      { name: "模型管理", href: "/admin/models", icon: Cpu },
      { name: "智能体配置", href: "/admin/agent-configs", icon: Settings2 },
      { name: "预设模式", href: "/admin/agent-bindings", icon: Zap },
    ],
  },
  {
    label: "系统集成",
    items: [
      { name: "Webhook 管理", href: "/admin/integrations", icon: Webhook },
      { name: "SSO 认证", href: "/admin/sso", icon: KeyRound },
    ],
  },
  {
    label: "系统",
    items: [
      { name: "系统设置", href: "/settings", icon: Settings },
      { name: "操作日志", href: "/admin/audit-log", icon: ScrollText },
    ],
  },
];

// ---------------------------------------------------------------------------
// Dynamic project section builder
// ---------------------------------------------------------------------------

export function buildProjectSection(
  projectId: string,
  projectName: string,
): SidebarSection {
  return {
    label: projectName,
    items: [
      { name: "上传文件", href: `/projects/${projectId}/documents/upload`, icon: Upload },
      { name: "文档管理", href: `/projects/${projectId}/documents`, icon: FileText },
      { name: "招标解析", href: `/projects/${projectId}/analysis`, icon: FileSearch },
      { name: "投标预审", href: `/projects/${projectId}/review`, icon: Shield },
      { name: "投标编制", href: `/projects/${projectId}/draft`, icon: FilePenLine },
      { name: "审查报告", href: `/projects/${projectId}/reports`, icon: ClipboardCheck },
    ],
  };
}

// ---------------------------------------------------------------------------
// URL-derived helpers
// ---------------------------------------------------------------------------

export function deriveActiveTab(pathname: string): ActiveTab {
  if (pathname.startsWith("/admin") || pathname === "/settings") return "admin";
  return "business";
}

export function deriveDefaultRoute(tab: ActiveTab): string {
  return tab === "admin" ? "/admin/models" : "/";
}
