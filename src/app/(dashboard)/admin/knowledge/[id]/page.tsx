"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
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
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KnowledgeBase = {
  id: string;
  name: string;
  type: "legal_regulation" | "bid_template" | "risk_item" | "custom";
  description: string | null;
  isActive: boolean | null;
  documentCount: number | null;
  totalChunks: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  stats: {
    itemCount: number;
    vectorizedCount: number;
    totalChunks: number;
    coverage: number;
  };
};

type KnowledgeItem = {
  id: string;
  knowledgeBaseId: string;
  title: string | null;
  content: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
  tags: string[] | null;
  isVectorized: boolean | null;
  chunkCount: number | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type SearchResult = {
  itemId: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
};

type NewItemForm = {
  title: string;
  content: string;
  tags: string;
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

const EMPTY_ITEM_FORM: NewItemForm = {
  title: "",
  content: "",
  tags: "",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KnowledgeBaseDetailPage() {
  const params = useParams<{ id: string }>();
  const kbId = params.id;

  // Base data
  const [base, setBase] = useState<KnowledgeBase | null>(null);
  const [loadingBase, setLoadingBase] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Items list
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsPage, setItemsPage] = useState(1);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  // Add item dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addItemForm, setAddItemForm] = useState<NewItemForm>({
    ...EMPTY_ITEM_FORM,
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit item dialog
  const [editTarget, setEditTarget] = useState<KnowledgeItem | null>(null);
  const [editForm, setEditForm] = useState<NewItemForm>({
    ...EMPTY_ITEM_FORM,
  });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Batch vectorize
  const [vectorizing, setVectorizing] = useState(false);
  const [vectorizeResult, setVectorizeResult] = useState<string | null>(null);

  // Semantic search test
  const [searchTestOpen, setSearchTestOpen] = useState(false);
  const [searchTestQuery, setSearchTestQuery] = useState("");
  const [searchTestResults, setSearchTestResults] = useState<SearchResult[]>(
    []
  );
  const [searchTesting, setSearchTesting] = useState(false);
  const [searchTestError, setSearchTestError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch base data
  // ---------------------------------------------------------------------------

  const fetchBase = useCallback(async () => {
    setLoadingBase(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/admin/knowledge-bases/${kbId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch knowledge base");
      }
      const json = (await res.json()) as { data: KnowledgeBase };
      setBase(json.data);
    } catch (e) {
      setFetchError(
        e instanceof Error ? e.message : "Failed to load knowledge base"
      );
    } finally {
      setLoadingBase(false);
    }
  }, [kbId]);

  // ---------------------------------------------------------------------------
  // Fetch items
  // ---------------------------------------------------------------------------

  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const params = new URLSearchParams({
        page: String(itemsPage),
        pageSize: "20",
      });
      const res = await fetch(
        `/api/admin/knowledge-bases/${kbId}/items?${params}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch items");
      }
      const json = (await res.json()) as {
        data: KnowledgeItem[];
        total: number;
        page: number;
        pageSize: number;
      };
      setItems(json.data ?? []);
      setItemsTotal(json.total);
    } catch (e) {
      console.error("Failed to fetch items:", e);
    } finally {
      setLoadingItems(false);
    }
  }, [kbId, itemsPage]);

  useEffect(() => {
    void fetchBase();
  }, [fetchBase]);

  useEffect(() => {
    if (!fetchError) {
      void fetchItems();
    }
  }, [fetchItems, fetchError]);

  // ---------------------------------------------------------------------------
  // Filtered items
  // ---------------------------------------------------------------------------

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      (item.title ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag =
      !tagFilter ||
      (item.tags ?? []).some((t) =>
        t.toLowerCase().includes(tagFilter.toLowerCase())
      );

    return matchesSearch && matchesTag;
  });

  // ---------------------------------------------------------------------------
  // Collect all unique tags for filter
  // ---------------------------------------------------------------------------

  const allTags = Array.from(
    new Set(items.flatMap((item) => item.tags ?? []))
  ).sort();

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  const totalPages = Math.ceil(itemsTotal / 20);

  // ---------------------------------------------------------------------------
  // Add item
  // ---------------------------------------------------------------------------

  async function handleAddItem() {
    setAdding(true);
    setAddError(null);
    try {
      const body: Record<string, unknown> = {
        content: addItemForm.content.trim(),
      };
      if (addItemForm.title.trim()) {
        body.title = addItemForm.title.trim();
      }
      if (addItemForm.tags.trim()) {
        body.tags = addItemForm.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }

      const res = await fetch(`/api/admin/knowledge-bases/${kbId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add item");
      }
      setAddDialogOpen(false);
      setAddItemForm({ ...EMPTY_ITEM_FORM });
      await Promise.all([fetchItems(), fetchBase()]);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add item");
    } finally {
      setAdding(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Edit item
  // ---------------------------------------------------------------------------

  function openEditDialog(item: KnowledgeItem) {
    setEditTarget(item);
    setEditForm({
      title: item.title ?? "",
      content: item.content,
      tags: (item.tags ?? []).join(", "),
    });
    setEditError(null);
  }

  async function handleEditItem() {
    if (!editTarget) return;
    setEditing(true);
    setEditError(null);
    try {
      const body: Record<string, unknown> = {
        title: editForm.title.trim() || null,
        content: editForm.content.trim(),
      };
      if (editForm.tags.trim()) {
        body.tags = editForm.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }

      const res = await fetch(
        `/api/admin/knowledge-bases/${kbId}/items/${editTarget.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update item");
      }
      setEditTarget(null);
      await Promise.all([fetchItems(), fetchBase()]);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to update item");
    } finally {
      setEditing(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete item
  // ---------------------------------------------------------------------------

  async function handleDeleteItem() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/knowledge-bases/${kbId}/items/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete item");
      }
      setDeleteTarget(null);
      await Promise.all([fetchItems(), fetchBase()]);
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Batch vectorize
  // ---------------------------------------------------------------------------

  async function handleBatchVectorize() {
    setVectorizing(true);
    setVectorizeResult(null);
    try {
      // Find all unvectorized items
      const unvectorized = items.filter(
        (item) => !item.isVectorized
      );

      if (unvectorized.length === 0) {
        setVectorizeResult("所有条目已向量化，无需操作");
        setVectorizing(false);
        return;
      }

      let processed = 0;
      const errors: string[] = [];

      for (const item of unvectorized) {
        try {
          const res = await fetch(
            `/api/admin/knowledge-bases/${kbId}/items/${item.id}/vectorize`,
            { method: "POST" }
          );
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            errors.push(`${item.title ?? item.id}: ${body.error ?? "Failed"}`);
          } else {
            processed++;
          }
        } catch (e) {
          errors.push(
            `${item.title ?? item.id}: ${e instanceof Error ? e.message : "Error"}`
          );
        }
      }

      if (errors.length > 0) {
        setVectorizeResult(
          `完成 ${processed}/${unvectorized.length} 条，${errors.length} 条失败: ${errors.slice(0, 3).join("; ")}`
        );
      } else {
        setVectorizeResult(
          `成功向量化 ${processed} 个条目`
        );
      }

      await Promise.all([fetchItems(), fetchBase()]);
    } catch (e) {
      setVectorizeResult(
        `批量向量化失败: ${e instanceof Error ? e.message : "Unknown error"}`
      );
    } finally {
      setVectorizing(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Semantic search test
  // ---------------------------------------------------------------------------

  async function handleSearchTest() {
    if (!searchTestQuery.trim()) return;
    setSearchTesting(true);
    setSearchTestError(null);
    setSearchTestResults([]);
    try {
      const res = await fetch(`/api/admin/knowledge-bases/${kbId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchTestQuery.trim(), topK: 5 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Search failed");
      }
      const json = (await res.json()) as { data: SearchResult[] };
      setSearchTestResults(json.data ?? []);
    } catch (e) {
      setSearchTestError(
        e instanceof Error ? e.message : "Search test failed"
      );
    } finally {
      setSearchTesting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loadingBase) {
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
          href="/admin/knowledge"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回知识库列表
        </Link>
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {fetchError}
        </div>
      </div>
    );
  }

  if (!base) return null;

  const stats = base.stats;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/knowledge"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回知识库列表
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-h2">{base.name}</h2>
          {typeBadge(base.type)}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            添加条目
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchVectorize}
            disabled={vectorizing}
          >
            {vectorizing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Database className="mr-2 h-4 w-4" />
            )}
            批量向量化
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchTestOpen(true)}
          >
            <Search className="mr-2 h-4 w-4" />
            语义搜索测试
          </Button>
        </div>
      </div>

      {/* Vectorize result */}
      {vectorizeResult && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-4 text-sm ${
            vectorizeResult.includes("失败")
              ? "border-orange-300 bg-orange-50 text-orange-700"
              : "border-green-300 bg-green-50 text-green-700"
          }`}
        >
          {vectorizeResult.includes("失败") ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          {vectorizeResult}
          <button
            onClick={() => setVectorizeResult(null)}
            className="ml-auto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">条目总数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-stat">{stats.itemCount}</div>
            <p className="text-xs text-muted-foreground">
              知识条目数量
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已向量化</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-stat">
              {stats.vectorizedCount}
              <span className="text-sm font-normal text-muted-foreground">
                /{stats.totalChunks} chunks
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              向量化条目数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">覆盖率</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-stat">{stats.coverage}%</div>
            <p className="text-xs text-muted-foreground">
              条目向量化覆盖率
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {base.description && (
        <p className="text-sm text-muted-foreground">{base.description}</p>
      )}

      {/* Main content: items list */}
      <div className="space-y-4">
        {/* Search & filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="搜索条目标题或内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sm:max-w-[300px]"
          />
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">标签:</span>
              <Button
                variant={tagFilter === "" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setTagFilter("")}
              >
                全部
              </Button>
              {allTags.slice(0, 8).map((tag) => (
                <Button
                  key={tag}
                  variant={tagFilter === tag ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setTagFilter(tagFilter === tag ? "" : tag)
                  }
                >
                  {tag}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Items table */}
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    标题
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    内容摘要
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    标签
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    向量化
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingItems ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      加载中...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      {searchQuery || tagFilter
                        ? "没有匹配的条目"
                        : "暂无条目，点击「添加条目」开始"}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {item.title ?? (
                            <span className="text-muted-foreground italic">
                              无标题
                            </span>
                          )}
                        </div>
                        {item.source && (
                          <div className="text-xs text-muted-foreground">
                            来源: {item.source}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[300px] truncate text-muted-foreground">
                          {item.content.substring(0, 120)}
                          {item.content.length > 120 ? "..." : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(item.tags ?? []).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={item.isVectorized ? "default" : "outline"}
                          className={
                            item.isVectorized
                              ? "border-green-300 text-green-700 bg-green-50"
                              : "border-gray-300 text-gray-500 bg-gray-50"
                          }
                        >
                          {item.isVectorized
                            ? `已完成 (${item.chunkCount ?? 0} chunks)`
                            : "未处理"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(item)}
                            title="编辑"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          {!item.isVectorized && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={async () => {
                                try {
                                  await fetch(
                                    `/api/admin/knowledge-bases/${kbId}/items/${item.id}/vectorize`,
                                    { method: "POST" }
                                  );
                                  await Promise.all([fetchItems(), fetchBase()]);
                                } catch (e) {
                                  console.error("Vectorize failed:", e);
                                }
                              }}
                              title="向量化"
                            >
                              <Database className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(item)}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              共 {itemsTotal} 条，第 {itemsPage}/{totalPages} 页
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={itemsPage <= 1}
                onClick={() => setItemsPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={itemsPage >= totalPages}
                onClick={() => setItemsPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Item Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>添加条目</DialogTitle>
            <DialogDescription>
              向知识库添加新的知识条目
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-title">标题</Label>
              <Input
                id="add-title"
                placeholder="如：招标投标法第三条"
                value={addItemForm.title}
                onChange={(e) =>
                  setAddItemForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-content">内容</Label>
              <Textarea
                id="add-content"
                placeholder="输入知识条目内容..."
                rows={8}
                value={addItemForm.content}
                onChange={(e) =>
                  setAddItemForm((f) => ({ ...f, content: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-tags">标签（逗号分隔）</Label>
              <Input
                id="add-tags"
                placeholder="如：招标, 投标, 法律"
                value={addItemForm.tags}
                onChange={(e) =>
                  setAddItemForm((f) => ({ ...f, tags: e.target.value }))
                }
              />
            </div>

            {addError && (
              <div className="text-sm text-destructive">{addError}</div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={adding}
            >
              取消
            </Button>
            <Button onClick={handleAddItem} disabled={adding}>
              {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>编辑条目</DialogTitle>
            <DialogDescription>
              修改知识条目内容和元数据
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">标题</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-content">内容</Label>
              <Textarea
                id="edit-content"
                rows={8}
                value={editForm.content}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, content: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-tags">标签（逗号分隔）</Label>
              <Input
                id="edit-tags"
                value={editForm.tags}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, tags: e.target.value }))
                }
              />
            </div>

            {editError && (
              <div className="text-sm text-destructive">{editError}</div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={editing}
            >
              取消
            </Button>
            <Button onClick={handleEditItem} disabled={editing}>
              {editing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
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
              确定要删除条目「{deleteTarget?.title ?? deleteTarget?.id}」吗？关联的向量数据也将一并删除，此操作不可撤销。
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
              onClick={handleDeleteItem}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Semantic Search Test Dialog */}
      <Dialog open={searchTestOpen} onOpenChange={setSearchTestOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>语义搜索测试</DialogTitle>
            <DialogDescription>
              输入查询文本，测试知识库的语义搜索效果
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="输入搜索查询..."
                value={searchTestQuery}
                onChange={(e) => setSearchTestQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSearchTest();
                }}
                className="flex-1"
              />
              <Button
                onClick={handleSearchTest}
                disabled={searchTesting || !searchTestQuery.trim()}
              >
                {searchTesting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                搜索
              </Button>
            </div>

            {searchTestError && (
              <div className="text-sm text-destructive">{searchTestError}</div>
            )}

            {/* Search results */}
            {searchTestResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  找到 {searchTestResults.length} 个结果：
                </p>
                {searchTestResults.map((result, idx) => (
                  <div
                    key={result.itemId}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <Badge
                        variant={
                          result.score > 0.8 ? "default" : "secondary"
                        }
                        className={
                          result.score > 0.8
                            ? "bg-green-50 text-green-700 border-green-300"
                            : ""
                        }
                      >
                        相关度: {(result.score * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed">
                      {result.content.substring(0, 300)}
                      {result.content.length > 300 ? "..." : ""}
                    </p>
                    {result.metadata && (
                      <div className="text-xs text-muted-foreground">
                        {Object.entries(result.metadata)
                          .slice(0, 3)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(" | ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {searchTestResults.length === 0 &&
              !searchTesting &&
              !searchTestError &&
              searchTestQuery.trim() && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  点击搜索按钮开始测试
                </p>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
