/**
 * AI 助手页「返回」：解析 ?from= 内链路径并生成短标签（防开放重定向）。
 */
export function sanitizeInternalReturnPath(raw: string | null): string | null {
  if (!raw) return null;
  let path: string;
  try {
    path = decodeURIComponent(raw.trim());
  } catch {
    return null;
  }
  const base = path.split("?")[0] ?? path;
  if (!base.startsWith("/") || base.startsWith("//")) return null;
  if (base.includes("..") || base.includes("\\") || base.includes(":")) return null;
  if (/[\s\r\n\t]/.test(base)) return null;
  if (base.length > 512) return null;
  if (base === "/chat" || base.startsWith("/chat/")) return null;
  return base;
}

export function labelForReturnPath(path: string): string {
  if (path === "/" || path === "/projects") return "项目列表";
  if (path === "/projects/new" || path.endsWith("/projects/new")) return "新建项目";
  if (path === "/settings" || path.startsWith("/settings/")) return "设置";
  if (path.includes("/extraction-items")) return "审查项管理";
  if (path.includes("/documents/upload")) return "上传文档";
  if (path.includes("/documents/") && !path.endsWith("/documents")) return "文档详情";
  if (path.endsWith("/documents")) return "文档管理";
  if (/\/reports\/[^/]+\/chat$/.test(path)) return "审查会话";
  if (/\/reports\/[^/]+$/.test(path)) return "审查报告详情";
  if (path.includes("/reports/new")) return "新建审查";
  if (path.endsWith("/reports")) return "审查报告";
  if (path.includes("/settings")) return "项目设置";
  if (path.match(/^\/projects\/[^/]+$/)) return "项目概览";
  return "上一页";
}
