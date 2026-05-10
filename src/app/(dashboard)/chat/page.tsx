"use client";

import { Fragment, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { CopyIcon, RefreshCcwIcon } from "lucide-react";

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
} from "@/components/chat";

const suggestions = [
  "What can you help me with?",
  "Explain how this chat works",
  "Show me an example",
];

const ChatDemo = () => {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const handleSubmit = (message: { text?: string; files?: unknown[] }) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    sendMessage({
      text: message.text || "Sent with attachments",
      // files: message.files, // if your API supports files
    });
    setInput("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  return (
    <div className="max-w-4xl mx-auto p-0 md:p-6 relative size-full">
      <div className="flex flex-col h-full min-h-[600px]">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 && (
              <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="space-y-1">
                  <h3 className="font-medium text-lg">Start a conversation</h3>
                  <p className="text-muted-foreground text-sm">
                    Send a message or click a suggestion below
                  </p>
                </div>
              </div>
            )}
            {messages.map((message, messageIndex) => {
              const isLastAssistantMessage =
                message.role === "assistant" &&
                messageIndex === messages.length - 1;

              // Check for reasoning parts
              const reasoningParts = message.parts.filter(
                (part) => part.type === "reasoning"
              );
              const hasReasoning = reasoningParts.length > 0;
              const isReasoningStreaming =
                isLastAssistantMessage &&
                status === "streaming" &&
                message.parts.at(-1)?.type === "reasoning";

              return (
                <div key={message.id}>
                  {hasReasoning && (
                    <Reasoning
                      className="w-full"
                      isStreaming={isReasoningStreaming}
                    >
                      <ReasoningTrigger />
                      <ReasoningContent>
                        {reasoningParts
                          .map((part) => (part as { text?: string }).text ?? "")
                          .join("\n\n")}
                      </ReasoningContent>
                    </Reasoning>
                  )}
                  {message.parts.map((part, i) => {
                    switch (part.type) {
                      case "text":
                        return (
                          <Fragment key={`${message.id}-${i}`}>
                            <Message from={message.role}>
                              <MessageContent>
                                <Response>
                                  {(part as { text: string }).text}
                                </Response>
                              </MessageContent>
                            </Message>
                            {isLastAssistantMessage && (
                              <Actions className="mt-2">
                                <Action
                                  onClick={() => regenerate()}
                                  label="Retry"
                                >
                                  <RefreshCcwIcon className="size-3" />
                                </Action>
                                <Action
                                  onClick={() =>
                                    navigator.clipboard.writeText(
                                      (part as { text: string }).text
                                    )
                                  }
                                  label="Copy"
                                >
                                  <CopyIcon className="size-3" />
                                </Action>
                              </Actions>
                            )}
                          </Fragment>
                        );
                      case "reasoning":
                        return null;
                      default:
                        return null;
                    }
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

        <PromptInput
          onSubmit={handleSubmit}
          className="mt-4"
          globalDrop
          multiple
        >
          <PromptInputBody>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              placeholder="Send a message..."
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
};

export default ChatDemo;