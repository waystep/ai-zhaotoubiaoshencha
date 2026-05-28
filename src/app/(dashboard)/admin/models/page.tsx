"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  Cloud,
  Cpu,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Server,
  Trash2,
  Wifi,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelItem = {
  id: string;
  name: string;
  modelType: "local" | "cloud" | "multimodal";
  provider: string;
  modelId: string;
  endpoint: string;
  apiKey: string | null;
  capabilities: string[] | null;
  costPerKInputTokens: number | null;
  costPerKOutputTokens: number | null;
  maxTokens: number | null;
  isActive: boolean;
  organizationId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type NewModelForm = {
  name: string;
  modelType: "local" | "cloud" | "multimodal";
  provider: string;
  modelId: string;
  endpoint: string;
  apiKey: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeBadgeVariant(
  type: string
): "default" | "secondary" | "outline" {
  switch (type) {
    case "local":
      return "secondary";
    case "cloud":
      return "default";
    case "multimodal":
      return "outline";
    default:
      return "secondary";
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "local":
      return "本地";
    case "cloud":
      return "云端";
    case "multimodal":
      return "多模态";
    default:
      return type;
  }
}

function typeIcon(type: string) {
  switch (type) {
    case "local":
      return <Server className="h-3.5 w-3.5" />;
    case "cloud":
      return <Cloud className="h-3.5 w-3.5" />;
    case "multimodal":
      return <Cpu className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  try {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

const EMPTY_FORM: NewModelForm = {
  name: "",
  modelType: "cloud",
  provider: "",
  modelId: "",
  endpoint: "",
  apiKey: "",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ModelListPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const orgId = (session?.user as { orgId?: string } | undefined)?.orgId;

  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");

  // Create model dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<NewModelForm>({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Testing states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    ok: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ModelItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch models
  // ---------------------------------------------------------------------------

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/models", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch models");
      }
      const json = (await res.json()) as { data: ModelItem[] };
      setModels(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  // ---------------------------------------------------------------------------
  // Filtered list
  // ---------------------------------------------------------------------------

  const filteredModels =
    activeTab === "all"
      ? models
      : models.filter((m) => m.modelType === activeTab);

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const localCount = models.filter((m) => m.modelType === "local").length;
  const cloudCount = models.filter(
    (m) => m.modelType === "cloud" || m.modelType === "multimodal"
  ).length;
  // Token usage placeholder — would need a real analytics endpoint
  const tokenUsage = "--";

  // ---------------------------------------------------------------------------
  // Create model
  // ---------------------------------------------------------------------------

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          organizationId: orgId ?? undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create model");
      }
      setDialogOpen(false);
      setCreateForm({ ...EMPTY_FORM });
      await fetchModels();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create model");
    } finally {
      setCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Test connection
  // ---------------------------------------------------------------------------

  async function handleTestConnection(modelId: string) {
    setTestingId(modelId);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/models/${modelId}/test`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        data: { ok: boolean; latencyMs?: number; error?: string };
      };
      setTestResult({
        id: modelId,
        ok: json.data.ok,
        latencyMs: json.data.latencyMs,
        error: json.data.error,
      });
    } catch (e) {
      setTestResult({
        id: modelId,
        ok: false,
        error: e instanceof Error ? e.message : "Test failed",
      });
    } finally {
      setTestingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Toggle active
  // ---------------------------------------------------------------------------

  async function handleToggleActive(model: ModelItem) {
    try {
      const res = await fetch(`/api/admin/models/${model.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !model.isActive }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to toggle model");
      }
      await fetchModels();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle model");
    }
  }

  // ---------------------------------------------------------------------------
  // Delete model
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/models/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete model");
      }
      setDeleteTarget(null);
      await fetchModels();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete model");
    } finally {
      setDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h2">模型管理</h2>
          <p className="text-muted-foreground">管理 AI 模型配置与连接</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          添加模型
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本地模型数</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-stat">{loading ? "--" : localCount}</div>
            <p className="text-xs text-muted-foreground">本地部署模型</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">云端模型数</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-stat">{loading ? "--" : cloudCount}</div>
            <p className="text-xs text-muted-foreground">云端 API / 多模态模型</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月 Token 消耗</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-stat">{tokenUsage}</div>
            <p className="text-xs text-muted-foreground">本月累计消耗</p>
          </CardContent>
        </Card>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Filter tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="local">本地</TabsTrigger>
          <TabsTrigger value="cloud">云端</TabsTrigger>
          <TabsTrigger value="multimodal">多模态</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Models table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">模型名称</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">类型</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Provider</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">创建时间</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    加载中...
                  </td>
                </tr>
              ) : filteredModels.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    {activeTab === "all" ? "暂无模型，点击上方「添加模型」开始" : `暂无${typeLabel(activeTab)}模型`}
                  </td>
                </tr>
              ) : (
                filteredModels.map((model) => (
                  <tr key={model.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-muted-foreground">{model.modelId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={typeBadgeVariant(model.modelType)} className="gap-1">
                        {typeIcon(model.modelType)}
                        {typeLabel(model.modelType)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{model.provider}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={model.isActive ? "default" : "outline"}
                        className={
                          model.isActive
                            ? "border-green-300 text-green-700 bg-green-50"
                            : "border-gray-300 text-gray-500 bg-gray-50"
                        }
                      >
                        {model.isActive ? "启用" : "停用"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(model.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Test result inline */}
                        {testResult?.id === model.id && (
                          testResult.ok ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 mr-1">
                              <Wifi className="h-3 w-3" />
                              {testResult.latencyMs}ms
                            </span>
                          ) : (
                            <span className="text-xs text-destructive mr-1" title={testResult.error}>
                              失败
                            </span>
                          )
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleTestConnection(model.id)}
                          disabled={testingId === model.id}
                          title="测试连接"
                        >
                          {testingId === model.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wifi className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleActive(model)}
                          title={model.isActive ? "停用" : "启用"}
                        >
                          {model.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Link href={`/admin/models/${model.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="编辑">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(model)}
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Model Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>添加模型</DialogTitle>
            <DialogDescription>配置新的 AI 模型连接信息</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-name">模型名称</Label>
              <Input
                id="create-name"
                placeholder="如：Qwen3 27B 本地"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-type">类型</Label>
              <Select
                value={createForm.modelType}
                onValueChange={(v) =>
                  setCreateForm((f) => ({
                    ...f,
                    modelType: v as NewModelForm["modelType"],
                  }))
                }
              >
                <SelectTrigger id="create-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">本地</SelectItem>
                  <SelectItem value="cloud">云端</SelectItem>
                  <SelectItem value="multimodal">多模态</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-provider">Provider</Label>
              <Input
                id="create-provider"
                placeholder="如：ollama / deepseek / zhipu"
                value={createForm.provider}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, provider: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-model-id">Model ID</Label>
              <Input
                id="create-model-id"
                placeholder="如：qwen3:27b"
                value={createForm.modelId}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, modelId: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-endpoint">Endpoint</Label>
              <Input
                id="create-endpoint"
                placeholder="如：http://localhost:11434/v1"
                value={createForm.endpoint}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, endpoint: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-api-key">API Key（可选）</Label>
              <Input
                id="create-api-key"
                type="password"
                placeholder="sk-..."
                value={createForm.apiKey}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, apiKey: e.target.value }))
                }
              />
            </div>

            {createError && (
              <div className="text-sm text-destructive">{createError}</div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除模型「{deleteTarget?.name}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
