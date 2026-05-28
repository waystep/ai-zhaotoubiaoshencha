/**
 * JSON Output Schemas — M7 Integration Output Module
 *
 * Defines the 4 structured output types for the v1 REST API:
 * 1. Tender Analysis  — A1 招标解析结果
 * 2. Bid Draft         — A2 投标文件样稿
 * 3. Risk List         — A3 风险清单
 * 4. Review Report     — A6 预审报告
 *
 * Each schema has a corresponding type export and a discriminator union.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

export const LocationSchema = z.object({
  page: z.number(),
  blockId: z.string().optional(),
  text: z.string().optional(),
});

// ---------------------------------------------------------------------------
// 1. 招标解析结果 (Tender Analysis)
// ---------------------------------------------------------------------------

export const TenderAnalysisProjectInfoSchema = z.object({
  projectName: z.string(),
  projectNumber: z.string().optional(),
  tenderDeadline: z.string().optional(),
  bidBondAmount: z.string().optional(),
  evaluationMethod: z.string().optional(),
});

export const ReviewItemOutputSchema = z.object({
  id: z.string(),
  itemType: z.enum([
    "qualification",
    "compliance",
    "technical",
    "commercial",
    "key_parameters",
    "experience",
    "personnel",
  ]),
  title: z.string(),
  description: z.string(),
  requirements: z.string().optional(),
  severity: z.enum(["high", "medium", "low"]).optional(),
  legalReference: z.string().optional(),
  legalVerificationStatus: z
    .enum(["verified", "outdated", "not_found"])
    .optional(),
  location: LocationSchema.optional(),
});

export const ScoringCriterionSchema = z.object({
  factor: z.string(),
  weight: z.number(),
  maxScore: z.number(),
});

export const KeyParametersSchema = z.object({
  bidBondAmount: z.string().optional(),
  constructionPeriod: z.string().optional(),
  qualityStandard: z.string().optional(),
  warrantyPeriod: z.string().optional(),
});

export const ChapterStructureSchema = z.object({
  sectionNo: z.string(),
  title: z.string(),
  level: z.number(),
});

export const TenderAnalysisSchema = z.object({
  projectInfo: TenderAnalysisProjectInfoSchema,
  reviewItems: z.array(ReviewItemOutputSchema),
  scoringCriteria: z.array(ScoringCriterionSchema).optional(),
  keyParameters: KeyParametersSchema.optional(),
  chapterStructure: z.array(ChapterStructureSchema),
});

export type TenderAnalysisOutput = z.infer<typeof TenderAnalysisSchema>;

// ---------------------------------------------------------------------------
// 2. 投标文件样稿 (Bid Draft)
// ---------------------------------------------------------------------------

export const BidDraftSectionSchema = z.object({
  id: z.string(),
  sectionNo: z.string(),
  title: z.string(),
  content: z.string(),
  parentId: z.string().nullable(),
  linkedReviewItems: z.array(z.string()),
  linkedResponseItems: z.array(z.string()),
  scoringInfo: z
    .object({
      score: z.number(),
      weight: z.number(),
    })
    .optional(),
  status: z.enum(["generated", "edited", "empty"]),
});

export const BidDraftMetadataSchema = z.object({
  generatedAt: z.string(),
  templateUsed: z.string().optional(),
  modelUsed: z.string(),
});

export const BidDraftSchema = z.object({
  title: z.string(),
  sections: z.array(BidDraftSectionSchema),
  metadata: BidDraftMetadataSchema,
});

export type BidDraftOutput = z.infer<typeof BidDraftSchema>;

// ---------------------------------------------------------------------------
// 3. 风险清单 (Risk List)
// ---------------------------------------------------------------------------

export const RiskItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["废标", "格式", "合规", "业绩", "资质", "技术"]),
  severity: z.enum(["high", "medium", "low"]),
  description: z.string(),
  location: LocationSchema.optional(),
  legalBasis: z.string().optional(),
  suggestion: z.string().optional(),
});

export const RiskListSchema = z.object({
  projectId: z.string(),
  totalRisks: z.number(),
  summary: z.object({
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
  risks: z.array(RiskItemSchema),
});

export type RiskListOutput = z.infer<typeof RiskListSchema>;

// ---------------------------------------------------------------------------
// 4. 预审报告 (Review Report)
// ---------------------------------------------------------------------------

export const DimensionStatsSchema = z.object({
  dimension: z.string(),
  total: z.number(),
  passed: z.number(),
  failed: z.number(),
});

export const ReviewReportSchema = z.object({
  projectId: z.string(),
  score: z.number(),
  grade: z.enum(["A", "B", "C", "D"]),
  bidRejectionRisk: z.number(), // 0-100%
  riskSummary: z.object({
    total: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
  dimensionStats: z.array(DimensionStatsSchema),
  suggestions: z.array(z.string()),
  riskItems: z.array(z.string()), // 关联的风险项 ID
  generatedAt: z.string(),
});

export type ReviewReportOutput = z.infer<typeof ReviewReportSchema>;

// ---------------------------------------------------------------------------
// Union type + output type discriminator
// ---------------------------------------------------------------------------

export const OUTPUT_TYPES = ["analysis", "draft", "risks", "report"] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

/** Map from output type key to its corresponding zod schema */
export const OUTPUT_SCHEMA_MAP: Record<OutputType, z.ZodTypeAny> = {
  analysis: TenderAnalysisSchema,
  draft: BidDraftSchema,
  risks: RiskListSchema,
  report: ReviewReportSchema,
};

/** Discriminated union of all output payloads */
export const AnyOutputSchema = z.discriminatedUnion("__type", [
  TenderAnalysisSchema.extend({ __type: z.literal("analysis") }),
  BidDraftSchema.extend({ __type: z.literal("draft") }),
  RiskListSchema.extend({ __type: z.literal("risks") }),
  ReviewReportSchema.extend({ __type: z.literal("report") }),
]);

export type AnyOutput = z.infer<typeof AnyOutputSchema>;
