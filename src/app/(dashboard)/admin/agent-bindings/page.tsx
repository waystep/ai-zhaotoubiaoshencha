"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Zap,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelOption = {
  id: string;
  name: string;
  modelType: string;
  isActive: boolean;
};

type AgentBinding = {
  agent: {
    id: string;
    agentKey: string;
    name: string;
    description: string | null;
    icon: string | null;
    category: string | null;
  };
  binding: {
    id: string;
    modelId: string;
    isPrimary: boolean;
  } | null;
  model: {
    id: string;
    name: string;
  } | null;
};

type PresetMode = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  bindings: Record<string, string>;
};

// Shape of our editable row state
type BindingRow = {
  agentKey: string;
  agentName: string;
  agentDescription: string;
  primaryModelId: string;
  fallbackModelId: string;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgentBindingsPage() {
  const { data: session } = useSession();
  const orgId = (session?.user as { orgId?: string } | undefined)?.orgId;

  const [models, setModels] = useState<ModelOption[]>([]);
  const [bindings, setBindings] = useState<BindingRow[]>([]);
  const [presetModes, setPresetModes] = useState<PresetMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [activatingModeId, setActivatingModeId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch data
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);

    try {
      const [modelsRes, bindingsRes, modesRes] = await Promise.all([
        fetch("/api/admin/models", { cache: "no-store" }),
        fetch(`/api/admin/agent-bindings?organizationId=${orgId}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin/preset-modes?organizationId=${orgId}`, {
          cache: "no-store",
        }),
      ]);

      if (!modelsRes.ok) throw new Error("Failed to fetch models");
      if (!bindingsRes.ok) throw new Error("Failed to fetch agent bindings");

      const modelsJson = (await modelsRes.json()) as { data: ModelOption[] };
      const bindingsJson = (await bindingsRes.json()) as {
        data: AgentBinding[];
      };
      const modesJson = (await modesRes.json()) as { data: PresetMode[] };

      const modelList = modelsJson.data ?? [];
      setModels(modelList);

      // Build binding rows
      const rows: BindingRow[] = (bindingsJson.data ?? []).map((b) => ({
        agentKey: b.agent.agentKey,
        agentName: b.agent.name,
        agentDescription: b.agent.description ?? "",
        primaryModelId: b.binding?.modelId ?? "",
        fallbackModelId: "",
      }));
      setBindings(rows);

      // Preset modes
      setPresetModes(modesJson.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Update binding row
  // ---------------------------------------------------------------------------

  function updateBindingRow(
    agentKey: string,
    field: "primaryModelId" | "fallbackModelId",
    value: string
  ) {
    setBindings((prev) =>
      prev.map((row) =>
        row.agentKey === agentKey ? { ...row, [field]: value } : row
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Activate preset mode
  // ---------------------------------------------------------------------------

  async function handleActivateMode(modeId: string) {
    if (!orgId) return;
    setActivatingModeId(modeId);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/admin/preset-modes/${modeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to activate preset mode");
      }

      // Refresh data to get updated bindings
      await fetchData();
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Failed to activate preset mode"
      );
    } finally {
      setActivatingModeId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Save bindings
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (!orgId) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Build updates map — include both primary and fallback where set
      const updates: Record<
        string,
        { modelId: string; isPrimary: boolean }
      > = {};

      for (const row of bindings) {
        if (row.primaryModelId) {
          updates[row.agentKey] = {
            modelId: row.primaryModelId,
            isPrimary: true,
          };
        }
      }

      if (Object.keys(updates).length === 0) {
        setSaveError("没有可保存的绑定配置");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/admin/agent-bindings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, updates }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save bindings");
      }

      setSaveSuccess(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save bindings");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Active models for dropdown (only active models)
  // ---------------------------------------------------------------------------

  const activeModels = models.filter((m) => m.isActive);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-h2">智能体模型绑定</h2>
        <p className="text-muted-foreground">
          为各智能体配置首选和备选模型
        </p>
      </div>

      {/* Preset mode switch */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">预设模式</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {presetModes.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground">
                暂无预设模式，请先通过 Seed 创建
              </p>
            ) : (
              presetModes.map((mode) => (
                <Button
                  key={mode.id}
                  variant={mode.isActive ? "default" : "outline"}
                  onClick={() => handleActivateMode(mode.id)}
                  disabled={activatingModeId !== null}
                  className="gap-2"
                >
                  {activatingModeId === mode.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode.name.includes("省钱") ? (
                    <Zap className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  {mode.name}
                  {mode.isActive && (
                    <Badge
                      variant="secondary"
                      className="ml-1 bg-green-100 text-green-700 border-green-300"
                    >
                      当前
                    </Badge>
                  )}
                </Button>
              ))
            )}
          </div>
          {presetModes.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              点击预设模式可一键切换所有智能体的模型绑定
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Agent bindings table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-[80px]">
                  编号
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  智能体名称
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  描述
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-[220px]">
                  当前首选模型
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-[220px]">
                  备选模型
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    加载中...
                  </td>
                </tr>
              ) : bindings.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    暂无智能体定义，请先运行 Seed 创建预设智能体
                  </td>
                </tr>
              ) : (
                bindings.map((row) => (
                  <tr
                    key={row.agentKey}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono">
                        {row.agentKey}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.agentName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.agentDescription}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={row.primaryModelId || "__none__"}
                        onValueChange={(v) =>
                          updateBindingRow(
                            row.agentKey,
                            "primaryModelId",
                            v === "__none__" ? "" : v
                          )
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="选择首选模型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">
                              未选择
                            </span>
                          </SelectItem>
                          {activeModels.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={row.fallbackModelId || "__none__"}
                        onValueChange={(v) =>
                          updateBindingRow(
                            row.agentKey,
                            "fallbackModelId",
                            v === "__none__" ? "" : v
                          )
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="选择备选模型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">
                              未选择
                            </span>
                          </SelectItem>
                          {activeModels.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save success / error */}
      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          配置已保存
        </div>
      )}

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {saveError}
        </div>
      )}

      {/* Save button */}
      {!loading && bindings.length > 0 && (
        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存配置
          </Button>
        </div>
      )}
    </div>
  );
}
