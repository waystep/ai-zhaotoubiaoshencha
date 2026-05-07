"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface IssueLocation {
  pageNumber: number;
  blockIndex: number;
  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  textSnippet?: string;
  highlightText?: string;
}

interface DocumentBlock {
  id: string;
  pageNumber: number;
  blockIndex: number;
  blockType: string | null;
  content: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

interface PdfViewerProps {
  documentId: string;
  blocks?: DocumentBlock[];
  highlightedIssues?: IssueLocation[];
  currentPage?: number;
  onPageChange?: (pageNumber: number) => void;
}

export function PdfViewer({
  documentId,
  blocks = [],
  highlightedIssues = [],
  currentPage,
  onPageChange,
}: PdfViewerProps) {
  const [activePage, setActivePage] = useState(currentPage || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pageContent, setPageContent] = useState<DocumentBlock[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync with external currentPage prop
  useEffect(() => {
    if (currentPage && currentPage !== activePage) {
      setActivePage(currentPage);
      updatePageContent(currentPage);
    }
  }, [currentPage]);

  useEffect(() => {
    if (blocks.length > 0) {
      const maxPage = Math.max(...blocks.map((b) => b.pageNumber));
      setTotalPages(maxPage);
      updatePageContent(activePage);
      setIsLoading(false);
    }
  }, [blocks]);

  function updatePageContent(pageNumber: number) {
    const pageBlocks = blocks.filter((b) => b.pageNumber === pageNumber);
    setPageContent(pageBlocks);
  }

  function handlePreviousPage() {
    if (activePage > 1) {
      const newPage = activePage - 1;
      setActivePage(newPage);
      updatePageContent(newPage);
      onPageChange?.(newPage);
    }
  }

  function handleNextPage() {
    if (activePage < totalPages) {
      const newPage = activePage + 1;
      setActivePage(newPage);
      updatePageContent(newPage);
      onPageChange?.(newPage);
    }
  }

  function handleZoomIn() {
    setScale(Math.min(scale + 0.25, 2));
  }

  function handleZoomOut() {
    setScale(Math.max(scale - 0.25, 0.5));
  }

  // 检查区块是否被高亮
  function isBlockHighlighted(block: DocumentBlock): IssueLocation | null {
    for (const issue of highlightedIssues) {
      if (
        issue.pageNumber === block.pageNumber &&
        issue.blockIndex === block.blockIndex
      ) {
        return issue;
      }
    }
    return null;
  }

  // 渲染区块内容
  function renderBlock(block: DocumentBlock) {
    const highlight = isBlockHighlighted(block);
    const baseClasses = "absolute p-2 transition-all duration-200";
    const typeClasses = getTypeClasses(block.blockType);
    const highlightClasses = highlight
      ? "bg-yellow-100 border-2 border-yellow-500 shadow-md"
      : "bg-white/80 border border-gray-200";

    const style = {
      left: `${block.bbox.x0 * scale}px`,
      top: `${block.bbox.y0 * scale}px`,
      width: `${(block.bbox.x1 - block.bbox.x0) * scale}px`,
      height: `${(block.bbox.y1 - block.bbox.y0) * scale}px`,
    };

    return (
      <div
        key={block.id}
        className={`${baseClasses} ${typeClasses} ${highlightClasses}`}
        style={style}
        title={highlight?.textSnippet || undefined}
      >
        {highlight?.highlightText ? (
          <span>
            {block.content.split(highlight.highlightText).map((part, i, arr) => (
              <>
                {part}
                {i < arr.length - 1 && (
                  <mark className="bg-yellow-300 px-1 rounded">
                    {highlight.highlightText}
                  </mark>
                )}
              </>
            ))}
          </span>
        ) : (
          <span className="text-sm leading-relaxed">{block.content}</span>
        )}
      </div>
    );
  }

  function getTypeClasses(blockType: string | null): string {
    switch (blockType) {
      case "title":
        return "text-lg font-bold";
      case "heading":
        return "text-base font-semibold";
      case "paragraph":
        return "text-sm";
      case "table":
        return "text-xs font-mono";
      default:
        return "text-sm";
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 控制栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={activePage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            第 {activePage} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={activePage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={scale >= 2}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 文档内容区域 */}
      <Card>
        <CardContent className="p-4 overflow-auto">
          <div
            ref={containerRef}
            className="relative bg-gray-50 min-h-[600px] rounded-lg overflow-hidden"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {/* 页面背景 */}
            <div className="absolute inset-0 bg-white shadow-inner" style={{ width: "100%", height: "800px" }} />

            {/* 渲染区块 */}
            {pageContent.map((block) => renderBlock(block))}
          </div>
        </CardContent>
      </Card>

      {/* 当前页问题提示 */}
      {highlightedIssues.filter((i) => i.pageNumber === activePage).length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-yellow-800 mb-2">
            当前页发现 {highlightedIssues.filter((i) => i.pageNumber === activePage).length} 个问题
          </p>
          <ul className="space-y-1">
            {highlightedIssues
              .filter((i) => i.pageNumber === activePage)
              .map((issue, index) => (
                <li key={index} className="text-sm text-yellow-700">
                  {issue.textSnippet && (
                    <span className="font-mono bg-yellow-100 px-1 rounded">
                      "{issue.textSnippet.substring(0, 50)}..."
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}