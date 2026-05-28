"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Webhook,
  Plus,
  Trash2,
  TestTube,
  ExternalLink,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";

type WebhookConfig = {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  headers: Record<string, string> | null;
  isActive: boolean;
  retryCount: number;
  createdAt: string;
};

type DeliveryLog = {
  id: string;
  event: string;
  responseStatus: number | null;
  durationMs: number | null;
  success: boolean;
  attemptCount: number;
  createdAt: string;
};

const EVENT_OPTIONS = [
  { value: "analysis.completed", label: "招标解析完成" },
  { value: "draft.generated", label: "投标样稿生成" },
  { value: "review.completed", label: "投标预审完成" },
  { value: "report.completed", label: "分析报告完成" },
];

export default function IntegrationsPage() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);

  // Delivery logs
  const [logsWebhookId, setLogsWebhookId] = useState<string | null>(null);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Test result
  const [testResults, setTestResults] = useState<Record<string, { loading: boolean; result?: { success: boolean; status: number | null; durationMs: number } }>>({});

  async function loadWebhooks() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/webhooks", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setWebhooks(json.webhooks || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function loadLogs(webhookId: string) {
    setLogsWebhookId(webhookId);
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/admin/webhooks/${webhookId}/logs`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setLogs(json.logs || []);
    } finally {
      setLogsLoading(false);
    }
  }

  function resetForm() {
    setFormName("");
    setFormUrl("");
    setFormSecret("");
    setFormEvents([]);
    setFormActive(true);
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(webhook: WebhookConfig) {
    setEditingId(webhook.id);
    setFormName(webhook.name);
    setFormUrl(webhook.url);
    setFormSecret(webhook.secret ?? "");
    setFormEvents(webhook.events);
    setFormActive(webhook.isActive);
    setDialogOpen(true);
  }

  async function handleSave() {
    const payload = {
      name: formName,
      url: formUrl,
      secret: formSecret || null,
      events: formEvents,
      isActive: formActive,
    };

    if (editingId) {
      await fetch(`/api/admin/webhooks/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setDialogOpen(false);
    resetForm();
    loadWebhooks();
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除此 Webhook？")) return;
    await fetch(`/api/admin/webhooks/${id}`, { method: "DELETE" });
    loadWebhooks();
    if (logsWebhookId === id) {
      setLogsWebhookId(null);
      setLogs([]);
    }
  }

  async function handleTest(id: string) {
    setTestResults((prev) => ({ ...prev, [id]: { loading: true } }));
    try {
      const res = await fetch(`/api/admin/webhooks/${id}/test`, { method: "POST" });
      const json = await res.json();
      setTestResults((prev) => ({ ...prev, [id]: { loading: false, result: json.result } }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { loading: false } }));
    }
  }

  function toggleEvent(eventValue: string) {
    setFormEvents((prev) =>
      prev.includes(eventValue)
        ? prev.filter((e) => e !== eventValue)
        : [...prev, eventValue],
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h2">集成管理</h2>
          <p className="text-muted-foreground">
            配置 Webhook 推送，对接外部系统
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              新建 Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "编辑 Webhook" : "新建 Webhook"}</DialogTitle>
              <DialogDescription>
                配置事件推送目标端点和订阅事件类型
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium">名称</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="如：飞书通知"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">目标 URL</label>
                <Input
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">签名密钥（可选）</label>
                <Input
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                  placeholder="HMAC-SHA256 签名密钥"
                  type="password"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">订阅事件</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EVENT_OPTIONS.map((opt) => (
                    <Badge
                      key={opt.value}
                      variant={formEvents.includes(opt.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleEvent(opt.value)}
                    >
                      {opt.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded"
                />
                <label className="text-sm">启用</label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!formName || !formUrl || formEvents.length === 0}
                >
                  {editingId ? "保存" : "创建"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Webhook list */}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            加载中...
          </CardContent>
        </Card>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Webhook className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>暂无 Webhook 配置</p>
            <p className="text-xs mt-1">点击「新建 Webhook」开始配置事件推送</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Webhook cards */}
          <div className="space-y-4">
            {webhooks.map((wh) => (
              <Card key={wh.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Webhook className="h-4 w-4" />
                      {wh.name}
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={wh.isActive ? "default" : "secondary"}>
                        {wh.isActive ? "启用" : "停用"}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    {wh.url}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {wh.events.map((event) => {
                      const opt = EVENT_OPTIONS.find((o) => o.value === event);
                      return (
                        <Badge key={event} variant="outline" className="text-xs">
                          {opt?.label ?? event}
                        </Badge>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(wh)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(wh.id)}
                      disabled={testResults[wh.id]?.loading}
                    >
                      {testResults[wh.id]?.loading ? (
                        <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <TestTube className="mr-1 h-3 w-3" />
                      )}
                      测试
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadLogs(wh.id)}
                    >
                      <Activity className="mr-1 h-3 w-3" />
                      日志
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive ml-auto"
                      onClick={() => handleDelete(wh.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Test result */}
                  {testResults[wh.id]?.result && (() => {
                    const r = testResults[wh.id]!.result!;
                    return (
                      <div className="flex items-center gap-2 text-xs">
                        {r.success ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-green-700">
                              成功 · HTTP {r.status} · {r.durationMs}ms
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                            <span className="text-red-700">
                              失败 · HTTP {r.status ?? "N/A"} · {r.durationMs}ms
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Delivery logs panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                推送日志
              </CardTitle>
              <CardDescription>
                {logsWebhookId ? `最近 50 条推送记录` : "选择一个 Webhook 查看日志"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!logsWebhookId ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  点击 Webhook 卡片上的「日志」按钮查看
                </div>
              ) : logsLoading ? (
                <div className="text-sm text-muted-foreground">加载中...</div>
              ) : logs.length === 0 ? (
                <div className="text-sm text-muted-foreground">暂无推送记录</div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between rounded-md border p-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        )}
                        <Badge variant="outline" className="text-xs">
                          {log.event}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          HTTP {log.responseStatus ?? "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{log.durationMs != null ? `${log.durationMs}ms` : ""}</span>
                        <span>#{log.attemptCount}</span>
                        <span>{new Date(log.createdAt).toLocaleString("zh-CN")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
