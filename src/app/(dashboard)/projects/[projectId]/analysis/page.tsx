"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Shield,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ==================== Types ====================

interface TenderDocument {
  id: string;
  name: string;
  parseStatus: string;
  extractionStatus: string;
  extractionItemsCount: number;
  extractedAt: string | null;
  createdAt: string;
}

interface ExtractionItem {
  id: string;
  projectId: string;
  documentId: string | null;
  section: string | null;
  title: string;
  checkpoint: string;
  consequence: number | null;
  blocks: Array<{ blockId: string; pageNumber: number; blockIndex: number }>;
  extractedBy: string | null;
  createdAt: string;
  documentName?: string;
}

interface ReviewItem {
  id: string;
  itemType: string;
  itemNo: string | null;
  title: string;
  description: string;
  location: {
    pageNumber: number;
    blockIndex: number;
    textSnippet?: string;
  };
  requirements: {
    mandatory: boolean;
    threshold: string | null;
    criteria: string[];
    proofRequired: string[];
  };
  consequence: string | null;
  legalReference: string | null;
  extractionConfidence: string | null;
  isVerified: boolean;
}

interface ParseStatus {
  projectId: string;
  tenderDocuments: TenderDocument[];
}

// ==================== Category Mapping ====================

const CATEGORY_MAP: Record<string, string> = {
  "资质要求": "qualification",
  "资格要求": "qualification",
  "qualification": "qualification",
  "符合性要求": "compliance",
  "compliance": "compliance",
  "技术要求": "technical",
  "technical": "technical",
  "商务条款": "commercial",
  "commercial": "commercial",
  "评分标准": "scoring",
  "scoring": "scoring",
  "业绩要求": "experience",
  "experience": "experience",
  "人员配置": "personnel",
  "personnel": "personnel",
};

const TAB_CATEGORIES = [
  { key: "qualification", label: "资格要求" },
  { key: "compliance", label: "符合性要求" },
  { key: "technical", label: "技术要求" },
  { key: "commercial", label: "商务条款" },
  { key: "scoring", label: "评分标准" },
  { key: "experience", label: "业绩要求" },
  { key: "personnel", label: "人员配置" },
] as const;

// ==================== Helpers ====================

function categorizeItemType(itemType: string): string {
  const lower = itemType.toLowerCase();
  for (const [pattern, category] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(pattern.toLowerCase())) return category;
  }
  return "technical";
}

function getExtractionStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "processing":
      return <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Clock className="h-5 w-5 text-gray-400" />;
  }
}

function getExtractionStatusLabel(status: string) {
  switch (status) {
    case "completed":
      return "已提取";
    case "processing":
      return "提取中";
    case "failed":
      return "提取失败";
    default:
      return "待提取";
  }
}

function getVerificationIcon(item: ReviewItem) {
  if (item.isVerified) {
    return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
  }
  if (item.legalReference) {
    return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
  }
  return <XCircle className="h-4 w-4 text-gray-400 shrink-0" />;
}

function getVerificationStatus(item: ReviewItem) {
  if (item.isVerified) return "verified";
  if (item.legalReference) return "has_reference";
  return "unverified";
}

// ==================== Sub-Components ====================

function SummaryCard({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-lg font-semibold truncate" title={String(value)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ExtractionItemCard({ item }: { item: ExtractionItem }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border bg-background transition-colors hover:bg-muted/20">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 p-3 text-left">
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{item.title}</span>
                {item.section && (
                  <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                    {item.section}
                  </Badge>
                )}
                {item.consequence != null && item.consequence > 0 && (
                  <Badge variant="outline" className="text-xs">
                    权重 {Number(item.consequence).toFixed(1)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {item.checkpoint}
              </p>
            </div>
            {item.blocks && item.blocks.length > 0 && (
              <span className="text-xs text-muted-foreground shrink-0">
                P{item.blocks[0].pageNumber}
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t bg-muted/10 space-y-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">检查点</p>
              <p className="text-sm">{item.checkpoint}</p>
            </div>
            {item.blocks && item.blocks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">关联区块</p>
                <div className="flex flex-wrap gap-1">
                  {item.blocks.map((block, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      第{block.pageNumber}页 #{block.blockIndex}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {item.extractedBy && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">提取来源</p>
                <p className="text-xs text-muted-foreground">{item.extractedBy}</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ReviewItemCard({ item }: { item: ReviewItem }) {
  const [open, setOpen] = useState(false);
  const mandatory = item.requirements?.mandatory ?? false;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border bg-background transition-colors hover:bg-muted/20">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 p-3 text-left">
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            {getVerificationIcon(item)}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {item.itemNo && (
                  <Badge variant="outline" className="text-xs">{item.itemNo}</Badge>
                )}
                <span className="text-sm font-medium">{item.title}</span>
                {mandatory && (
                  <Badge variant="outline" className="text-xs border-red-300 text-red-700">
                    强制
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {item.description}
              </p>
            </div>
            {item.location?.pageNumber > 0 && (
              <span className="text-xs text-muted-foreground shrink-0">
                P{item.location.pageNumber}
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t bg-muted/10 space-y-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">详细描述</p>
              <p className="text-sm whitespace-pre-wrap">{item.description}</p>
            </div>
            {item.requirements?.criteria && item.requirements.criteria.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">具体标准</p>
                <ul className="list-disc list-inside text-sm space-y-0.5">
                  {item.requirements.criteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {item.requirements?.proofRequired && item.requirements.proofRequired.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">需提供证明材料</p>
                <ul className="list-disc list-inside text-sm space-y-0.5">
                  {item.requirements.proofRequired.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {item.consequence && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">不满足后果</p>
                <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                  {item.consequence}
                </Badge>
              </div>
            )}
            {item.legalReference && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">法律依据</p>
                <p className="text-sm">{item.legalReference}</p>
              </div>
            )}
            {item.location?.pageNumber > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">位置</p>
                <Badge variant="outline" className="text-xs">
                  第{item.location.pageNumber}页 区块#{item.location.blockIndex}
                </Badge>
                {item.location.textSnippet && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.location.textSnippet}
                  </p>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ==================== Main Page ====================

export default function TenderAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { toast } = useToast();

  const [parseStatus, setParseStatus] = useState<ParseStatus | null>(null);
  const [extractionItems, setExtractionItems] = useState<ExtractionItem[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [activeTab, setActiveTab] = useState("qualification");

  // Fetch parse status (tender documents + extraction status)
  const fetchParseStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/parse-tender`);
      if (res.ok) {
        const data = await res.json();
        setParseStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch parse status:", e);
    }
  }, [projectId]);

  // Fetch extraction items
  const fetchExtractionItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/extraction-items?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setExtractionItems(data.items || []);
      }
    } catch (e) {
      console.error("Failed to fetch extraction items:", e);
    }
  }, [projectId]);

  // Fetch review items from all tender docs
  const fetchReviewItems = useCallback(async () => {
    try {
      // Get all tender documents first
      const docsRes = await fetch(`/api/projects/${projectId}/documents`);
      if (!docsRes.ok) return;
      const docsData = await docsRes.json();
      const tenderDocs = (docsData.documents || []).filter(
        (d: { docType: string }) => d.docType === "tender_doc"
      );

      const allItems: ReviewItem[] = [];
      for (const doc of tenderDocs) {
        try {
          const res = await fetch(`/api/documents/${doc.id}/extraction-items`);
          if (!res.ok) continue;
          const data = await res.json();
          // These come as extraction items, map to review-like display
          for (const item of data.items || []) {
            allItems.push({
              id: item.id,
              itemType: item.title || "other",
              itemNo: item.section || null,
              title: item.title,
              description: item.checkpoint || "",
              location: {
                pageNumber: item.blocks?.[0]?.pageNumber || 0,
                blockIndex: item.blocks?.[0]?.blockIndex || 0,
              },
              requirements: {
                mandatory: Number(item.consequence) >= 0.8,
                threshold: null,
                criteria: [],
                proofRequired: [],
              },
              consequence: item.consequence ? `权重 ${Number(item.consequence).toFixed(1)}` : null,
              legalReference: null,
              extractionConfidence: null,
              isVerified: false,
            });
          }
        } catch {
          // skip this doc
        }
      }
      setReviewItems(allItems);
    } catch (e) {
      console.error("Failed to fetch review items:", e);
    }
  }, [projectId]);

  // Load all data
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchParseStatus(), fetchExtractionItems(), fetchReviewItems()]);
      setLoading(false);
    })();
  }, [fetchParseStatus, fetchExtractionItems, fetchReviewItems]);

  // Group extraction items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, ExtractionItem[]> = {};
    for (const cat of TAB_CATEGORIES) {
      groups[cat.key] = [];
    }
    for (const item of extractionItems) {
      const cat = categorizeItemType(item.title);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [extractionItems]);

  // Group review items by category
  const groupedReviewItems = useMemo(() => {
    const groups: Record<string, ReviewItem[]> = {};
    for (const cat of TAB_CATEGORIES) {
      groups[cat.key] = [];
    }
    for (const item of reviewItems) {
      const cat = categorizeItemType(item.itemType);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [reviewItems]);

  // Legal verification stats
  const verificationStats = useMemo(() => {
    const total = reviewItems.length;
    const verified = reviewItems.filter((i) => i.isVerified).length;
    const hasReference = reviewItems.filter((i) => !i.isVerified && i.legalReference).length;
    const unverified = total - verified - hasReference;
    return { total, verified, hasReference, unverified };
  }, [reviewItems]);

  // Trigger parsing
  const handleTriggerParsing = useCallback(async () => {
    setTriggering(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/parse-tender`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "解析失败");
      }
      toast({ title: "解析已触发", description: "A1 智能体正在解析招标文件..." });
      // Refresh data after short delay
      setTimeout(() => {
        fetchParseStatus();
        fetchExtractionItems();
        fetchReviewItems();
      }, 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "触发解析失败";
      toast({ title: "解析失败", description: msg, variant: "destructive" });
    } finally {
      setTriggering(false);
    }
  }, [projectId, toast, fetchParseStatus, fetchExtractionItems, fetchReviewItems]);

  // Generate bid document button
  const handleGenerateBid = useCallback(() => {
    router.push(`/projects/${projectId}/draft`);
  }, [router, projectId]);

  // Summary data for top cards
  const tenderDoc = parseStatus?.tenderDocuments?.[0];
  const totalItems = extractionItems.length + reviewItems.length;

  // ==================== Render ====================

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${projectId}/documents`}
          className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回文档列表
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h2">招标文件解析结果</h2>
            <p className="text-muted-foreground">
              A1 智能体对招标文件的结构化分析结果
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={handleTriggerParsing} disabled={triggering}>
              {triggering ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              重新解析
            </Button>
            <Button onClick={handleGenerateBid}>
              <Play className="mr-1.5 h-4 w-4" />
              生成投标文件
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="招标文件"
          value={tenderDoc?.name || "未上传"}
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          label="提取状态"
          value={tenderDoc ? getExtractionStatusLabel(tenderDoc.extractionStatus) : "-"}
          icon={tenderDoc ? getExtractionStatusIcon(tenderDoc.extractionStatus) : <Clock className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          label="提取项总数"
          value={totalItems}
          icon={<Shield className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          label="法律验证"
          value={`${verificationStats.verified} / ${verificationStats.total}`}
          icon={
            verificationStats.unverified > 0 ? (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )
          }
        />
      </div>

      {/* No tender document */}
      {!tenderDoc && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-h5">未找到招标文件</h3>
            <p className="text-muted-foreground text-center mb-4">
              请先上传招标文件并完成解析
            </p>
            <Link href={`/projects/${projectId}/documents/upload`}>
              <Button>上传招标文件</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Tender doc exists but not extracted yet */}
      {tenderDoc && tenderDoc.extractionStatus === "pending" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-h5">尚未提取审查项</h3>
            <p className="text-muted-foreground text-center mb-4">
              点击「重新解析」按钮，A1 智能体将自动提取审查项
            </p>
            <Button onClick={handleTriggerParsing} disabled={triggering}>
              {triggering ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
              开始解析
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Extraction in progress */}
      {tenderDoc && tenderDoc.extractionStatus === "processing" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-yellow-500" />
            <h3 className="mb-2 text-h5">正在提取审查项</h3>
            <p className="text-muted-foreground text-center">
              A1 智能体正在分析招标文件并提取结构化审查数据...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Content - Show when we have items */}
      {totalItems > 0 && (
        <>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto">
              {TAB_CATEGORIES.map((cat) => {
                const count = (groupedItems[cat.key]?.length || 0) + (groupedReviewItems[cat.key]?.length || 0);
                return (
                  <TabsTrigger key={cat.key} value={cat.key} className="gap-1.5">
                    {cat.label}
                    {count > 0 && (
                      <Badge variant="outline" className="ml-1 text-xs px-1.5 py-0">
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {TAB_CATEGORIES.map((cat) => {
              const extItems = groupedItems[cat.key] || [];
              const rvItems = groupedReviewItems[cat.key] || [];
              const combinedCount = extItems.length + rvItems.length;

              return (
                <TabsContent key={cat.key} value={cat.key}>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{cat.label}</CardTitle>
                      <CardDescription>
                        共 {combinedCount} 项
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {combinedCount === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          该分类下暂无提取项
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {rvItems.map((item) => (
                            <ReviewItemCard key={item.id} item={item} />
                          ))}
                          {extItems.map((item) => (
                            <ExtractionItemCard key={item.id} item={item} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>

          {/* Legal Verification Section */}
          {verificationStats.total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">法律验证标注</CardTitle>
                <CardDescription>
                  审查项的法律法规引用验证状态
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3 mb-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-100">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">已验证</p>
                      <p className="text-xs text-muted-foreground">{verificationStats.verified} 项</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-100">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium">有法规引用</p>
                      <p className="text-xs text-muted-foreground">{verificationStats.hasReference} 项</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <XCircle className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">待验证</p>
                      <p className="text-xs text-muted-foreground">{verificationStats.unverified} 项</p>
                    </div>
                  </div>
                </div>

                {/* Detailed verification list */}
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {reviewItems.map((item) => {
                    const status = getVerificationStatus(item);
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-md text-sm",
                          status === "verified" && "bg-green-50/50",
                          status === "has_reference" && "bg-yellow-50/50",
                        )}
                      >
                        {getVerificationIcon(item)}
                        <span className="truncate flex-1">{item.title}</span>
                        {item.itemNo && (
                          <Badge variant="outline" className="text-xs shrink-0">{item.itemNo}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0">
                          {status === "verified" ? "已验证" : status === "has_reference" ? "有引用" : "待验证"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Tender doc extracted but no items found */}
      {tenderDoc && tenderDoc.extractionStatus === "completed" && totalItems === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-h5">提取完成但暂无审查项</h3>
            <p className="text-muted-foreground text-center mb-4">
              招标文件已完成解析，但未提取到结构化审查项。您可以手动添加或重新解析。
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTriggerParsing} disabled={triggering}>
                重新解析
              </Button>
              <Link href={`/projects/${projectId}/extraction-items`}>
                <Button>管理审查项</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
