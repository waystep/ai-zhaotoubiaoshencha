"use client";

import { Fragment, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowLeft, CopyIcon, RefreshCcwIcon } from "lucide-react";

import { labelForReturnPath, sanitizeInternalReturnPath } from "@/lib/nav/from-chat-return";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  Message,
  MessageContent,
  Loader,
  Actions,
  Action,
  Suggestions,
  Suggestion,
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  PromptInputAttachments,
  PromptInputAttachment,
  Response,
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
  ToolCall,
  ToolCalls,
  AgentSeparator,
  AgentSourceBadge,
  formatAgentName,
} from "@/components/chat";

const suggestions = [
  "帮我启动项目审查",
  "查看当前的审查状态",
  "重新提取招标文件审查项",
];

function ChatAssistantContent() {
  const searchParams = useSearchParams();
  const fromPath = sanitizeInternalReturnPath(searchParams.get("from"));
  const returnHref = fromPath ?? "/projects";
  const returnLabel = fromPath ? labelForReturnPath(fromPath) : "项目列表";

  const [input, setInput] = useState("");
  const { messages, sendMessage, status, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const handleSubmit = (message: { text?: string; files?: unknown[] }) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments)) return;
    sendMessage({ text: message.text || "Sent with attachments" });
    setInput("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  return (
    <div className="relative mx-auto size-full max-w-4xl p-0 md:p-6">
      <Link
        href={returnHref}
        title={fromPath ? `返回进入 AI 助手前的页面：${fromPath}` : "返回项目列表"}
        className="mb-4 inline-flex max-w-full items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">
          {fromPath ? (
            <>
              返回<span className="text-foreground/90">（{returnLabel}）</span>
            </>
          ) : (
            "返回项目列表"
          )}
        </span>
      </Link>
      <div className="flex min-h-[600px] h-full flex-col">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 && (
              <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="space-y-1">
                  <h3 className="font-medium text-lg">智能投标预审智能体</h3>
                  <p className="text-muted-foreground text-sm">
                    发送消息或点击下方建议开始对话
                  </p>
                </div>
              </div>
            )}
            {messages.map((message, messageIndex) => {
              const isLastAssistantMessage =
                message.role === "assistant" &&
                messageIndex === messages.length - 1;

              const reasoningParts = message.parts.filter(
                (part) => part.type === "reasoning"
              );
              const hasReasoning = reasoningParts.length > 0;
              const isReasoningStreaming =
                isLastAssistantMessage &&
                status === "streaming" &&
                message.parts.at(-1)?.type === "reasoning";

              // 收集工具调用（包括子智能体调用）
              const toolMap = new Map<string, {
                toolCallId: string;
                toolName: string;
                state: "running" | "complete" | "error";
                input?: unknown;
                output?: unknown;
                errorText?: string;
                agentSource?: string;
              }>();

              // 子智能体的内部工具调用（需要平级展开）
              const subAgentTools: Array<{
                agentId: string;
                toolCallId: string;
                toolName: string;
                state: "running" | "complete" | "error";
                input?: unknown;
                output?: unknown;
              }> = [];

              // 子智能体的文本输出（需要平级展开）
              const subAgentTexts: Array<{
                agentId: string;
                text: string;
              }> = [];

              // 当前正在处理的子智能体ID
              let currentSubAgentId: string | null = null;

              for (const part of message.parts) {
                const partType = String(part.type);

                // 处理 data-tool-agent 或 tool-agent（子智能体完成事件）
                if (partType === "tool-agent" || partType === "data-tool-agent") {
                  const p = part as unknown as {
                    toolCallId?: string;
                    payload?: {
                      text?: string;
                      toolCalls?: Array<{
                        toolName: string;
                        args?: unknown;
                        result?: unknown;
                      }>;
                    };
                    data?: {
                      text?: string;
                      toolCalls?: Array<{
                        toolName: string;
                        args?: unknown;
                        result?: unknown;
                      }>;
                    };
                  };

                  const agentId = p.toolCallId?.replace(/^agent-/, "") || "sub-agent";
                  const agentData = p.payload || p.data;

                  // 提取子智能体的文本输出
                  if (agentData?.text) {
                    subAgentTexts.push({
                      agentId,
                      text: agentData.text,
                    });
                  }

                  // 提取子智能体的工具调用
                  if (agentData?.toolCalls && Array.isArray(agentData.toolCalls)) {
                    for (const tc of agentData.toolCalls) {
                      subAgentTools.push({
                        agentId,
                        toolCallId: `${agentId}-${tc.toolName}-${Date.now()}`,
                        toolName: tc.toolName,
                        state: "complete",
                        input: tc.args,
                        output: tc.result,
                      });
                    }
                  }

                  currentSubAgentId = null;
                }

                // 处理 tool-input-available（可能来自主智能体或子智能体）
                else if (partType === "tool-input-available" || partType === "tool-input-start") {
                  const p = part as { toolCallId: string; toolName?: string; input?: unknown };
                  const isAgentCall = p.toolName?.startsWith("agent-") || p.toolName?.includes("-agent");

                  if (isAgentCall) {
                    // 这是子智能体委托调用
                    currentSubAgentId = p.toolName!.replace(/^agent-/, "");
                  }

                  const entry = {
                    toolCallId: p.toolCallId,
                    toolName: p.toolName || "",
                    state: "running" as const,
                    input: p.input,
                    agentSource: currentSubAgentId || undefined,
                  };
                  toolMap.set(p.toolCallId, entry);
                }

                else if (partType === "tool-input-delta") {
                  const p = part as { toolCallId: string; inputTextDelta?: string };
                  const existing = toolMap.get(p.toolCallId);
                  if (existing) {
                    existing.input = (existing.input || "") + (p.inputTextDelta || "");
                  }
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

                // 处理子智能体执行事件中的文本流（实时输出）
                else if (partType.startsWith("agent-execution-event-")) {
                  const eventType = partType.replace("agent-execution-event-", "");
                  if (eventType === "text-delta" || eventType === "text") {
                    const p = part as unknown as {
                      text?: string;
                      payload?: { text?: string };
                      agentId?: string;
                    };
                    const textContent = p.text || p.payload?.text || "";
                    const agentId = p.agentId || currentSubAgentId || "sub-agent";
                    if (textContent) {
                      subAgentTexts.push({
                        agentId,
                        text: textContent,
                      });
                    }
                  }
                }
              }

              const toolParts = Array.from(toolMap.values());
              const hasTools = toolParts.length > 0 || subAgentTools.length > 0;

              return (
                <div key={message.id} className="space-y-2">
                  {/* Reasoning 部分 */}
                  {hasReasoning && (
                    <Reasoning className="w-full" isStreaming={isReasoningStreaming}>
                      <ReasoningTrigger />
                      <ReasoningContent>
                        {reasoningParts
                          .map((part) => (part as { text?: string }).text ?? "")
                          .join("\n\n")}
                      </ReasoningContent>
                    </Reasoning>
                  )}

                  {/* 主智能体的工具调用 */}
                  {toolParts.filter(t => !t.toolName.startsWith("agent-") && !t.toolName.includes("-agent")).length > 0 && (
                    <ToolCalls>
                      {toolParts
                        .filter(t => !t.toolName.startsWith("agent-") && !t.toolName.includes("-agent"))
                        .map((t) => (
                          <ToolCall
                            key={t.toolCallId}
                            toolName={t.toolName}
                            state={t.state}
                            input={t.input}
                            output={t.output}
                            errorText={t.errorText}
                            agentSource={t.agentSource}
                          />
                        ))}
                    </ToolCalls>
                  )}

                  {/* 子智能体委托调用标识 */}
                  {toolParts.filter(t => t.toolName.startsWith("agent-") || t.toolName.includes("-agent")).map((t) => (
                    <AgentSeparator
                      key={t.toolCallId}
                      agentId={t.toolName.replace(/^agent-/, "")}
                      direction={t.state === "complete" ? "end" : "start"}
                    />
                  ))}

                  {/* 子智能体的文本输出 - 平级渲染为消息 */}
                  {subAgentTexts.map((st, idx) => (
                    <Message key={`sub-text-${idx}`} from="assistant">
                      <MessageContent>
                        <div className="flex items-start gap-2">
                          <AgentSourceBadge agentId={st.agentId} className="mt-1 shrink-0" />
                          <Response>{st.text}</Response>
                        </div>
                      </MessageContent>
                    </Message>
                  ))}

                  {/* 子智能体的工具调用 - 平级渲染 */}
                  {subAgentTools.length > 0 && (
                    <div className="ml-4 pl-3 border-l-2 border-indigo-200 dark:border-indigo-800/50 space-y-2">
                      {subAgentTools.map((st) => (
                        <ToolCall
                          key={st.toolCallId}
                          toolName={st.toolName}
                          state={st.state}
                          input={st.input}
                          output={st.output}
                          agentSource={st.agentId}
                        />
                      ))}
                    </div>
                  )}

                  {/* 主智能体的文本消息 */}
                  {message.parts.map((part, i) => {
                    if (part.type !== "text") return null;
                    const text = (part as { text: string }).text;
                    if (!text?.trim()) return null;

                    return (
                      <Fragment key={`${message.id}-${i}`}>
                        <Message from={message.role}>
                          <MessageContent>
                            <Response>{text}</Response>
                          </MessageContent>
                        </Message>
                        {isLastAssistantMessage && (
                          <Actions className="mt-2">
                            <Action onClick={() => regenerate()} label="重试">
                              <RefreshCcwIcon className="size-3" />
                            </Action>
                            <Action
                              onClick={() => navigator.clipboard.writeText(text)}
                              label="复制"
                            >
                              <CopyIcon className="size-3" />
                            </Action>
                          </Actions>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              );
            })}
            {status === "submitted" && <Loader className="py-4" />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {messages.length === 0 && (
          <Suggestions className="mt-4">
            {suggestions.map((suggestion) => (
              <Suggestion
                key={suggestion}
                onClick={handleSuggestionClick}
                suggestion={suggestion}
              />
            ))}
          </Suggestions>
        )}

        <PromptInput onSubmit={handleSubmit} className="mt-4" globalDrop multiple>
          <PromptInputBody>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              placeholder="输入审查指令..."
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>
            <PromptInputSubmit disabled={!input && !status} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export default function ChatAssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="relative mx-auto flex min-h-[400px] max-w-4xl items-center justify-center p-6 text-sm text-muted-foreground">
          加载中…
        </div>
      }
    >
      <ChatAssistantContent />
    </Suspense>
  );
}