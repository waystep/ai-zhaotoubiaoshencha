import { z } from "zod";

// 审查状态
export type ReviewStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed";

// 问题严重程度
export type IssueSeverity =
  | "critical"      // 严重问题（必整改）
  | "major"         // 重要问题
  | "minor"         // 轻微问题
  | "suggestion";   // 建议

// 建议结论
export type Recommendation =
  | "pass"          // 通过
  | "fail"          // 不通过
  | "revise";       // 整改后通过

export type ReviewItemResultStatus =
  | "pass"
  | "fail"
  | "needs_manual_review";

export type ResponseItemResultStatus =
  | "answered"
  | "partially_answered"
  | "unanswered"
  | "not_applicable";

// 审查报告
export interface ReviewReport {
  id: string;
  projectId: string;
  documentId: string;
  reviewedBy?: string;
  status: ReviewStatus;
  aiScore?: number;
  aiAnalysis?: Record<string, unknown>;
  manualScore?: number;
  manualAnalysis?: Record<string, unknown>;
  finalScore?: number;
  recommendation?: Recommendation;
  summary?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 审查问题
export interface ReviewIssue {
  id: string;
  reportId: string;
  blockId?: string;
  category: string;
  severity: IssueSeverity;
  title: string;
  description: string;
  location: IssueLocation;
  suggestion?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface ReviewItemResult {
  id: string;
  reportId: string;
  reviewItemId: string;
  status: ReviewItemResultStatus;
  reason: string;
  evidenceBlockIds: string[];
  confidence?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResponseItemResult {
  id: string;
  reportId: string;
  responseItemId: string;
  status: ResponseItemResultStatus;
  reason: string;
  evidenceBlockIds: string[];
  confidence?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// 问题位置标注
export interface IssueLocation {
  pageNumber: number;
  blockIndex: number;
  bbox?: BoundingBox;
  textSnippet?: string;
  highlightText?: string;
}

interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// 创建审查问题 Schema
export const createIssueSchema = z.object({
  reportId: z.string().uuid(),
  blockId: z.string().uuid().optional(),
  category: z.string().min(1, "问题类别不能为空"),
  severity: z.enum(["critical", "major", "minor", "suggestion"]),
  title: z.string().min(1, "问题标题不能为空"),
  description: z.string().min(1, "问题描述不能为空"),
  location: z.object({
    pageNumber: z.number().int().positive(),
    blockIndex: z.number().int().nonnegative(),
    bbox: z.object({
      x0: z.number(),
      y0: z.number(),
      x1: z.number(),
      y1: z.number(),
    }).optional(),
    textSnippet: z.string().optional(),
    highlightText: z.string().optional(),
  }),
  suggestion: z.string().optional(),
});

// 更新审查问题 Schema
export const updateIssueSchema = createIssueSchema.partial().extend({
  isResolved: z.boolean().optional(),
  resolvedBy: z.string().uuid().optional(),
});
