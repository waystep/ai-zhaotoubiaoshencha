"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle2Icon, ClockIcon, ChevronDownIcon, Loader2Icon, XCircleIcon,
  BotIcon, WrenchIcon, FileTextIcon, SearchIcon, GlobeIcon, DatabaseIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Response } from "./response";
import { AgentSourceBadge, formatAgentName } from "./agent-separator";

export type ToolCallProps = ComponentProps<"div"> & {
  toolName: string;
  state?: "pending" | "running" | "complete" | "error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
  /** 来自哪个子智能体（可选），用于显示来源标识 */
  agentSource?: string;
};

// 判断是否为子智能体调用
function isAgentTool(toolName: string): boolean {
  return toolName.startsWith("agent-") || toolName.includes("-agent");
}

// 根据工具名推断图标
function getToolIcon(toolName: string) {
  if (isAgentTool(toolName)) return <BotIcon className="size-4" />;
  const name = toolName.toLowerCase();
  if (name.includes("document-reader") || name.includes("reader")) return <FileTextIcon className="size-4" />;
  if (name.includes("search") || name.includes("semantic")) return <SearchIcon className="size-4" />;
  if (name.includes("web")) return <GlobeIcon className="size-4" />;
  if (name.includes("storage") || name.includes("get-review") || name.includes("get-response") || name.includes("get-report")) return <DatabaseIcon className="size-4" />;
  return <WrenchIcon className="size-4" />;
}

const getStateIcon = (state?: string) => {
  switch (state) {
    case "pending":
      return <ClockIcon className="size-4 text-muted-foreground" />;
    case "running":
      return <Loader2Icon className="size-4 animate-spin text-primary" />;
    case "complete":
      return <CheckCircle2Icon className="size-4 text-green-500" />;
    case "error":
      return <XCircleIcon className="size-4 text-destructive" />;
    default:
      return <ClockIcon className="size-4 text-muted-foreground" />;
  }
};

const getStateLabel = (state?: string) => {
  switch (state) {
    case "pending": return "等待执行";
    case "running": return "正在执行";
    case "complete": return "已完成";
    case "error": return "执行失败";
    default: return state || "未知";
  }
};

const truncate = (s: string, max = 500): string =>
  s.length <= max ? s : s.substring(0, max) + "...";

// 检查输出是否包含文本内容
function hasTextOutput(output: unknown): boolean {
  if (!output) return false;
  if (typeof output === "string" && output.length > 50) return true;
  if (typeof output === "object") {
    const data = output as Record<string, unknown>;
    if (data.text && typeof data.text === "string" && data.text.length > 50) return true;
  }
  return false;
}

// 获取输出中的文本内容
function getTextOutput(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (typeof output === "object" && output !== null) {
    const data = output as Record<string, unknown>;
    if (data.text && typeof data.text === "string") return data.text;
  }
  return null;
}

export const ToolCall = ({
  toolName,
  state,
  input,
  output,
  errorText,
  className,
  ...props
}: ToolCallProps) => {
  const agent = isAgentTool(toolName);
  const hasDetails = (input != null || output != null || !!errorText) && state !== "running";

  return (
    <div className={className} {...props}>
      <Collapsible defaultOpen={false} className={cn(
        "rounded border text-[11px] transition-colors",
        state === "error"
          ? "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20"
          : state === "complete"
          ? "border-muted bg-muted/20"
          : state === "running"
          ? "border-primary/30 bg-primary/5 animate-pulse"
          : "border-muted bg-muted/20"
      )}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 p-1.5 cursor-pointer hover:bg-muted/30 transition-colors rounded-t">
        <span className="text-muted-foreground shrink-0">{getStateIcon(state)}</span>
        <span className="text-muted-foreground shrink-0">{getToolIcon(toolName)}</span>
        <span className="truncate text-muted-foreground">
          {agent ? formatAgentName(toolName) : toolName.replace(/^tool-/, "").replace(/([A-Z])/g, " $1").trim()}
        </span>
        {hasDetails && (
          <ChevronDownIcon className="size-3 ml-auto transition-transform text-muted-foreground/50 group-data-[state=open]:rotate-180" />
        )}
      </CollapsibleTrigger>

      {hasDetails && (
        <CollapsibleContent className="px-2 pb-2">
          {input != null && (
            <div className="mt-1">
              <p className="text-[10px] text-muted-foreground mb-0.5">输入</p>
              <pre className="overflow-auto rounded bg-muted/50 p-1.5 text-[10px] max-h-[200px] whitespace-pre-wrap">
                {typeof input === "string" ? truncate(input, 300) : JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}

          {output != null && state === "complete" && (
            <div className="mt-1">
              <p className="text-[10px] text-muted-foreground mb-0.5">输出</p>
              <pre className="overflow-auto rounded bg-muted/50 p-1.5 text-[10px] max-h-[200px] whitespace-pre-wrap">
                {typeof output === "string" ? truncate(output, 300) : JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}

          {errorText && (
            <div className="mt-1 text-[10px] text-red-600 dark:text-red-300">错误: {errorText}</div>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  </div>
  );
};

export type ToolCallsProps = ComponentProps<"div">;

export const ToolCalls = ({ className, children, ...props }: ToolCallsProps) => (
  <div className={cn("space-y-2 mt-2", className)} {...props}>
    {children}
  </div>
);
