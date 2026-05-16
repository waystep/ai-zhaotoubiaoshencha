"use client";

import { cn } from "@/lib/utils";
import { BotIcon, ChevronRightIcon } from "lucide-react";
import type { ComponentProps } from "react";

// 智能体名称映射
const agentNameMap: Record<string, string> = {
  "extraction-agent": "审查项提取",
  "tender-review-agent": "投标文件审查",
  "report-generation-agent": "报告生成",
  "image-review-agent": "图像风险分析",
  "tender-review-supervisor": "审查总协调",
};

// 智能体头像样式：颜色 + 简称
const agentAvatarStyle: Record<string, { bg: string; text: string; initial: string; label: string }> = {
  "tender-review-supervisor": {
    bg: "bg-violet-100 dark:bg-violet-900/30",
    text: "text-violet-700 dark:text-violet-300",
    initial: "总",
    label: "审查总协调",
  },
  "tender-review-agent": {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    initial: "审",
    label: "投标文件审查",
  },
  "extraction-agent": {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-300",
    initial: "提",
    label: "审查项提取",
  },
  "report-generation-agent": {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    initial: "报",
    label: "报告生成",
  },
  "image-review-agent": {
    bg: "bg-rose-100 dark:bg-rose-900/30",
    text: "text-rose-700 dark:text-rose-300",
    initial: "图",
    label: "图像风险分析",
  },
};

export function formatAgentName(agentId: string): string {
  return agentNameMap[agentId] || agentId.replace(/-agent$/i, "").replace(/-/g, " ");
}

/** 获取智能体头像样式 */
export function getAgentAvatarStyle(agentId: string) {
  return agentAvatarStyle[agentId] || {
    bg: "bg-slate-100 dark:bg-slate-900/30",
    text: "text-slate-700 dark:text-slate-300",
    initial: agentId.slice(0, 1).toUpperCase(),
    label: formatAgentName(agentId),
  };
}

/** 主智能体（总协调）默认样式 */
export function getSupervisorAvatarStyle() {
  return getAgentAvatarStyle("tender-review-supervisor");
}

// 子智能体标识 - 作为对话流中的视觉分隔，表示子智能体开始执行
export type AgentSeparatorProps = ComponentProps<"div"> & {
  agentId: string;
  direction?: "start" | "end";
};

export const AgentSeparator = ({
  agentId,
  direction = "start",
  className,
  ...props
}: AgentSeparatorProps) => {
  const agentName = formatAgentName(agentId);

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-2 text-sm",
        direction === "start"
          ? "text-indigo-600 dark:text-indigo-400"
          : "text-green-600 dark:text-green-400",
        className
      )}
      {...props}
    >
      <BotIcon className="size-4" />
      <span className="font-medium">{agentName}</span>
      <ChevronRightIcon className="size-3 opacity-50" />
      <span className="text-muted-foreground text-xs">
        {direction === "start" ? "开始执行" : "执行完成"}
      </span>
    </div>
  );
};

// 子智能体信息标签 - 用于在工具调用上方显示来源
export type AgentSourceBadgeProps = ComponentProps<"span"> & {
  agentId: string;
};

export const AgentSourceBadge = ({
  agentId,
  className,
  ...props
}: AgentSourceBadgeProps) => {
  const agentName = formatAgentName(agentId);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
        "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
        className
      )}
      {...props}
    >
      <BotIcon className="size-3" />
      {agentName}
    </span>
  );
};