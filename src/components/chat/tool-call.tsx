"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2Icon, ClockIcon, ChevronDownIcon, Loader2Icon, XCircleIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export type ToolCallProps = ComponentProps<"div"> & {
  toolName: string;
  state?: "pending" | "running" | "complete" | "error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

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
    case "pending":
      return "等待执行";
    case "running":
      return "正在执行";
    case "complete":
      return "已完成";
    case "error":
      return "执行失败";
    default:
      return state || "未知状态";
  }
};

const formatToolName = (toolName: string) => {
  // Remove "tool-" prefix if present and format
  const name = toolName.replace(/^tool-/, "");
  // Convert camelCase to readable format
  return name.replace(/([A-Z])/g, " $1").trim();
};

const truncateOutput = (output: unknown, maxLength = 200): string => {
  const str = typeof output === "string" ? output : JSON.stringify(output, null, 2);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
};

export const ToolCall = ({
  toolName,
  state,
  input,
  output,
  errorText,
  className,
  ...props
}: ToolCallProps) => {
  const hasDetails = input !== undefined && input !== null || output !== undefined && output !== null || errorText;

  return (
    <Collapsible defaultOpen={false} className={cn(
      "rounded-lg border text-sm",
      state === "error"
        ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30"
        : state === "complete"
        ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30"
        : state === "running"
        ? "border-primary/50 bg-primary/5"
        : "border-yellow-200 bg-yellow-50 dark:border-yellow-900/40 dark:bg-yellow-950/30",
      className
    )} {...props}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 p-3 cursor-pointer hover:bg-muted/30 transition-colors">
        {getStateIcon(state)}
        <span className={cn(
          "font-medium",
          state === "error" ? "text-red-700 dark:text-red-300" :
          state === "complete" ? "text-green-700 dark:text-green-300" :
          state === "running" ? "text-primary" :
          "text-yellow-700 dark:text-yellow-300"
        )}>
          工具: {formatToolName(toolName)}
        </span>
        <span className="text-muted-foreground text-xs">
          ({getStateLabel(state)})
        </span>
        {hasDetails && (
          <ChevronDownIcon className={cn(
            "size-4 ml-auto transition-transform text-muted-foreground",
            "group-data-[state=open]:rotate-180"
          )} />
        )}
      </CollapsibleTrigger>

      {hasDetails && (
        <CollapsibleContent className="px-3 pb-3">
          {input !== undefined && input !== null && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">输入参数:</p>
              <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-xs max-h-[200px]">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}

          {output !== undefined && output !== null && state === "complete" && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">输出结果:</p>
              <pre className="overflow-x-auto rounded bg-green-100/50 dark:bg-green-900/20 p-2 text-xs max-h-[300px]">
                {truncateOutput(output)}
              </pre>
            </div>
          )}

          {errorText && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-300">
              错误: {errorText}
            </div>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

export type ToolCallsProps = ComponentProps<"div">;

export const ToolCalls = ({ className, children, ...props }: ToolCallsProps) => (
  <div className={cn("space-y-2 mt-2", className)} {...props}>
    {children}
  </div>
);