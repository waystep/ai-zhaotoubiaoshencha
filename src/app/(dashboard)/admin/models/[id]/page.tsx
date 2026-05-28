"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelData = {
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

type FormData = {
  name: string;
  modelType: "local" | "cloud" | "multimodal";
  provider: string;
  modelId: string;
  endpoint: string;
  apiKey: string;
  capabilities: string[];
  costPerKInputTokens: string;
  costPerKOutputTokens: string;
  maxTokens: string;
};

const CAPABILITY_OPTIONS = [
  { value: "text", label: "文本生成" },
  { value: "vision", label: "图像理解" },
  { value: "reasoning", label: "推理" },
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ModelEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const modelId = params.id;

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    name: "",
    modelType: "cloud",
    provider: "",
    modelId: "",
    endpoint: "",
    apiKey: "",
    capabilities: [],
    costPerKInputTokens: "",
    costPerKOutputTokens: "",
    maxTokens: "4096",
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  const [showApiKey, setShowApiKey] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch model data
  // ---------------------------------------------------------------------------

  const fetchModel = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/admin/models/${modelId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch model");
      }
      const json = (await res.json()) as { data: ModelData };
      const m = json.data;
      setForm({
        name: m.name,
        modelType: m.modelType,
        provider: m.provider,
        modelId: m.modelId,
        endpoint: m.endpoint,
        apiKey: "", // Never prefill API key from server (masked)
        capabilities: m.capabilities ?? [],
        costPerKInputTokens:
          m.costPerKInputTokens != null ? String(m.costPerKInputTokens) : "",
        costPerKOutputTokens:
          m.costPerKOutputTokens != null ? String(m.costPerKOutputTokens) : "",
        maxTokens: m.maxTokens != null ? String(m.maxTokens) : "4096",
      });
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load model");
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    void fetchModel();
  }, [fetchModel]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleCapability(cap: string, checked: boolean) {
    setForm((f) => ({
      ...f,
      capabilities: checked
        ? [...f.capabilities, cap]
        : f.capabilities.filter((c) => c !== cap),
    }));
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        modelType: form.modelType,
        provider: form.provider.trim(),
        modelId: form.modelId.trim(),
        endpoint: form.endpoint.trim(),
        capabilities: form.capabilities.length > 0 ? form.capabilities : null,
        maxTokens: form.maxTokens ? parseInt(form.maxTokens, 10) : null,
      };

      if (form.costPerKInputTokens) {
        body.costPerKInputTokens = parseFloat(form.costPerKInputTokens);
      }
      if (form.costPerKOutputTokens) {
        body.costPerKOutputTokens = parseFloat(form.costPerKOutputTokens);
      }

      // Only send apiKey if user entered a new one
      if (form.apiKey.trim()) {
        body.apiKey = form.apiKey.trim();
      }

      const res = await fetch(`/api/admin/models/${modelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save model");
      }

      setSaveSuccess(true);
      // Clear apiKey field after save
      setForm((f) => ({ ...f, apiKey: "" }));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save model");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Test connection
  // ---------------------------------------------------------------------------

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/models/${modelId}/test`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        data: { ok: boolean; latencyMs?: number; error?: string };
      };
      setTestResult(json.data);
    } catch (e) {
      setTestResult({
        ok: false,
        error: e instanceof Error ? e.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/models"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回模型列表
        </Link>
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {fetchError}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/models"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回模型列表
      </Link>

      {/* Page header */}
      <div>
        <h2 className="text-h2">编辑模型</h2>
        <p className="text-muted-foreground">修改模型配置与参数</p>
      </div>

      {/* Form card */}
      <Card>
        <CardHeader>
          <CardTitle>模型配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* 模型名称 */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">模型名称</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="输入模型名称"
              />
            </div>

            {/* 类型 */}
            <div className="space-y-2">
              <Label htmlFor="edit-type">类型</Label>
              <Select
                value={form.modelType}
                onValueChange={(v) =>
                  updateField("modelType", v as FormData["modelType"])
                }
              >
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">本地</SelectItem>
                  <SelectItem value="cloud">云端</SelectItem>
                  <SelectItem value="multimodal">多模态</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Provider */}
            <div className="space-y-2">
              <Label htmlFor="edit-provider">Provider</Label>
              <Input
                id="edit-provider"
                value={form.provider}
                onChange={(e) => updateField("provider", e.target.value)}
                placeholder="如：ollama / deepseek / zhipu"
              />
            </div>

            {/* Model ID */}
            <div className="space-y-2">
              <Label htmlFor="edit-model-id">Model ID</Label>
              <Input
                id="edit-model-id"
                value={form.modelId}
                onChange={(e) => updateField("modelId", e.target.value)}
                placeholder="如：qwen3:27b"
              />
            </div>

            {/* Endpoint */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-endpoint">Endpoint</Label>
              <Input
                id="edit-endpoint"
                value={form.endpoint}
                onChange={(e) => updateField("endpoint", e.target.value)}
                placeholder="如：http://localhost:11434/v1"
              />
            </div>

            {/* API Key */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-api-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={form.apiKey}
                  onChange={(e) => updateField("apiKey", e.target.value)}
                  placeholder="留空则保持不变"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="shrink-0"
                >
                  {showApiKey ? "隐藏" : "显示"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                服务器存储的密钥已脱敏，输入新值可覆盖
              </p>
            </div>

            {/* 能力标签 */}
            <div className="space-y-2 md:col-span-2">
              <Label>能力标签</Label>
              <div className="flex gap-6">
                {CAPABILITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={form.capabilities.includes(opt.value)}
                      onCheckedChange={(checked) =>
                        toggleCapability(opt.value, !!checked)
                      }
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 费用 */}
            <div className="space-y-2">
              <Label htmlFor="edit-cost-input">输入费用（每 K tokens）</Label>
              <Input
                id="edit-cost-input"
                type="number"
                step="0.001"
                min="0"
                value={form.costPerKInputTokens}
                onChange={(e) =>
                  updateField("costPerKInputTokens", e.target.value)
                }
                placeholder="0.000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-cost-output">输出费用（每 K tokens）</Label>
              <Input
                id="edit-cost-output"
                type="number"
                step="0.001"
                min="0"
                value={form.costPerKOutputTokens}
                onChange={(e) =>
                  updateField("costPerKOutputTokens", e.target.value)
                }
                placeholder="0.000"
              />
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <Label htmlFor="edit-max-tokens">Max Tokens</Label>
              <Input
                id="edit-max-tokens"
                type="number"
                min="1"
                value={form.maxTokens}
                onChange={(e) => updateField("maxTokens", e.target.value)}
                placeholder="4096"
              />
            </div>
          </div>

          {/* Test connection result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                testResult.ok
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-red-300 bg-red-50 text-red-700"
              }`}
            >
              {testResult.ok ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  连接成功，延迟 {testResult.latencyMs}ms
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  连接失败：{testResult.error || "未知错误"}
                </>
              )}
            </div>
          )}

          {/* Save success / error */}
          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              保存成功
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {saveError}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              测试连接
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push("/admin/models")}
            >
              返回
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
