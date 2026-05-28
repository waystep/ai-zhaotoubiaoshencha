"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Save,
  Download,
  Upload,
  Loader2,
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  GripVertical,
  CheckCircle,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { BidSection } from "@/lib/services/bid-document-service";

// ==================== Types ====================

interface BidDocument {
  id: string;
  projectId: string;
  title: string;
  source: string;
  sections: BidSection[];
  metadata: Record<string, unknown> | null;
  version: number | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ==================== Constants ====================

const AUTO_SAVE_INTERVAL = 30_000; // 30 seconds

// ==================== Main Page ====================

export default function BidDocumentEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const docIdParam = searchParams.get("docId");
  const { toast } = useToast();

  // State
  const [documents, setDocuments] = useState<BidDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>("");
  const [activeDoc, setActiveDoc] = useState<BidDocument | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [sections, setSections] = useState<BidSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingSectionsRef = useRef<BidSection[]>([]);

  // Keep ref in sync with sections state
  useEffect(() => {
    pendingSectionsRef.current = sections;
  }, [sections]);

  // ==================== TipTap Editor ====================

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "选择章节开始编辑，或添加新章节...",
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      if (!selectedSectionId) return;
      const html = editor.getHTML();
      setSections((prev) =>
        prev.map((s) =>
          s.id === selectedSectionId ? { ...s, content: html, status: "edited" as const } : s,
        ),
      );
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[400px] px-4 py-3",
      },
    },
  });

  // Update editor content when section selection changes
  useEffect(() => {
    if (!editor) return;
    const section = sections.find((s) => s.id === selectedSectionId);
    if (section) {
      editor.commands.setContent(section.content || "");
    } else {
      editor.commands.setContent("");
    }
  }, [selectedSectionId, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== Data Fetching ====================

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/draft`);
      if (res.ok) {
        const data = await res.json();
        const docs = data.documents as BidDocument[];
        setDocuments(docs);

        // Auto-select document
        if (docs.length > 0 && !activeDocId) {
          const targetId = docIdParam || docs[0].id;
          setActiveDocId(targetId);
        }
      }
    } catch (err) {
      console.error("获取文档列表失败:", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, activeDocId, docIdParam]);

  const fetchDocument = useCallback(
    async (docId: string) => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/draft?docId=${docId}`,
        );
        if (res.ok) {
          const data = await res.json();
          setActiveDoc(data.document);
          setSections((data.document.sections as BidSection[]) || []);
          if (data.document.sections?.length > 0 && !selectedSectionId) {
            setSelectedSectionId(data.document.sections[0].id);
          }
        }
      } catch (err) {
        console.error("获取文档详情失败:", err);
      }
    },
    [projectId, selectedSectionId],
  );

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (activeDocId) {
      void fetchDocument(activeDocId);
    }
  }, [activeDocId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== Auto-Save ====================

  const doAutoSave = useCallback(async () => {
    if (!activeDocId || isSaving) return;
    const currentSections = pendingSectionsRef.current;
    if (!currentSections || currentSections.length === 0) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "autoSave",
          docId: activeDocId,
          sections: currentSections,
        }),
      });
      if (res.ok) {
        setLastSaved(new Date());
      }
    } catch (err) {
      console.error("自动保存失败:", err);
    } finally {
      setIsSaving(false);
    }
  }, [activeDocId, projectId, isSaving]);

  useEffect(() => {
    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setInterval(doAutoSave, AUTO_SAVE_INTERVAL);
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [doAutoSave]);

  // ==================== Actions ====================

  async function handleManualSave() {
    await doAutoSave();
    toast({ title: "保存成功" });
  }

  async function handleExportWord() {
    if (!activeDocId) return;
    setIsExporting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/draft/export-word`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docId: activeDocId }),
        },
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const disposition = res.headers.get("Content-Disposition");
        const match = disposition?.match(/filename\*=UTF-8''(.+)/);
        a.download = match ? decodeURIComponent(match[1]) : "投标文件.docx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ title: "导出成功" });
      } else {
        const err = await res.json();
        toast({ title: "导出失败", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "导出失败", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportWord(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeDocId) return;
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("docId", activeDocId);
      formData.append("file", file);
      const res = await fetch(
        `/api/projects/${projectId}/draft/import-word`,
        { method: "POST", body: formData },
      );
      if (res.ok) {
        const data = await res.json();
        setActiveDoc(data.document);
        setSections((data.document.sections as BidSection[]) || []);
        if (data.document.sections?.length > 0) {
          setSelectedSectionId(data.document.sections[0].id);
        }
        toast({ title: "导入成功", description: "Word文件已解析并更新章节" });
      } else {
        const err = await res.json();
        toast({ title: "导入失败", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "导入失败", variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleAddSection() {
    if (!newSectionTitle.trim()) return;
    const newSection: BidSection = {
      id: crypto.randomUUID(),
      sectionNo: String(sections.length + 1),
      title: newSectionTitle.trim(),
      content: "",
      parentId: null,
      linkedReviewItems: [],
      linkedResponseItems: [],
      scoringInfo: null,
      status: "empty",
    };
    setSections((prev) => [...prev, newSection]);
    setSelectedSectionId(newSection.id);
    setNewSectionTitle("");
    setAddingSection(false);

    // Persist via API
    fetch(`/api/projects/${projectId}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId: activeDocId, section: newSection }),
    }).catch(console.error);
  }

  function toggleCollapse(sectionId: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  // Get children sections for a parent
  function getChildSections(parentId: string | null): BidSection[] {
    return sections.filter((s) => s.parentId === parentId);
  }

  const rootSections = getChildSections(null);
  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  // ==================== Toolbar for TipTap ====================

  function EditorToolbar() {
    if (!editor) return null;
    return (
      <div className="flex items-center gap-1 border-b px-3 py-2 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <span className="font-bold text-sm">B</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <span className="italic text-sm">I</span>
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <span className="text-xs font-bold">H1</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <span className="text-xs font-bold">H3</span>
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <span className="text-sm">&#8226;</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <span className="text-sm">1.</span>
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Quote"
        >
          <span className="text-sm">&ldquo;</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <span className="text-sm">&mdash;</span>
        </ToolbarButton>
      </div>
    );
  }

  // ==================== Render ====================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={handleImportWord}
      />

      {/* Top Toolbar */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Document selector */}
          {documents.length > 1 && (
            <select
              value={activeDocId}
              onChange={(e) => setActiveDocId(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          )}

          {activeDoc && (
            <h2 className="text-sm font-medium truncate max-w-[300px]">
              {activeDoc.title}
            </h2>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Auto-save indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
              {isSaving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  保存中...
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  已保存 {lastSaved.toLocaleTimeString()}
                </>
              ) : null}
            </div>

            <Button size="sm" variant="outline" onClick={handleManualSave} disabled={isSaving}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              保存
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportWord}
              disabled={isExporting || !activeDocId}
            >
              {isExporting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              导出Word
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting || !activeDocId}
            >
              {isImporting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              导入Word
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content: Outline + Editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Chapter Outline */}
        <div className="w-[260px] shrink-0 border-r bg-muted/20">
          <div className="p-3 border-b">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              章节大纲
            </h3>
          </div>
          <ScrollArea className="h-[calc(100%-44px)]">
            <div className="p-2">
              {rootSections.map((section) => {
                const children = getChildSections(section.id);
                const isSelected = section.id === selectedSectionId;
                const isCollapsed = collapsedSections.has(section.id);

                return (
                  <div key={section.id}>
                    <button
                      className={cn(
                        "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted",
                      )}
                      onClick={() => setSelectedSectionId(section.id)}
                    >
                      {children.length > 0 ? (
                        <button
                          type="button"
                          className="shrink-0 hover:bg-muted rounded p-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCollapse(section.id);
                          }}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="w-[18px] shrink-0" />
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {section.sectionNo}
                      </span>
                      <span className="truncate">{section.title}</span>
                      {section.status === "edited" && (
                        <span className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-blue-400" />
                      )}
                      {section.status === "empty" && (
                        <span className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-gray-300" />
                      )}
                    </button>

                    {/* Child sections */}
                    {children.length > 0 && !isCollapsed && (
                      <div className="ml-4 border-l pl-1">
                        {children.map((child) => {
                          const isChildSelected = child.id === selectedSectionId;
                          return (
                            <button
                              key={child.id}
                              className={cn(
                                "w-full flex items-center gap-2 rounded-md px-2 py-1 text-sm text-left transition-colors",
                                isChildSelected
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-muted",
                              )}
                              onClick={() => setSelectedSectionId(child.id)}
                            >
                              <span className="text-xs text-muted-foreground">
                                {child.sectionNo}
                              </span>
                              <span className="truncate">{child.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Section */}
              {addingSection ? (
                <div className="mt-2 flex gap-1">
                  <Input
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddSection();
                      if (e.key === "Escape") setAddingSection(false);
                    }}
                    placeholder="章节标题..."
                    className="h-7 text-sm"
                    autoFocus
                  />
                  <Button size="sm" className="h-7 px-2" onClick={handleAddSection}>
                    确定
                  </Button>
                </div>
              ) : (
                <button
                  className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
                  onClick={() => setAddingSection(true)}
                >
                  <Plus className="h-3 w-3" />
                  添加章节
                </button>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel: Editor + Reference Cards */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedSection ? (
            <>
              {/* Section header */}
              <div className="border-b px-4 py-2 flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {selectedSection.sectionNo}
                </span>
                <h3 className="text-sm font-medium">{selectedSection.title}</h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] h-5",
                    selectedSection.status === "edited"
                      ? "border-blue-200 text-blue-600"
                      : selectedSection.status === "empty"
                        ? "border-gray-200 text-gray-400"
                        : "border-green-200 text-green-600",
                  )}
                >
                  {selectedSection.status === "edited"
                    ? "已编辑"
                    : selectedSection.status === "empty"
                      ? "待填写"
                      : "已生成"}
                </Badge>

                {/* Scoring info */}
                {selectedSection.scoringInfo && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>分值: {selectedSection.scoringInfo.score ?? "-"}</span>
                    <span>|</span>
                    <span>权重: {selectedSection.scoringInfo.weight ?? "-"}</span>
                  </div>
                )}
              </div>

              {/* Editor toolbar */}
              <EditorToolbar />

              {/* TipTap Editor */}
              <ScrollArea className="flex-1">
                <div className="max-w-3xl mx-auto">
                  <EditorContent editor={editor} />
                </div>
              </ScrollArea>

              {/* Reference Cards (linked review/response items) */}
              {(selectedSection.linkedReviewItems.length > 0 ||
                selectedSection.linkedResponseItems.length > 0) && (
                <div className="border-t px-4 py-3 bg-muted/10">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    关联审查项
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedSection.linkedReviewItems.map((itemId) => (
                      <Badge key={itemId} variant="secondary" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {itemId.slice(0, 8)}...
                      </Badge>
                    ))}
                    {selectedSection.linkedResponseItems.map((itemId) => (
                      <Badge key={itemId} variant="outline" className="text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        {itemId.slice(0, 8)}...
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {sections.length === 0
                    ? "暂无章节，点击左侧「添加章节」开始"
                    : "从左侧选择一个章节开始编辑"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Toolbar Button ====================

function ToolbarButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
