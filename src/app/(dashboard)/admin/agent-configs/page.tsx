"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  FileBarChart,
  FilePlus,
  FileSearch,
  FileText,
  Loader2,
  Scale,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelOption = {
  id: string;
  name: string;
  modelType: string;
  provider: string;
  isActive: boolean;
};

type AgentKB = {
  id: string;
  name: string;
  type: string;
};

type AgentRuleSet = {
  id: string;
  name: string;
  ruleCount: number;
};

type AgentConfig = {
  agentKey: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  model: {
    id: string;
    name: string;
    provider: string;
    modelType: string;
  } | null;
  knowledgeBases: AgentKB[];
  ruleSet: AgentRuleSet | null;
  customConfig: {
    temperature: number;
    maxTokens: number;
    [key: string]: unknown;
  };
};

type KnowledgeBase = {
  id: string;
  name: string;
  type: string;
};

type RuleSetOption = {
  id: string;
  name: string;
  ruleCount: number;
};

// Edit form state for a single agent
type EditForm = {
  modelId: string;
  knowledgeBaseIds: string[];
  ruleSetId: string;
  temperature: number;
  maxTokens: number;
};

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ReactNode> = {
  FileSearch: <FileSearch className="h-5 w-5" />,
  FilePlus: <FilePlus className="h-5 w-5" />,
  ShieldCheck: <ShieldCheck className="h-5 w-5" />,
  Crosshair: <Crosshair className="h-5 w-5" />,
  Scale: <Scale className="h-5 w-5" />,
  FileBarChart: <FileBarChart className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
};

const KB_TYPE_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  legal_regulation: {
    label: "法律法规库",
    badgeClass: "border-blue-300 text-blue-700 bg-blue-50",
  },
  bid_template: {
    label: "企业模板库",
    badgeClass: "border-purple-300 text-purple-700 bg-purple-50",
  },
  risk_item: {
    label: "风险项库",
    badgeClass: "border-orange-300 text-orange-700 bg-orange-50",
  },
  custom: {
    label: "自定义库",
    badgeClass: "border-gray-300 text-gray-700 bg-gray-50",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  parsing: "解析",
  generation: "生成",
  review: "审查",
  report: "报告",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgentConfigsPage() {
  const { data: session } = useSession();
  const orgId = (session?.user as { orgId?: string } | undefined)?.orgId;

  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [ruleSets, setRuleSets] = useState<RuleSetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded card state: agentKey -> expanded (boolean)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // Edit form state: agentKey -> form data
  const [editForms, setEditForms] = useState<Record<string, EditForm>>({});

  // Save state per agent
  const [savingAgent, setSavingAgent] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch all data
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);

    try {
      const [configsRes, modelsRes, kbRes, rsRes] = await Promise.all([
        fetch(`/api/admin/agent-configs?organizationId=${orgId}`, {
          cache: "no-store",
        }),
        fetch("/api/admin/models", { cache: "no-store" }),
        fetch("/api/admin/knowledge-bases", { cache: "no-store" }),
        fetch(`/api/admin/rule-sets?organizationId=${orgId}`, {
          cache: "no-store",
        }),
      ]);

      if (!configsRes.ok) throw new Error("Failed to fetch agent configs");
      if (!modelsRes.ok) throw new Error("Failed to fetch models");

      const configsJson = (await configsRes.json()) as { data: AgentConfig[] };
      const modelsJson = (await modelsRes.json()) as { data: ModelOption[] };
      const kbJson = (await kbRes.json()) as { data: KnowledgeBase[] };
      const rsJson = (await rsRes.json()) as {
        data: (RuleSetOption & { ruleCount?: number })[];
      };

      setConfigs(configsJson.data ?? []);
      setModels(modelsJson.data ?? []);
      setKnowledgeBases(kbJson.data ?? []);
      setRuleSets(
        (rsJson.data ?? []).map((rs) => ({
          id: rs.id,
          name: rs.name,
          ruleCount: rs.ruleCount ?? 0,
        }))
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load data"
      );
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Expand / collapse card
  // ---------------------------------------------------------------------------

  function handleExpand(agentKey: string) {
    if (expandedAgent === agentKey) {
      setExpandedAgent(null);
      return;
    }

    // Initialize edit form from current config
    const config = configs.find((c) => c.agentKey === agentKey);
    if (config) {
      setEditForms((prev) => ({
        ...prev,
        [agentKey]: {
          modelId: config.model?.id ?? "",
          knowledgeBaseIds: config.knowledgeBases.map((kb) => kb.id),
          ruleSetId: config.ruleSet?.id ?? "",
          temperature: config.customConfig?.temperature ?? 0.1,
          maxTokens: config.customConfig?.maxTokens ?? 4096,
        },
      }));
    }

    setExpandedAgent(agentKey);
    setSaveSuccess(null);
    setSaveError(null);
  }

  // ---------------------------------------------------------------------------
  // Update edit form
  // ---------------------------------------------------------------------------

  function updateForm(
    agentKey: string,
    field: keyof EditForm,
    value: string | number | string[]
  ) {
    setEditForms((prev) => ({
      ...prev,
      [agentKey]: {
        ...prev[agentKey],
        [field]: value,
      },
    }));
  }

  function toggleKB(agentKey: string, kbId: string) {
    const form = editForms[agentKey];
    if (!form) return;

    const current = form.knowledgeBaseIds;
    const updated = current.includes(kbId)
      ? current.filter((id) => id !== kbId)
      : [...current, kbId];

    updateForm(agentKey, "knowledgeBaseIds", updated);
  }

  // ---------------------------------------------------------------------------
  // Save config
  // ---------------------------------------------------------------------------

  async function handleSave(agentKey: string) {
    if (!orgId) return;
    const form = editForms[agentKey];
    if (!form) return;

    setSavingAgent(agentKey);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const res = await fetch(`/api/admin/agent-configs/${agentKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          knowledgeBaseIds: form.knowledgeBaseIds,
          ruleSetId: form.ruleSetId || null,
          customConfig: {
            temperature: form.temperature,
            maxTokens: form.maxTokens,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save config");
      }

      setSaveSuccess(agentKey);

      // Refresh data to reflect changes
      await fetchData();
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Failed to save config"
      );
    } finally {
      setSavingAgent(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Active models for dropdown
  // ---------------------------------------------------------------------------

  const activeModels = models.filter((m) => m.isActive);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-h2">智能体配置</h2>
        <p className="text-muted-foreground">
          配置各智能体的模型、知识库、规则集和参数
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      )}

      {/* Agent cards grid */}
      {!loading && configs.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {configs.map((config) => {
            const isExpanded = expandedAgent === config.agentKey;
            const form = editForms[config.agentKey];
            const isSaving = savingAgent === config.agentKey;
            const isSuccess = saveSuccess === config.agentKey;
            const isError = saveError && expandedAgent === config.agentKey;

            return (
              <Card key={config.agentKey} className="flex flex-col">
                {/* Card header - always visible */}
                <CardHeader
                  className="cursor-pointer select-none pb-3"
                  onClick={() => handleExpand(config.agentKey)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="font-mono text-xs px-2 py-0.5 shrink-0"
                      >
                        {config.agentKey}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {ICON_MAP[config.icon ?? ""] ?? (
                            <Settings2 className="h-5 w-5" />
                          )}
                        </span>
                        <CardTitle className="text-base">
                          {config.name}
                        </CardTitle>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  {config.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {config.description}
                    </p>
                  )}
                </CardHeader>

                {/* Card content - summary (collapsed) */}
                <CardContent className="pt-0 flex-1">
                  {/* Category badge */}
                  {config.category && (
                    <div className="mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORY_LABELS[config.category] ?? config.category}
                      </Badge>
                    </div>
                  )}

                  {/* Model tag */}
                  <div className="mb-2">
                    <span className="text-xs text-muted-foreground mr-1">
                      模型:
                    </span>
                    {config.model ? (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          config.model.modelType === "local"
                            ? "border-blue-300 text-blue-700 bg-blue-50"
                            : config.model.modelType === "cloud"
                              ? "border-green-300 text-green-700 bg-green-50"
                              : "border-gray-300 text-gray-700 bg-gray-50"
                        }`}
                      >
                        {config.model.name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        未绑定
                      </span>
                    )}
                  </div>

                  {/* Knowledge bases */}
                  <div className="mb-2">
                    <span className="text-xs text-muted-foreground mr-1">
                      知识库:
                    </span>
                    {config.knowledgeBases.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {config.knowledgeBases.map((kb) => (
                          <Badge
                            key={kb.id}
                            variant="outline"
                            className={`text-xs ${
                              KB_TYPE_CONFIG[kb.type]?.badgeClass ?? ""
                            }`}
                          >
                            {kb.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        无
                      </span>
                    )}
                  </div>

                  {/* Rule set */}
                  <div className="mb-2">
                    <span className="text-xs text-muted-foreground mr-1">
                      规则集:
                    </span>
                    {config.ruleSet ? (
                      <Badge variant="outline" className="text-xs">
                        {config.ruleSet.name} ({config.ruleSet.ruleCount}条规则)
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        无
                      </span>
                    )}
                  </div>

                  {/* Parameters */}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      Temperature:{" "}
                      <span className="font-medium text-foreground">
                        {config.customConfig?.temperature ?? 0.1}
                      </span>
                    </span>
                    <span>
                      MaxTokens:{" "}
                      <span className="font-medium text-foreground">
                        {config.customConfig?.maxTokens ?? 4096}
                      </span>
                    </span>
                  </div>
                </CardContent>

                {/* Expanded edit panel */}
                {isExpanded && form && (
                  <div className="border-t px-6 py-4 space-y-4 bg-muted/20">
                    {/* Model selection */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">
                        模型选择
                      </Label>
                      <Select
                        value={form.modelId || "__none__"}
                        onValueChange={(v) =>
                          updateForm(
                            config.agentKey,
                            "modelId",
                            v === "__none__" ? "" : v
                          )
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="选择模型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">
                              未选择
                            </span>
                          </SelectItem>
                          {activeModels.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`text-xs px-1.5 py-0 ${
                                    m.modelType === "local"
                                      ? "border-blue-300 text-blue-700"
                                      : m.modelType === "cloud"
                                        ? "border-green-300 text-green-700"
                                        : ""
                                  }`}
                                >
                                  {m.modelType === "local"
                                    ? "本地"
                                    : m.modelType === "cloud"
                                      ? "云端"
                                      : m.modelType}
                                </Badge>
                                {m.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Knowledge base association */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">
                        关联知识库
                      </Label>
                      {knowledgeBases.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          暂无知识库，请先创建
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {knowledgeBases.map((kb) => (
                            <label
                              key={kb.id}
                              className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5"
                            >
                              <Checkbox
                                checked={form.knowledgeBaseIds.includes(kb.id)}
                                onCheckedChange={() =>
                                  toggleKB(config.agentKey, kb.id)
                                }
                              />
                              <span className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={`text-xs px-1.5 py-0 ${
                                    KB_TYPE_CONFIG[kb.type]?.badgeClass ?? ""
                                  }`}
                                >
                                  {KB_TYPE_CONFIG[kb.type]?.label ?? kb.type}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {kb.name}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Rule set binding */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">
                        绑定规则集
                      </Label>
                      <Select
                        value={form.ruleSetId || "__none__"}
                        onValueChange={(v) =>
                          updateForm(
                            config.agentKey,
                            "ruleSetId",
                            v === "__none__" ? "" : v
                          )
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="选择规则集" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">
                              无规则集
                            </span>
                          </SelectItem>
                          {ruleSets.map((rs) => (
                            <SelectItem key={rs.id} value={rs.id}>
                              <span className="flex items-center gap-2">
                                {rs.name}
                                <span className="text-xs text-muted-foreground">
                                  ({rs.ruleCount}条)
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Parameter adjustment */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">
                          Temperature
                        </Label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.1}
                            value={form.temperature}
                            onChange={(e) =>
                              updateForm(
                                config.agentKey,
                                "temperature",
                                parseFloat(e.target.value)
                              )
                            }
                            className="flex-1 h-2 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
                          />
                          <span className="text-sm font-mono w-8 text-right">
                            {form.temperature.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">
                          MaxTokens
                        </Label>
                        <Input
                          type="number"
                          min={256}
                          max={32768}
                          step={256}
                          value={form.maxTokens}
                          onChange={(e) =>
                            updateForm(
                              config.agentKey,
                              "maxTokens",
                              parseInt(e.target.value) || 4096
                            )
                          }
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* Success / error messages */}
                    {isSuccess && (
                      <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 p-2 text-xs text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        配置已保存
                      </div>
                    )}
                    {isError && (
                      <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {saveError}
                      </div>
                    )}

                    {/* Save button */}
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleSave(config.agentKey)}
                        disabled={isSaving}
                      >
                        {isSaving && (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        )}
                        保存
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && configs.length === 0 && !error && (
        <div className="text-center py-16 text-muted-foreground">
          <Settings2 className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p>暂无智能体定义，请先运行 Seed 创建预设智能体</p>
        </div>
      )}
    </div>
  );
}
