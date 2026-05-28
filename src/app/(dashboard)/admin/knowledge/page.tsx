"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  BookOpen,
  FileText,
  Loader2,
  Plus,
  Shield,
  Trash2,
  ChevronRight,
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
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KnowledgeBase = {
  id: string;
  name: string;
  type: "legal_regulation" | "bid_template" | "risk_item" | "custom";
  description: string | null;
  icon: string | null;
  organizationId: string;
  isActive: boolean | null;
  documentCount: number | null;
  totalChunks: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  stats?: {
    itemCount: number;
    vectorizedCount: number;
    totalChunks: number;
    coverage: number;
  };
};

type NewKBForm = {
  name: string;
  type: "legal_regulation" | "bid_template" | "risk_item" | "custom";
  description: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KB_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; badgeClass: string }
> = {
  legal_regulation: {
    label: "法律法规库",
    icon: <BookOpen className="h-3.5 w-3.5" />,
    badgeClass: "border-blue-300 text-blue-700 bg-blue-50",
  },
  bid_template: {
    label: "企业模板库",
    icon: <FileText className="h-3.5 w-3.5" />,
    badgeClass: "border-purple-300 text-purple-700 bg-purple-50",
  },
  risk_item: {
    label: "风险项库",
    icon: <Shield className="h-3.5 w-3.5" />,
    badgeClass: "border-orange-300 text-orange-700 bg-orange-50",
  },
  custom: {
    label: "自定义库",
    icon: <Plus className="h-3.5 w-3.5" />,
    badgeClass: "border-gray-300 text-gray-700 bg-gray-50",
  },
};

function typeLabel(type: string): string {
  return KB_TYPE_CONFIG[type]?.label ?? type;
}

function typeBadge(type: string) {
  const config = KB_TYPE_CONFIG[type];
  if (!config) return <Badge variant="secondary">{type}</Badge>;
  return (
    <Badge variant="outline" className={`gap-1 ${config.badgeClass}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
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

const EMPTY_FORM: NewKBForm = {
  name: "",
  type: "legal_regulation",
  description: "",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KnowledgeBaseListPage() {
  const { data: session } = useSession();
  const orgId = (session?.user as { orgId?: string } | undefined)?.orgId;

  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<NewKBForm>({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBase | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch knowledge bases
  // ---------------------------------------------------------------------------

  const fetchBases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/knowledge-bases", {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch knowledge bases");
      }
      const json = (await res.json()) as { data: KnowledgeBase[] };
      setBases(json.data ?? []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load knowledge bases"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBases();
  }, [fetchBases]);

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const legalCount = bases.filter((b) => b.type === "legal_regulation").length;
  const templateCount = bases.filter((b) => b.type === "bid_template").length;
  const riskCount = bases.filter((b) => b.type === "risk_item").length;
  const customCount = bases.filter((b) => b.type === "custom").length;

  const totalItems = bases.reduce(
    (sum, b) => sum + (b.stats?.itemCount ?? b.documentCount ?? 0),
    0
  );

  // ---------------------------------------------------------------------------
  // Create knowledge base
  // ---------------------------------------------------------------------------

  async function handleCreate() {
    if (!orgId) {
      setCreateError("缺少组织信息，无法创建");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          type: createForm.type,
          description: createForm.description.trim() || null,
          organizationId: orgId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create knowledge base");
      }
      setDialogOpen(false);
      setCreateForm({ ...EMPTY_FORM });
      await fetchBases();
    } catch (e) {
      setCreateError(
        e instanceof Error ? e.message : "Failed to create knowledge base"
      );
    } finally {
      setCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete knowledge base
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/knowledge-bases/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete knowledge base");
      }
      setDeleteTarget(null);
      await fetchBases();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to delete knowledge base"
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
          <h2 className="text-h2">知识库管理</h2>
          <p className="text-muted-foreground">管理法律法规、模板、风险项等知识库</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          创建知识库
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">法律法规库</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-stat">{loading ? "--" : legalCount}</div>
            <p className="text-xs text-muted-foreground">法律、法规、规范</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">企业模板库</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-stat">{loading ? "--" : templateCount}</div>
            <p className="text-xs text-muted-foreground">招标文件模板</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">风险项库</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-stat">{loading ? "--" : riskCount}</div>
            <p className="text-xs text-muted-foreground">常见风险条目</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">自定义库</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-stat">{loading ? "--" : customCount}</div>
            <p className="text-xs text-muted-foreground">用户自定义知识库</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary stat */}
      <div className="text-sm text-muted-foreground">
        共 {bases.length} 个知识库，{totalItems} 个条目
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Knowledge bases table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  名称
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  类型
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  条目数
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  向量化进度
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
              ) : bases.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    暂无知识库，点击上方「创建知识库」开始
                  </td>
                </tr>
              ) : (
                bases.map((kb) => {
                  const stats = kb.stats;
                  const itemCount =
                    stats?.itemCount ?? kb.documentCount ?? 0;
                  const vectorizedCount = stats?.vectorizedCount ?? 0;
                  const coverage = stats?.coverage ?? 0;

                  return (
                    <tr
                      key={kb.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{kb.name}</div>
                        {kb.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {kb.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{typeBadge(kb.type)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {itemCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(coverage, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {vectorizedCount}/{itemCount} ({coverage}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={kb.isActive ? "default" : "outline"}
                          className={
                            kb.isActive
                              ? "border-green-300 text-green-700 bg-green-50"
                              : "border-gray-300 text-gray-500 bg-gray-50"
                          }
                        >
                          {kb.isActive ? "启用" : "停用"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/knowledge/${kb.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1"
                              title="进入详情"
                            >
                              <ChevronRight className="h-4 w-4" />
                              详情
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(kb)}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Knowledge Base Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>创建知识库</DialogTitle>
            <DialogDescription>创建新的知识库以管理分类知识条目</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-name">名称</Label>
              <Input
                id="create-name"
                placeholder="如：招标投标法知识库"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-type">类型</Label>
              <Select
                value={createForm.type}
                onValueChange={(v) =>
                  setCreateForm((f) => ({
                    ...f,
                    type: v as NewKBForm["type"],
                  }))
                }
              >
                <SelectTrigger id="create-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="legal_regulation">法律法规库</SelectItem>
                  <SelectItem value="bid_template">企业模板库</SelectItem>
                  <SelectItem value="risk_item">风险项库</SelectItem>
                  <SelectItem value="custom">自定义库</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-desc">描述</Label>
              <Textarea
                id="create-desc"
                placeholder="简要描述该知识库的用途..."
                rows={3}
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, description: e.target.value }))
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
              确定要删除知识库「{deleteTarget?.name}」吗？该知识库下的所有条目和向量数据将一并删除，此操作不可撤销。
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
