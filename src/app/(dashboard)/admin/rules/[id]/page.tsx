"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RuleItem = {
  id: string;
  ruleNo: string;
  name: string;
  detectionType: "keyword" | "comparison" | "semantic" | "existence" | null;
  severity: string;
  description: string;
  isEnabled: boolean | null;
  sortOrder: number | null;
  isNew?: boolean;
  isDeleted?: boolean;
};

type AgentInfo = {
  agentKey: string;
  name: string;
} | null;

type RuleSetDetail = {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  agentId: string | null;
  agentInfo: AgentInfo;
  isActive: boolean | null;
  rules: RuleItem[];
};

// Editable row for local editing
type EditableRule = RuleItem & {
  // Local tracking
  _changed: boolean;
  _isNew: boolean;
  _deleted: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DETECTION_TYPE_OPTIONS = [
  { value: "keyword", label: "关键词检测" },
  { value: "comparison", label: "比较检测" },
  { value: "semantic", label: "语义检测" },
  { value: "existence", label: "存在性检测" },
] as const;

const SEVERITY_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  high: {
    label: "高",
    badgeClass: "border-red-300 text-red-700 bg-red-50",
  },
  medium: {
    label: "中",
    badgeClass: "border-yellow-300 text-yellow-700 bg-yellow-50",
  },
  low: {
    label: "低",
    badgeClass: "border-green-300 text-green-700 bg-green-50",
  },
};

function severityBadge(severity: string) {
  const config = SEVERITY_CONFIG[severity];
  if (!config) return <Badge variant="outline">{severity}</Badge>;
  return (
    <Badge variant="outline" className={config.badgeClass}>
      {config.label}
    </Badge>
  );
}

function nextRuleNo(rules: EditableRule[]): string {
  const existing = rules
    .filter((r) => !r._deleted)
    .map((r) => {
      const match = r.ruleNo.match(/R(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `R${String(max + 1).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RuleSetEditPage() {
  const params = useParams<{ id: string }>();
  const ruleSetId = params.id;

  const [detail, setDetail] = useState<RuleSetDetail | null>(null);
  const [rules, setRules] = useState<EditableRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Delete confirmation for individual rules
  const [deleteTarget, setDeleteTarget] = useState<EditableRule | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch rule set detail
  // ---------------------------------------------------------------------------

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/rule-sets/${ruleSetId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch rule set");
      }
      const json = (await res.json()) as { data: RuleSetDetail };
      const data = json.data;
      setDetail(data);
      setRules(
        (data.rules ?? []).map((r) => ({
          ...r,
          _changed: false,
          _isNew: false,
          _deleted: false,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rule set");
    } finally {
      setLoading(false);
    }
  }, [ruleSetId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  // ---------------------------------------------------------------------------
  // Update a rule field locally
  // ---------------------------------------------------------------------------

  function updateRuleField(
    ruleId: string,
    field: keyof EditableRule,
    value: unknown
  ) {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId ? { ...r, [field]: value, _changed: true } : r
      )
    );
    setSaveSuccess(false);
  }

  // ---------------------------------------------------------------------------
  // Add a new rule row
  // ---------------------------------------------------------------------------

  function handleAddRule() {
    const newRule: EditableRule = {
      id: `new-${Date.now()}`,
      ruleNo: nextRuleNo(rules),
      name: "",
      detectionType: null,
      severity: "medium",
      description: "",
      isEnabled: true,
      sortOrder: rules.filter((r) => !r._deleted).length,
      _changed: true,
      _isNew: true,
      _deleted: false,
    };
    setRules((prev) => [...prev, newRule]);
    setSaveSuccess(false);
  }

  // ---------------------------------------------------------------------------
  // Mark rule for deletion
  // ---------------------------------------------------------------------------

  function handleDeleteRule(rule: EditableRule) {
    if (rule._isNew) {
      // Remove new unsaved rules immediately
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } else {
      setRules((prev) =>
        prev.map((r) =>
          r.id === rule.id ? { ...r, _deleted: true } : r
        )
      );
    }
    setDeleteTarget(null);
    setSaveSuccess(false);
  }

  // ---------------------------------------------------------------------------
  // Save all changes
  // ---------------------------------------------------------------------------

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const activeRules = rules.filter((r) => !r._deleted);

      // 1. Create new rules
      const newRules = activeRules.filter((r) => r._isNew);
      for (const rule of newRules) {
        if (!rule.name.trim() || !rule.description.trim()) {
          setSaveError(
            `规则 ${rule.ruleNo} 的名称和描述不能为空`
          );
          setSaving(false);
          return;
        }
        const res = await fetch(
          `/api/admin/rule-sets/${ruleSetId}/rules`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ruleNo: rule.ruleNo.trim(),
              name: rule.name.trim(),
              detectionType: rule.detectionType,
              severity: rule.severity,
              description: rule.description.trim(),
              isEnabled: rule.isEnabled ?? true,
              sortOrder: rule.sortOrder ?? 0,
            }),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error || `Failed to create rule ${rule.ruleNo}`
          );
        }
      }

      // 2. Update changed existing rules
      const changedRules = activeRules.filter(
        (r) => r._changed && !r._isNew
      );
      for (const rule of changedRules) {
        if (!rule.name.trim() || !rule.description.trim()) {
          setSaveError(
            `规则 ${rule.ruleNo} 的名称和描述不能为空`
          );
          setSaving(false);
          return;
        }
        const res = await fetch(
          `/api/admin/rule-sets/${ruleSetId}/rules/${rule.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ruleNo: rule.ruleNo.trim(),
              name: rule.name.trim(),
              detectionType: rule.detectionType,
              severity: rule.severity,
              description: rule.description.trim(),
              isEnabled: rule.isEnabled ?? true,
              sortOrder: rule.sortOrder ?? 0,
            }),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error || `Failed to update rule ${rule.ruleNo}`
          );
        }
      }

      // 3. Delete removed rules
      const deletedRules = rules.filter((r) => r._deleted && !r._isNew);
      for (const rule of deletedRules) {
        const res = await fetch(
          `/api/admin/rule-sets/${ruleSetId}/rules/${rule.id}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error || `Failed to delete rule ${rule.ruleNo}`
          );
        }
      }

      setSaveSuccess(true);
      // Re-fetch to get fresh state with server-generated IDs
      await fetchDetail();
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Failed to save changes"
      );
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Active (non-deleted) rules for display
  // ---------------------------------------------------------------------------

  const displayRules = rules.filter((r) => !r._deleted);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/rules">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : detail ? (
        <>
          {/* Rule set header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-h2">{detail.name}</h2>
              {detail.description && (
                <p className="text-muted-foreground">{detail.description}</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                {detail.industry && (
                  <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">
                    {detail.industry}
                  </Badge>
                )}
                {detail.agentInfo && (
                  <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                    {detail.agentInfo.agentKey} - {detail.agentInfo.name}
                  </Badge>
                )}
                <Badge
                  variant={detail.isActive ? "default" : "outline"}
                  className={
                    detail.isActive
                      ? "border-green-300 text-green-700 bg-green-50"
                      : "border-gray-300 text-gray-500 bg-gray-50"
                  }
                >
                  {detail.isActive ? "启用" : "停用"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Rules editable table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">
                规则列表 ({displayRules.length})
              </h3>
              <Button size="sm" onClick={handleAddRule}>
                <Plus className="mr-1 h-4 w-4" />
                添加规则
              </Button>
            </div>

            <div className="rounded-lg border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-3 text-left font-medium text-muted-foreground w-[90px]">
                        规则编号
                      </th>
                      <th className="px-3 py-3 text-left font-medium text-muted-foreground w-[160px]">
                        名称
                      </th>
                      <th className="px-3 py-3 text-left font-medium text-muted-foreground w-[140px]">
                        检测类型
                      </th>
                      <th className="px-3 py-3 text-left font-medium text-muted-foreground w-[90px]">
                        严重等级
                      </th>
                      <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                        描述
                      </th>
                      <th className="px-3 py-3 text-center font-medium text-muted-foreground w-[70px]">
                        启用
                      </th>
                      <th className="px-3 py-3 text-right font-medium text-muted-foreground w-[70px]">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRules.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-muted-foreground"
                        >
                          暂无规则，点击「添加规则」开始
                        </td>
                      </tr>
                    ) : (
                      displayRules.map((rule, idx) => (
                        <tr
                          key={rule.id}
                          className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                            rule._isNew ? "bg-blue-50/30" : ""
                          }`}
                        >
                          <td className="px-3 py-2">
                            <Input
                              className="h-8 text-xs font-mono"
                              value={rule.ruleNo}
                              onChange={(e) =>
                                updateRuleField(
                                  rule.id,
                                  "ruleNo",
                                  e.target.value
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-8 text-xs"
                              value={rule.name}
                              placeholder="规则名称"
                              onChange={(e) =>
                                updateRuleField(
                                  rule.id,
                                  "name",
                                  e.target.value
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={rule.detectionType ?? "__none__"}
                              onValueChange={(v) =>
                                updateRuleField(
                                  rule.id,
                                  "detectionType",
                                  v === "__none__" ? null : v
                                )
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="选择类型" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">
                                  <span className="text-muted-foreground">
                                    未设置
                                  </span>
                                </SelectItem>
                                {DETECTION_TYPE_OPTIONS.map((opt) => (
                                  <SelectItem
                                    key={opt.value}
                                    value={opt.value}
                                  >
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={rule.severity}
                              onValueChange={(v) =>
                                updateRuleField(rule.id, "severity", v)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">
                                  <span className="text-red-600">高</span>
                                </SelectItem>
                                <SelectItem value="medium">
                                  <span className="text-yellow-600">中</span>
                                </SelectItem>
                                <SelectItem value="low">
                                  <span className="text-green-600">低</span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Textarea
                              className="min-h-[32px] resize-y text-xs"
                              rows={1}
                              value={rule.description}
                              placeholder="规则描述..."
                              onChange={(e) =>
                                updateRuleField(
                                  rule.id,
                                  "description",
                                  e.target.value
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 w-8 p-0 ${
                                rule.isEnabled
                                  ? "text-green-600 hover:text-green-700"
                                  : "text-gray-400 hover:text-gray-500"
                              }`}
                              onClick={() =>
                                updateRuleField(
                                  rule.id,
                                  "isEnabled",
                                  !rule.isEnabled
                                )
                              }
                              title={rule.isEnabled ? "点击禁用" : "点击启用"}
                            >
                              {rule.isEnabled ? "ON" : "OFF"}
                            </Button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(rule)}
                              title="删除规则"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Save success / error */}
          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              规则已保存
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {saveError}
            </div>
          )}

          {/* Save button */}
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
            <Link href="/admin/rules">
              <Button variant="outline" disabled={saving}>
                返回列表
              </Button>
            </Link>
          </div>
        </>
      ) : null}

      {/* Delete Rule Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认删除规则</DialogTitle>
            <DialogDescription>
              确定要删除规则「{deleteTarget?.ruleNo} - {deleteTarget?.name}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDeleteRule(deleteTarget)}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
