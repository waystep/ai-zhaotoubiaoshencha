"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowLeft, Bot, CopyIcon, Loader2Icon, RefreshCcwIcon, User } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  MessageContent,
  Loader,
  Actions,
  Action,
  Response,
  ToolCall,
  formatAgentName,
  getAgentAvatarStyle,
  getSupervisorAvatarStyle,
} from "@/components/chat";

interface Report {
  id: string;
  status: string;
  projectId: string;
  documentId: string;
  document?: { name: string };
  project?: { name: string };
}

export default function ReportChatPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const reportId = params.reportId as string;

  const [input, setInput] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const pendingCommandRef = useRef<string | undefined>(undefined);

  const { messages, sendMessage, setMessages, status, error, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages: nextMessages, body }) => {
        const command = pendingCommandRef.current;
        pendingCommandRef.current = undefined;

        return {
          body: {
            ...(body || {}),
            reportId,
            threadId: reportId,
            resourceId: reportId,
            command,
            messages: nextMessages.slice(-1),
          },
        };
      },
    }),
  });

  const fetchReport = useCallback(async () => {
    const res = await fetch(`/api/reports/${reportId}`, { cache: "no-store" });
    const data = await res.json();
    setReport(data.report);
  }, [reportId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await fetchReport();
        const res = await fetch(`/api/chat?reportId=${reportId}`, { cache: "no-store" });
        const history = (await res.json()) as UIMessage[];
        if (!cancelled) {
          setMessages(history);
          setHistoryLoaded(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchReport, reportId, setMessages]);

  useEffect(() => {
    if (status === "ready") {
      void fetchReport();
    }
  }, [fetchReport, status]);

  const isStreaming = status === "submitted" || status === "streaming";

  const startReview = async () => {
    if (!report) return;

    pendingCommandRef.current = "start-review";
    await sendMessage({
      text: `请开始审查这份报告。

报告ID: ${report.id}
项目ID: ${report.projectId}
文档ID: ${report.documentId}
文档名称: ${report.document?.name ?? ""}`,
    });
  };

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    sendMessage({ text: input });
    setInput("");
  }, [input, isStreaming, sendMessage]);

  if (isLoading || !historyLoaded) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader size={32} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col max-w-4xl mx-auto">
      {/* Header - 固定在顶部 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/projects/${projectId}/reports/${reportId}`)}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          查看报告详情
        </Button>
        <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
          <Bot className="h-4 w-4" />
          <span>审查会话 #{reportId.slice(0, 8)}</span>
        </div>
      </div>

      {/* 项目信息 - 固定 */}
      <div className="px-4 py-1.5 text-xs text-muted-foreground border-b bg-muted/30 shrink-0">
        项目: {report?.project?.name} | 文档: {report?.document?.name}
      </div>

      {/* Chat Container - 填满剩余空间 */}
      <div className="flex flex-col min-h-0 flex-1">
        <Conversation className="h-full flex-1 overflow-y-auto">
          <ConversationContent>
            {messages.length === 0 && !isStreaming && (
              <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
                <Bot className="h-12 w-12 text-muted-foreground" />
                <div className="space-y-1">
                  <h3 className="font-medium">点击下方按钮开始审查</h3>
                  <p className="text-muted-foreground text-sm">
                    AI 将自动分析投标文件的合规性
                  </p>
                </div>
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === "user";
              const isLastAssistantMessage =
                message.role === "assistant" &&
                message.id === messages[messages.length - 1]?.id;

              // --- 按 parts 位置构建渲染槽（实现混排）---

              // 主智能体工具调用
              const toolMap = new Map<string, {
                toolCallId: string; toolName: string;
                state: "running" | "complete" | "error";
                input?: unknown; output?: unknown; errorText?: string;
              }>();

              // 子智能体输出
              const agentOutputs = new Map<string, {
                text: string;
                tools: Array<{ toolCallId: string; toolName: string; state: string; input?: unknown; output?: unknown }>;
              }>();

              // 收集主智能体文本
              const mainTexts: Array<{ index: number; text: string }> = [];

              let currentAgentId: string | null = null;

              // 记录 part 位置对应的渲染槽
              type Slot =
                | { kind: "main-tool"; toolCallId: string; pos: number }
                | { kind: "main-text"; index: number; text: string; pos: number }
                | { kind: "agent-output"; agentId: string; pos: number };

              const slots: Slot[] = [];

              for (let pi = 0; pi < message.parts.length; pi++) {
                const part = message.parts[pi];
                const partType = String(part.type);

                if (partType === "tool-input-available" || partType === "tool-input-start") {
                  const p = part as { toolCallId: string; toolName?: string; input?: unknown };
                  const isAgentCall = p.toolName?.startsWith("agent-") || p.toolName?.includes("-Agent");

                  if (isAgentCall) {
                    currentAgentId = p.toolName!.replace(/^agent-/, "").replace(/-Agent$/, "");
                  } else {
                    toolMap.set(p.toolCallId, {
                      toolCallId: p.toolCallId, toolName: p.toolName || "",
                      state: "running", input: p.input,
                    });
                    slots.push({ kind: "main-tool", toolCallId: p.toolCallId, pos: pi });
                  }
                }

                else if (partType === "tool-input-delta") {
                  const p = part as { toolCallId: string; inputTextDelta?: string };
                  const existing = toolMap.get(p.toolCallId);
                  if (existing) existing.input = (existing.input || "") + (p.inputTextDelta || "");
                }

                else if (partType === "tool-output-available") {
                  const p = part as { toolCallId: string; output?: unknown; error?: unknown; errorText?: string };
                  const existing = toolMap.get(p.toolCallId);
                  if (existing) {
                    existing.state = p.error ? "error" : "complete";
                    existing.output = p.output;
                    if (p.error) existing.errorText = p.errorText || String(p.error);
                  }
                }

                else if (partType === "data-tool-agent" || partType === "tool-agent") {
                  const p = part as unknown as {
                    toolCallId?: string;
                    data?: {
                      id?: string; text?: string; reasoning?: string[];
                      toolCalls?: Array<{ toolCallId: string; toolName: string; args?: unknown }>;
                      toolResults?: Array<{ toolCallId: string; toolName: string; result?: unknown }>;
                      steps?: Array<{
                        reasoningText?: string; reasoning?: string[]; text?: string;
                        toolCalls?: Array<{ toolCallId: string; toolName: string; args?: unknown }>;
                        toolResults?: Array<{ toolCallId: string; toolName: string; result?: unknown }>;
                      }>;
                    };
                  };

                  const agentId = p.data?.id || currentAgentId || "sub-agent";
                  const d = p.data;

                  // 提取文本：从所有 steps 拼接完整文本（不只是最后一步）
                  let text = "";
                  if (d?.steps?.length) {
                    const parts: string[] = [];
                    for (const step of d.steps) {
                      const st = step.reasoningText || (step.reasoning || []).join("") || step.text || "";
                      if (st.trim()) parts.push(st.trim());
                    }
                    text = parts.join("\n\n");
                  }
                  if (!text && d?.reasoning?.length) text = d.reasoning.join("");
                  if (!text && d?.text) text = d.text;

                  // 收集工具
                  const toolSet = new Map<string, { toolCallId: string; toolName: string; input?: unknown; output?: unknown }>();
                  const pushTc = (tc: { toolCallId: string; toolName: string; args?: unknown }) => {
                    if (!toolSet.has(tc.toolCallId)) {
                      toolSet.set(tc.toolCallId, { toolCallId: tc.toolCallId, toolName: tc.toolName, input: tc.args });
                    }
                  };
                  d?.toolCalls?.forEach(pushTc);
                  d?.steps?.forEach(s => s.toolCalls?.forEach(pushTc));

                  const resultMap = new Map<string, unknown>();
                  d?.toolResults?.forEach(tr => resultMap.set(tr.toolCallId, tr.result));
                  d?.steps?.forEach(s => s.toolResults?.forEach(tr => resultMap.set(tr.toolCallId, tr.result)));

                  const tools = Array.from(toolSet.values()).map(tc => ({
                    ...tc,
                    state: resultMap.has(tc.toolCallId) ? "complete" as const : "running" as const,
                    output: resultMap.get(tc.toolCallId),
                  }));

                  // 只保留更长的文本（避免增量更新时覆盖完整文本）
                  const existing = agentOutputs.get(agentId);
                  if (!existing || text.length >= existing.text.length) {
                    agentOutputs.set(agentId, { text, tools });
                  } else if (tools.length > 0) {
                    // 文本不变但工具可能有更新
                    agentOutputs.set(agentId, { text: existing.text, tools });
                  }

                  // 记录槽位
                  if (!slots.some(s => s.kind === "agent-output" && s.agentId === agentId)) {
                    slots.push({ kind: "agent-output", agentId, pos: pi });
                  }

                  currentAgentId = null;
                }

                else if (partType === "text") {
                  const text = (part as { text: string }).text;
                  mainTexts.push({ index: pi, text });
                  slots.push({ kind: "main-text", index: pi, text, pos: pi });
                }
              }

              // 如果没有任何渲染槽但有工具调用，手动补充
              if (message.role !== "user" && slots.length === 0) {
                for (const [id, t] of toolMap) {
                  slots.push({ kind: "main-tool", toolCallId: id, pos: 0 });
                }
                for (const agentId of agentOutputs.keys()) {
                  slots.push({ kind: "agent-output", agentId, pos: 0 });
                }
              }

              // --- 按 pos 排序渲染 ---
              slots.sort((a, b) => a.pos - b.pos);

              return (
                <div key={message.id} className="space-y-1">
                  {/* ---- 用户消息 ---- */}
                  {isUser && (
                    <div className="group is-user flex items-start justify-end gap-2 py-2">
                      <MessageContent>
                        <Response>{mainTexts.map(t => t.text).join("\n\n")}</Response>
                      </MessageContent>
                      <Avatar className="size-7 ring-0 bg-primary/10 shrink-0">
                        <AvatarFallback><User className="size-3.5" /></AvatarFallback>
                      </Avatar>
                    </div>
                  )}

                  {/* ---- 按位置混排渲染 ---- */}
                  {!isUser && slots.map((slot, si) => {
                    // 主智能体工具
                    if (slot.kind === "main-tool") {
                      const t = toolMap.get(slot.toolCallId);
                      if (!t) return null;
                      return (
                        <div key={`tool-${si}`} className="pl-10">
                          <ToolCall
                            toolName={t.toolName}
                            state={t.state}
                            input={t.input}
                            output={t.output}
                            errorText={t.errorText}
                          />
                        </div>
                      );
                    }

                    // 主智能体文本
                    if (slot.kind === "main-text") {
                      const s = getSupervisorAvatarStyle();
                      return (
                        <div key={`text-${si}`} className="group is-assistant">
                          <div className="flex items-start gap-2 py-2">
                            <Avatar className={cn("size-7 ring-0 shrink-0", s.bg, s.text)}>
                              <AvatarFallback className={cn("text-xs font-bold", s.bg, s.text)}>{s.initial}</AvatarFallback>
                            </Avatar>
                            <MessageContent>
                              <Response>{slot.text}</Response>
                            </MessageContent>
                          </div>
                          {isLastAssistantMessage && (
                            <Actions className="ml-10">
                              <Action onClick={() => regenerate()} label="重试">
                                <RefreshCcwIcon className="size-3" />
                              </Action>
                              <Action onClick={() => navigator.clipboard.writeText(slot.text)} label="复制">
                                <CopyIcon className="size-3" />
                              </Action>
                            </Actions>
                          )}
                        </div>
                      );
                    }

                    // 子智能体输出（文本 + 工具混排）
                    if (slot.kind === "agent-output") {
                      const output = agentOutputs.get(slot.agentId);
                      if (!output) return null;
                      const s = getAgentAvatarStyle(slot.agentId);
                      return (
                        <div key={`agent-${si}`} className="group is-assistant">
                          {/* 文本 */}
                          {output.text.trim() && (
                            <div className="flex items-start gap-2 py-2">
                              <Avatar className={cn("size-7 ring-0 shrink-0", s.bg, s.text)}>
                                <AvatarFallback className={cn("text-xs font-bold", s.bg, s.text)}>{s.initial}</AvatarFallback>
                              </Avatar>
                              <MessageContent>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium", s.bg, s.text)}>
                                    {s.label}
                                  </span>
                                </div>
                                <Response>{output.text}</Response>
                              </MessageContent>
                            </div>
                          )}
                          {/* 工具（放在文本下方） */}
                          {output.tools.length > 0 && (
                            <div className="pl-10 space-y-1">
                              {output.tools.map((t) => (
                                <ToolCall
                                  key={t.toolCallId}
                                  toolName={t.toolName}
                                  state={t.state as "running" | "complete"}
                                  input={t.input}
                                  output={t.output}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              );
            })}

            {status === "submitted" && <Loader className="py-4" size={20} />}

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">
                {error.message}
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input Area - 固定在底部 */}
        <div className="border-t p-3 shrink-0">
          {messages.length === 0 && !isStreaming && (
            <Button onClick={startReview} className="w-full" size="sm">
              <Bot className="mr-2 h-4 w-4" />
              开始审查
            </Button>
          )}

          {(messages.length > 0 || report?.status === "in_progress" || report?.status === "completed") && (
            <div className="flex items-end gap-2">
              <textarea
                onChange={(e) => setInput(e.target.value)}
                value={input}
                placeholder="输入补充指令或问题..."
                disabled={isStreaming}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="shrink-0"
              >
                {isStreaming ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  "发送"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}