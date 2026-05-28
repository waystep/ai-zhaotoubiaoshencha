"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  Copy,
  Edit3,
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
import { Label } from "@/components/ui/label";
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

type AgentOption = {
  id: string;
  agentKey: string;
  agentName: string;
};

type RuleSetRow = {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  agentId: string | null;
  agentName: string | null;
  agentKey: string | null;
  isActive: boolean | null;
  ruleCount: number;
  organizationId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type CreateForm = {
  name: string;
  description: string;
  industry: string;
  agentId: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENT_OPTIONS: AgentOption[] = [
  { id: "", agentKey: "A1", agentName: "A1 - 招标文件解析" },
  { id: "", agentKey: "A2", agentName: "A2 - 资质审查" },
  { id: "", agentKey: "A3", agentName: "A3 - 技术方案评审" },
  { id: "", agentKey: "A4", agentName: "A4 - 商务报价分析" },
  { id: "", agentKey: "A5", agentName: "A5 - 合规性检查" },
  { id: "", agentKey: "A6", agentName: "A6 - 风险评估" },
  { id: "", agentKey: "A7", agentName: "A7 - 综合报告生成" },
];

const EMPTY_FORM: CreateForm = {
  name: "",
  description: "",
  industry: "",
  agentId: "__none__",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RuleSetListPage() {
  const { data: session } = useSession();
  const orgId = (session?.user as { orgId?: string } | undefined)?.orgId;

  const [sets, setSets] = useState<RuleSetRow[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<RuleSetRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Copy operation
  const [copying, setCopying] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch rule sets
  // ---------------------------------------------------------------------------

  const fetchSets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = orgId
        ? `/api/admin/rule-sets?organizationId=${orgId}`
        : "/api/admin/rule-sets";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch rule sets");
      }
      const json = (await res.json()) as { data: RuleSetRow[] };
      setSets(json.data ?? []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load rule sets"
      );
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // Fetch agents for dropdown
  const fetchAgents = useCallback(async () => {
    if (!orgId) {
      setAgents(AGENT_OPTIONS);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/agent-bindings?organizationId=${orgId}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = (await res.json()) as {
          data: { agent: { id: string; agentKey: string; name: string } }[];
        };
        const mapped: AgentOption[] = (json.data ?? []).map((b) => ({
          id: b.agent.id,
          agentKey: b.agent.agentKey,
          agentName: `${b.agent.agentKey} - ${b.agent.name}`,
        }));
        setAgents(mapped.length > 0 ? mapped : AGENT_OPTIONS);
      } else {
        setAgents(AGENT_OPTIONS);
      }
    } catch {
      setAgents(AGENT_OPTIONS);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchSets();
    void fetchAgents();
  }, [fetchSets, fetchAgents]);

  // ---------------------------------------------------------------------------
  // Create rule set
  // ---------------------------------------------------------------------------

  async function handleCreate() {
    if (!orgId) {
      setCreateError("缺少组织信息，无法创建");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/rule-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          description: createForm.description.trim() || null,
          industry: createForm.industry.trim() || null,
          agentId:
            createForm.agentId === "__none__" ? null : createForm.agentId,
          organizationId: orgId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create rule set");
      }
      setDialogOpen(false);
      setCreateForm({ ...EMPTY_FORM });
      await fetchSets();
    } catch (e) {
      setCreateError(
        e instanceof Error ? e.message : "Failed to create rule set"
      );
    } finally {
      setCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Copy rule set
  // ---------------------------------------------------------------------------

  async function handleCopy(set: RuleSetRow) {
    if (!orgId) return;
    setCopying(true);
    try {
      // Create a copy of the rule set
      const res = await fetch("/api/admin/rule-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${set.name} (副本)`,
          description: set.description,
          industry: set.industry,
          agentId: set.agentId,
          organizationId: orgId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to copy rule set");
      }

      // Copy rules from the original set
      const detailRes = await fetch(`/api/admin/rule-sets/${set.id}`);
      if (detailRes.ok) {
        const detailJson = (await detailRes.json()) as {
          data: { rules: { ruleNo: string; name: string; detectionType: string | null; severity: string; description: string; isEnabled: boolean | null; sortOrder: number | null }[] };
        };
        const rules = detailJson.data?.rules ?? [];
        const created = (await res.json()) as { data: { id: string } };

        for (const rule of rules) {
          await fetch(`/api/admin/rule-sets/${created.data.id}/rules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ruleNo: rule.ruleNo,
              name: rule.name,
              detectionType: rule.detectionType,
              severity: rule.severity,
              description: rule.description,
              isEnabled: rule.isEnabled ?? true,
              sortOrder: rule.sortOrder ?? 0,
            }),
          });
        }
      }

      await fetchSets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to copy rule set");
    } finally {
      setCopying(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete rule set
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/rule-sets/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete rule set");
      }
      setDeleteTarget(null);
      await fetchSets();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to delete rule set"
      );
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
          <h2 className="text-h2">规则集管理</h2>
          <p className="text-muted-foreground">
            管理审查规则集，关联行业和智能体
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          创建规则集
        </Button>
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        共 {sets.length} 个规则集
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Rule sets table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  规则集名称
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  适用行业
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  关联智能体
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  规则数量
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  状态
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    加载中...
                  </td>
                </tr>
              ) : sets.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    暂无规则集，点击上方「创建规则集」开始
                  </td>
                </tr>
              ) : (
                sets.map((rs) => (
                  <tr
                    key={rs.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{rs.name}</div>
                      {rs.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {rs.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {rs.industry || "--"}
                    </td>
                    <td className="px-4 py-3">
                      {rs.agentKey ? (
                        <Badge
                          variant="outline"
                          className="border-blue-300 text-blue-700 bg-blue-50"
                        >
                          {rs.agentKey}
                          {rs.agentName ? ` - ${rs.agentName}` : ""}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">未关联</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {rs.ruleCount}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={rs.isActive ? "default" : "outline"}
                        className={
                          rs.isActive
                            ? "border-green-300 text-green-700 bg-green-50"
                            : "border-gray-300 text-gray-500 bg-gray-50"
                        }
                      >
                        {rs.isActive ? "启用" : "停用"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/rules/${rs.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1"
                            title="编辑规则"
                          >
                            <Edit3 className="h-4 w-4" />
                            编辑
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1"
                          title="复制规则集"
                          disabled={copying}
                          onClick={() => void handleCopy(rs)}
                        >
                          <Copy className="h-4 w-4" />
                          复制
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(rs)}
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

      {/* Create Rule Set Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>创建规则集</DialogTitle>
            <DialogDescription>创建新的规则集以管理审查规则</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-name">名称</Label>
              <Input
                id="create-name"
                placeholder="如：建筑工程审查规则集"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-industry">适用行业</Label>
              <Input
                id="create-industry"
                placeholder="如：建筑工程、市政工程"
                value={createForm.industry}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, industry: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-agent">关联智能体</Label>
              <Select
                value={createForm.agentId}
                onValueChange={(v) =>
                  setCreateForm((f) => ({ ...f, agentId: v }))
                }
              >
                <SelectTrigger id="create-agent">
                  <SelectValue placeholder="选择关联智能体" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">不关联</span>
                  </SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.agentKey} value={a.id || a.agentKey}>
                      {a.agentName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-desc">描述</Label>
              <Textarea
                id="create-desc"
                placeholder="简要描述该规则集的用途..."
                rows={3}
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
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
              确定要删除规则集「{deleteTarget?.name}」吗？该规则集下的所有规则将一并删除，此操作不可撤销。
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
