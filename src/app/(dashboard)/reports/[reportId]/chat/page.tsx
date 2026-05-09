'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { ArrowLeft, Bot, Loader2, Send } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Report {
  id: string;
  status: string;
  projectId: string;
  documentId: string;
  document?: { name: string };
  project?: { name: string };
}

function renderToolPart(part: Record<string, unknown>, index: number) {
  const state = String(part.state || '');
  const toolName = String(part.type || '').replace(/^tool-/, '');

  return (
    <div
      key={index}
      className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm dark:border-yellow-900/40 dark:bg-yellow-950/30"
    >
      <div className="font-medium text-yellow-800 dark:text-yellow-200">
        工具: {toolName} {state ? `(${state})` : ''}
      </div>
      {Boolean(part.input) && (
        <pre className="mt-2 overflow-x-auto rounded bg-yellow-100/70 p-2 text-xs dark:bg-yellow-900/30">
          {JSON.stringify(part.input, null, 2)}
        </pre>
      )}
      {Boolean(part.output) && (
        <pre className="mt-2 overflow-x-auto rounded bg-green-100/70 p-2 text-xs dark:bg-green-900/30">
          {JSON.stringify(part.output, null, 2)}
        </pre>
      )}
      {Boolean(part.errorText) && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-300">{String(part.errorText)}</div>
      )}
    </div>
  );
}

export default function ReportChatPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.reportId as string;

  const [input, setInput] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const pendingCommandRef = useRef<string | undefined>(undefined);

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
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
    const res = await fetch(`/api/reports/${reportId}`, { cache: 'no-store' });
    const data = await res.json();
    setReport(data.report);
  }, [reportId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await fetchReport();
        const res = await fetch(`/api/chat?reportId=${reportId}`, { cache: 'no-store' });
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
    if (status === 'ready') {
      void fetchReport();
    }
  }, [fetchReport, status]);

  const isStreaming = status === 'submitted' || status === 'streaming';

  const startReview = async () => {
    if (!report) return;

    pendingCommandRef.current = 'start-review';
    await sendMessage({
      text: `请开始审查这份报告。

报告ID: ${report.id}
项目ID: ${report.projectId}
文档ID: ${report.documentId}
文档名称: ${report.document?.name ?? ''}`
    });
  };

  const handleSubmit = async () => {
    if (!input.trim() || isStreaming) return;
    await sendMessage({ text: input });
    setInput('');
  };

  if (isLoading || !historyLoaded) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            审查会话 #{reportId.slice(0, 8)}
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            项目: {report?.project?.name} | 文档: {report?.document?.name}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[560px] space-y-3 overflow-y-auto rounded-lg bg-muted/30 p-4">
            {messages.length === 0 && !isStreaming && (
              <div className="py-8 text-center text-muted-foreground">点击下方按钮开始审查</div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === 'user'
                    ? 'ml-12 rounded-lg bg-blue-500 p-3 text-white'
                    : 'mr-12 rounded-lg bg-background p-3'
                }
              >
                {message.parts.map((part, index) => {
                  if (part.type === 'text') {
                    return (
                      <div key={index} className="whitespace-pre-wrap">
                        {part.text}
                      </div>
                    );
                  }

                  if (String(part.type).startsWith('tool-')) {
                    return renderToolPart(part as unknown as Record<string, unknown>, index);
                  }

                  return null;
                })}
              </div>
            ))}

            {isStreaming && (
              <div className="flex items-center gap-2 rounded-lg bg-background p-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">AI 正在工作...</span>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">
                {error.message}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {messages.length === 0 && !isStreaming && (
              <Button onClick={startReview} className="flex-1">
                <Bot className="mr-2 h-4 w-4" />
                开始审查
              </Button>
            )}

            {(messages.length > 0 || report?.status === 'in_progress' || report?.status === 'completed') && (
              <>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleSubmit();
                    }
                  }}
                  placeholder="输入补充指令或问题..."
                  disabled={isStreaming}
                  className="flex-1 rounded-lg border bg-background px-3 py-2"
                />
                <Button onClick={() => void handleSubmit()} disabled={isStreaming || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Button variant="ghost" onClick={() => router.push(`/reports/${reportId}`)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        查看报告详情
      </Button>
    </div>
  );
}
