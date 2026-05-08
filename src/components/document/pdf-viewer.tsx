"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface IssueLocation {
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

export interface DocumentBlock {
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

function inferRefDimensions(
  boxes: Array<{ x0: number; y0: number; x1: number; y1: number }>,
  fallbackW: number,
  fallbackH: number
): { refW: number; refH: number } {
  let refW = Math.max(fallbackW, 1);
  let refH = Math.max(fallbackH, 1);
  for (const b of boxes) {
    refW = Math.max(refW, b.x1, b.x0);
    refH = Math.max(refH, b.y1, b.y0);
  }
  return { refW, refH };
}

function mapBoxToOverlay(
  box: { x0: number; y0: number; x1: number; y1: number },
  refW: number,
  refH: number,
  overlayW: number,
  overlayH: number
) {
  const left = (box.x0 / refW) * overlayW;
  const top = (box.y0 / refH) * overlayH;
  const width = ((box.x1 - box.x0) / refW) * overlayW;
  const height = ((box.y1 - box.y0) / refH) * overlayH;
  return { left, top, width: Math.max(width, 1), height: Math.max(height, 1) };
}

function boxForIssue(issue: IssueLocation, pageBlocks: DocumentBlock[]) {
  const b = issue.bbox;
  if (b && b.x1 > b.x0 && b.y1 > b.y0) {
    return b;
  }
  const block = pageBlocks.find((x) => x.blockIndex === issue.blockIndex);
  return block?.bbox ?? null;
}

export function PdfViewer({
  documentId,
  blocks = [],
  highlightedIssues = [],
  currentPage,
  onPageChange,
}: PdfViewerProps) {
  const fileUrl = useMemo(() => `/api/documents/${documentId}/file`, [documentId]);
  const documentOptions = useMemo(() => ({ withCredentials: true as const }), []);

  const [numPages, setNumPages] = useState(0);
  const [activePage, setActivePage] = useState(() => Math.max(1, currentPage ?? 1));
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(720);
  const [layout, setLayout] = useState<{
    overlayW: number;
    overlayH: number;
    baseW: number;
    baseH: number;
  } | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);

  const pageWidth = Math.round(Math.max(240, containerWidth * zoom));

  const pageBlocks = useMemo(
    () => blocks.filter((b) => b.pageNumber === activePage),
    [blocks, activePage]
  );

  useEffect(() => {
    setNumPages(0);
    setPdfReady(false);
    setLoadError(null);
    setLayout(null);
    setActivePage(Math.max(1, currentPage ?? 1));
  }, [documentId]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerWidth(Math.max(240, Math.floor(el.clientWidth - 16)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (currentPage == null || currentPage < 1) return;
    if (numPages > 0 && currentPage > numPages) {
      setActivePage(numPages);
      onPageChange?.(numPages);
      return;
    }
    setActivePage((p) => (p === currentPage ? p : currentPage));
  }, [currentPage, numPages]);

  useEffect(() => {
    if (numPages <= 0) return;
    setActivePage((p) => (p > numPages ? numPages : p < 1 ? 1 : p));
  }, [numPages]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPdfReady(true);
    setLoadError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error("[PdfViewer] 文档加载失败:", err);
    setLoadError(err?.message || "无法加载 PDF");
    setPdfReady(true);
  }, []);

  const handlePageRenderSuccess = useCallback(
    (page: { getViewport: (opts: { scale: number }) => { width: number; height: number } }) => {
      const base = page.getViewport({ scale: 1 });
      const scale = pageWidth / base.width;
      const vp = page.getViewport({ scale });
      setLayout({
        overlayW: vp.width,
        overlayH: vp.height,
        baseW: base.width,
        baseH: base.height,
      });
    },
    [pageWidth]
  );

  const goPrev = () => {
    setActivePage((p) => {
      const next = Math.max(1, p - 1);
      if (next !== p) onPageChange?.(next);
      return next;
    });
  };

  const goNext = () => {
    setActivePage((p) => {
      const next = numPages > 0 ? Math.min(numPages, p + 1) : p + 1;
      if (next !== p) onPageChange?.(next);
      return next;
    });
  };

  const issueBoxes = useMemo(() => {
    const list: Array<{ key: string; box: { x0: number; y0: number; x1: number; y1: number } }> = [];
    for (const issue of highlightedIssues) {
      if (issue.pageNumber !== activePage) continue;
      const box = boxForIssue(issue, pageBlocks);
      if (!box) continue;
      list.push({
        key: `issue-${issue.pageNumber}-${issue.blockIndex}-${issue.textSnippet?.slice(0, 12) ?? ""}`,
        box,
      });
    }
    return list;
  }, [highlightedIssues, activePage, pageBlocks]);

  const highlightOverlay = useMemo(() => {
    if (!layout) return null;
    const boxesForRef = [
      ...pageBlocks.map((b) => b.bbox),
      ...issueBoxes.map((x) => x.box),
    ];
    const { refW, refH } = inferRefDimensions(boxesForRef, layout.baseW, layout.baseH);

    return issueBoxes.map(({ key, box }) => {
      const { left, top, width, height } = mapBoxToOverlay(box, refW, refH, layout.overlayW, layout.overlayH);
      return (
        <div
          key={key}
          className="pointer-events-none absolute rounded-sm border-2 border-yellow-500 bg-yellow-300/20"
          style={{ left, top, width, height }}
        />
      );
    });
  }, [layout, pageBlocks, issueBoxes]);

  const totalPagesLabel = numPages > 0 ? numPages : Math.max(1, ...blocks.map((b) => b.pageNumber), 0);

  if (loadError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <p className="text-xs text-muted-foreground">
            请确认源文件为 PDF；若为扫描件，解析区块叠层可能仍依赖 MinerU 坐标。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} disabled={activePage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums">
            第 {activePage} / {totalPagesLabel} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={numPages === 0 || activePage >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} disabled={zoom <= 0.5}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(2, z + 0.25))} disabled={zoom >= 2}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div ref={wrapRef} className="relative min-h-[480px] overflow-auto rounded-lg bg-muted/30">
            {!pdfReady && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="relative mx-auto w-fit max-w-full py-2">
              <Document
                key={documentId}
                file={fileUrl}
                options={documentOptions}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={null}
                className="flex justify-center"
              >
                {numPages > 0 && (
                  <div className="relative shadow-sm">
                    <Page
                      pageNumber={activePage}
                      width={pageWidth}
                      renderTextLayer
                      renderAnnotationLayer={false}
                      onRenderSuccess={handlePageRenderSuccess}
                      loading={
                        <div className="flex h-[520px] items-center justify-center text-sm text-muted-foreground">
                          渲染页面…
                        </div>
                      }
                    />
                    {layout ? (
                      <div
                        className="pointer-events-none absolute left-0 top-0"
                        style={{ width: layout.overlayW, height: layout.overlayH }}
                      >
                        {highlightOverlay}
                      </div>
                    ) : null}
                  </div>
                )}
              </Document>
            </div>
          </div>
        </CardContent>
      </Card>

      {highlightedIssues.filter((i) => i.pageNumber === activePage).length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="mb-2 text-sm font-semibold text-yellow-800">
            当前页关联 {highlightedIssues.filter((i) => i.pageNumber === activePage).length} 条审查位置
          </p>
          <ul className="space-y-1">
            {highlightedIssues
              .filter((i) => i.pageNumber === activePage)
              .map((issue, index) => (
                <li key={`${issue.blockIndex}-${index}`} className="text-sm text-yellow-800">
                  {issue.textSnippet ? (
                    <span className="rounded bg-yellow-100 px-1 font-mono">
                      「{issue.textSnippet.substring(0, 80)}
                      {issue.textSnippet.length > 80 ? "…" : ""}」
                    </span>
                  ) : (
                    <span className="text-muted-foreground">（无摘要）</span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
