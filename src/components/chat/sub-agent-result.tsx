"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle2Icon, ClockIcon, ChevronDownIcon, Loader2Icon, XCircleIcon,
  BotIcon, FileTextIcon, SearchIcon, DatabaseIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Response } from "./response";

// 子智能体名称美化
const agentNameMap: Record<string, string> = {
  "extraction-agent": "审查项提取专家",
  "tender-review-agent": "投标文件审查专家",
  "report-generation-agent": "报告生成专家",
  "image-review-agent": "图像风险分析专家",
  "tender-review-supervisor": "审查总协调专家",
};

function formatAgentName(agentId: string): string {
  return agentNameMap[agentId] || agentId.replace(/-/g, " ");
}

// 子智能体数据结构
interface SubAgentData {
  text?: string;
  toolCalls?: Array<{
    toolName: string;
    args?: unknown;
    result?: unknown;
  }>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  steps?: number;
  modelName?: string;
}

export type SubAgentResultProps = ComponentProps<"div"> & {
  agentId: string;
  state?: "pending" | "running" | "complete" | "error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
  duration?: number;
};

const getStateIcon = (state?: string) => {
  switch (state) {
    case "pending":
      return <ClockIcon className="size-4 text-muted-foreground" />;
    case "running":
      return <Loader2Icon className="size-4 animate-spin text-indigo-500" />;
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

const truncate = (s: string, max = 300): string =>
  s.length <= max ? s : s.substring(0, max) + "...";

const formatOutput = (output: unknown): string => {
  if (!output) return "";
  if (typeof output === "string") return output;
  return JSON.stringify(output, null, 2);
};

export const SubAgentResult = ({
  agentId,
  state,
  input,
  output,
  errorText,
  duration,
  className,
  ...props
}: SubAgentResultProps) => {
  const agentName = formatAgentName(agentId);
  const hasDetails = (input != null || output != null || !!errorText) && state !== "running";
  const outputData = output as SubAgentData | undefined;
  const hasTextOutput = outputData?.text && outputData.text.length > 0;
  const hasToolCalls = outputData?.toolCalls && outputData.toolCalls.length > 0;

  return (
    <Collapsible defaultOpen={state === "running"} className={cn(
      "rounded-lg border text-sm",
      "border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/20",
      state === "error"
        ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30"
        : state === "complete"
        ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30"
        : state === "running"
        ? "border-indigo-300 bg-indigo-100/50 dark:border-indigo-800 dark:bg-indigo-950/40"
        : "",
      className
    )} {...props}>
      {/* Header */}
      <CollapsibleTrigger className="flex w-full items-center gap-2 p-3 cursor-pointer hover:bg-muted/30 transition-colors">
        {getStateIcon(state)}
        <span className="text-indigo-600 dark:text-indigo-400">
          <BotIcon className="size-4" />
        </span>
        <span className={cn(
          "font-medium",
          state === "error" ? "text-red-700 dark:text-red-300" :
          state === "complete" ? "text-green-700 dark:text-green-300" :
          state === "running" ? "text-indigo-700 dark:text-indigo-300 animate-pulse" :
          "text-indigo-700 dark:text-indigo-300"
        )}>
          {agentName}
        </span>
        <span className="text-muted-foreground text-xs">({getStateLabel(state)})</span>

        {/* 显示工具调用数量 */}
        {hasToolCalls && (
          <Badge variant="outline" className="ml-2 text-xs border-indigo-300">
            {outputData.toolCalls!.length} 工具调用
          </Badge>
        )}

        {/* 显示耗时 */}
        {duration && state === "complete" && (
          <span className="text-muted-foreground text-xs ml-auto">
            {duration}ms
          </span>
        )}

        {hasDetails && (
          <ChevronDownIcon className="size-4 ml-auto transition-transform text-muted-foreground group-data-[state=open]:rotate-180" />
        )}
      </CollapsibleTrigger>

      {/* Content */}
      {hasDetails && (
        <CollapsibleContent className="px-3 pb-3">
          {/* 输入参数 */}
          {input != null && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1 font-medium">委托任务:</p>
              <pre className="overflow-auto rounded bg-muted/50 p-2 text-xs max-h-[200px] whitespace-pre-wrap">
                {typeof input === "string" ? truncate(input) : JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}

          {/* 子智能体文本输出 - 使用 Response 渲染 Markdown */}
          {hasTextOutput && state === "complete" && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">执行结果:</p>
              <div className="rounded-lg bg-white/80 dark:bg-gray-900/50 p-3 border border-indigo-100 dark:border-indigo-900/50">
                <Response>{outputData.text}</Response>
              </div>
            </div>
          )}

          {/* 工具调用详情 */}
          {hasToolCalls && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">使用的工具:</p>
              <div className="space-y-2">
                {outputData.toolCalls!.map((tc, idx) => (
                  <div key={idx} className="rounded bg-muted/30 p-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      {tc.toolName.includes("reader") || tc.toolName.includes("document") ? (
                        <FileTextIcon className="size-3 text-blue-500" />
                      ) : tc.toolName.includes("search") ? (
                        <SearchIcon className="size-3 text-orange-500" />
                      ) : (
                        <DatabaseIcon className="size-3 text-green-500" />
                      )}
                      <span className="font-medium">{tc.toolName}</span>
                    </div>
                    {tc.args != null && (
                      <pre className="text-muted-foreground overflow-auto max-h-[100px]">
                        {truncate(JSON.stringify(tc.args))}
                      </pre>
                    )}
                    {tc.result != null && (
                      <pre className="text-green-700 dark:text-green-300 mt-1 overflow-auto max-h-[100px]">
                        {truncate(typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result))}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Usage 信息 */}
          {outputData?.usage && (
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span>输入: {outputData.usage.inputTokens || 0} tokens</span>
              <span>输出: {outputData.usage.outputTokens || 0} tokens</span>
              {outputData.usage.totalTokens && (
                <span>总计: {outputData.usage.totalTokens} tokens</span>
              )}
            </div>
          )}

          {/* 简单输出（非结构化） */}
          {!hasTextOutput && output != null && state === "complete" && !hasToolCalls && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">输出:</p>
              <pre className="overflow-auto rounded bg-green-100/50 dark:bg-green-900/20 p-2 text-xs max-h-[300px] whitespace-pre-wrap">
                {formatOutput(output)}
              </pre>
            </div>
          )}

          {/* 错误信息 */}
          {errorText && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/30 rounded p-2">
              错误: {errorText}
            </div>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

// Badge 导入
import { Badge } from "@/components/ui/badge";