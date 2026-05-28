/**
 * Integration Service — M7 Integration Output Module
 *
 * Provides structured JSON outputs for the v1 REST API:
 * - Fetches and assembles output payloads for each of the 4 output types
 * - Validates API keys for v1 endpoint authentication
 * - Returns JSON Schema definitions for each output type
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  tenderProjects,
  documents,
  reviewReports,
  reviewIssues,
  extractionItems,
  reviewItemResults,
  responseItemResults,
  bidDocuments,
  organizations,
  users,
} from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import {
  OUTPUT_TYPES,
  OUTPUT_SCHEMA_MAP,
  TenderAnalysisSchema,
  BidDraftSchema,
  RiskListSchema,
  ReviewReportSchema,
  type OutputType,
  type TenderAnalysisOutput,
  type BidDraftOutput,
  type RiskListOutput,
  type ReviewReportOutput,
} from "@/lib/schemas/output-schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TenderProject = InferSelectModel<typeof tenderProjects>;
type Document = InferSelectModel<typeof documents>;
type ReviewReport = InferSelectModel<typeof reviewReports>;
type ReviewIssue = InferSelectModel<typeof reviewIssues>;
type ExtractionItem = InferSelectModel<typeof extractionItems>;
type BidDocument = InferSelectModel<typeof bidDocuments>;

export interface GetOutputOptions {
  format?: "full" | "minimal";
  callback?: string;
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class IntegrationService {
  // -----------------------------------------------------------------------
  // Validate API Key for v1 endpoints
  // -----------------------------------------------------------------------

  async validateApiKey(apiKey: string): Promise<{ organizationId: string } | null> {
    // API keys are stored as organization settings with a "integration_api_key" prefix
    // Format: "sk_live_<orgId>_<random>"
    if (!apiKey || !apiKey.startsWith("sk_live_")) {
      return null;
    }

    const parts = apiKey.replace("sk_live_", "").split("_");
    const orgId = parts[0];

    if (!orgId) {
      return null;
    }

    // Verify the organization exists
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      return null;
    }

    // In production, we would verify the full key against a stored hash.
    // For now, we verify the org exists and the key format is valid.
    return { organizationId: orgId };
  }

  // -----------------------------------------------------------------------
  // Get a specific output type for a project
  // -----------------------------------------------------------------------

  async getOutput(
    projectId: string,
    type: OutputType,
    options?: GetOutputOptions,
  ): Promise<object | null> {
    // Verify project exists
    const project = await db.query.tenderProjects.findFirst({
      where: eq(tenderProjects.id, projectId),
    });

    if (!project) {
      return null;
    }

    switch (type) {
      case "analysis":
        return this.getAnalysisOutput(projectId, options);
      case "draft":
        return this.getDraftOutput(projectId, options);
      case "risks":
        return this.getRiskListOutput(projectId, options);
      case "report":
        return this.getReportOutput(projectId, options);
      default:
        return null;
    }
  }

  // -----------------------------------------------------------------------
  // Get JSON Schema definition for an output type
  // -----------------------------------------------------------------------

  async getSchema(type: string): Promise<object | null> {
    const validType = OUTPUT_TYPES.find((t) => t === type) as
      | OutputType
      | undefined;

    if (!validType) {
      return null;
    }

    const schema = OUTPUT_SCHEMA_MAP[validType];
    return schema;
  }

  // -----------------------------------------------------------------------
  // 1. Tender Analysis Output
  // -----------------------------------------------------------------------

  private async getAnalysisOutput(
    projectId: string,
    options?: GetOutputOptions,
  ): Promise<TenderAnalysisOutput | null> {
    const project = await db.query.tenderProjects.findFirst({
      where: eq(tenderProjects.id, projectId),
    });

    if (!project) return null;

    // Fetch extraction items (review checkpoints)
    const items = await db
      .select()
      .from(extractionItems)
      .where(eq(extractionItems.projectId, projectId))
      .orderBy(desc(extractionItems.createdAt));

    // Fetch documents for chapter structure
    const projectDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId));

    // Map extraction items to review item output schema
    const reviewItems = items.map((item, idx) => ({
      id: item.id,
      itemType: (item.section === "商务标" ? "commercial" : "technical") as
        | "qualification"
        | "compliance"
        | "technical"
        | "commercial"
        | "key_parameters"
        | "experience"
        | "personnel",
      title: item.title,
      description: item.checkpoint,
      severity: item.consequence
        ? Number(item.consequence) > 0.7
          ? "high" as const
          : Number(item.consequence) > 0.3
            ? "medium" as const
            : "low" as const
        : undefined,
      location: options?.format !== "minimal"
        ? {
            page: 0,
            blockId: undefined,
          }
        : undefined,
    }));

    // Build project info from the tender project record
    const projectInfo = {
      projectName: project.name,
      projectNumber: project.projectNo,
      tenderDeadline: project.deadline?.toISOString(),
      bidBondAmount: project.budget?.toString(),
      evaluationMethod: project.tenderType ?? undefined,
    };

    // Build chapter structure from documents
    const chapterStructure = projectDocs.map((doc, idx) => ({
      sectionNo: String(idx + 1),
      title: doc.name,
      level: 1,
    }));

    const result: TenderAnalysisOutput = {
      projectInfo,
      reviewItems,
      chapterStructure,
    };

    return result;
  }

  // -----------------------------------------------------------------------
  // 2. Bid Draft Output
  // -----------------------------------------------------------------------

  private async getDraftOutput(
    projectId: string,
    options?: GetOutputOptions,
  ): Promise<BidDraftOutput | null> {
    const bidDoc = await db.query.bidDocuments.findFirst({
      where: eq(bidDocuments.projectId, projectId),
      orderBy: desc(bidDocuments.createdAt),
    });

    if (!bidDoc) return null;

    const sections = Array.isArray(bidDoc.sections)
      ? (bidDoc.sections as Array<{
          id?: string;
          sectionNo?: string;
          title?: string;
          content?: string;
          parentId?: string | null;
          linkedReviewItems?: string[];
          linkedResponseItems?: string[];
          scoringInfo?: { score: number; weight: number };
          status?: string;
        }>)
      : [];

    const result: BidDraftOutput = {
      title: bidDoc.title,
      sections: sections.map((s) => ({
        id: s.id ?? "",
        sectionNo: s.sectionNo ?? "",
        title: s.title ?? "",
        content: s.content ?? "",
        parentId: s.parentId ?? null,
        linkedReviewItems: s.linkedReviewItems ?? [],
        linkedResponseItems: s.linkedResponseItems ?? [],
        scoringInfo: s.scoringInfo,
        status: (s.status as "generated" | "edited" | "empty") ?? "empty",
      })),
      metadata: {
        generatedAt: bidDoc.createdAt?.toISOString() ?? new Date().toISOString(),
        templateUsed: undefined,
        modelUsed: (bidDoc.metadata as Record<string, string>)?.modelUsed ?? "unknown",
      },
    };

    return result;
  }

  // -----------------------------------------------------------------------
  // 3. Risk List Output
  // -----------------------------------------------------------------------

  private async getRiskListOutput(
    projectId: string,
    options?: GetOutputOptions,
  ): Promise<RiskListOutput | null> {
    // Get the latest review report for the project
    const report = await db.query.reviewReports.findFirst({
      where: eq(reviewReports.projectId, projectId),
      orderBy: desc(reviewReports.createdAt),
    });

    if (!report) return null;

    // Fetch issues for the report
    const issues = await db
      .select()
      .from(reviewIssues)
      .where(eq(reviewIssues.reportId, report.id))
      .orderBy(desc(reviewIssues.createdAt));

    // Map issues to risk items
    const risks = issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      type: this.mapCategoryToRiskType(issue.category),
      severity: this.mapSeverity(issue.severity),
      description: issue.description,
      location:
        options?.format !== "minimal" && issue.location
          ? {
              page: (issue.location as Record<string, number>)?.pageNumber ?? 0,
              blockId: (issue.location as Record<string, string>)?.blockId,
              text: (issue.location as Record<string, string>)?.textSnippet,
            }
          : undefined,
      legalBasis: undefined,
      suggestion: issue.suggestion ?? undefined,
    }));

    const summary = {
      high: risks.filter((r) => r.severity === "high").length,
      medium: risks.filter((r) => r.severity === "medium").length,
      low: risks.filter((r) => r.severity === "low").length,
    };

    const result: RiskListOutput = {
      projectId,
      totalRisks: risks.length,
      summary,
      risks,
    };

    return result;
  }

  // -----------------------------------------------------------------------
  // 4. Review Report Output
  // -----------------------------------------------------------------------

  private async getReportOutput(
    projectId: string,
    options?: GetOutputOptions,
  ): Promise<ReviewReportOutput | null> {
    const report = await db.query.reviewReports.findFirst({
      where: eq(reviewReports.projectId, projectId),
      orderBy: desc(reviewReports.createdAt),
    });

    if (!report) return null;

    // Fetch review item results for dimension stats
    const itemResults = await db
      .select()
      .from(reviewItemResults)
      .where(eq(reviewItemResults.reportId, report.id));

    // Build dimension stats from results
    const dimensionMap = new Map<string, { total: number; passed: number; failed: number }>();
    for (const result of itemResults) {
      const dim = (result.metadata as Record<string, string>)?.dimension ?? "未分类";
      const stats = dimensionMap.get(dim) ?? { total: 0, passed: 0, failed: 0 };
      stats.total++;
      if (result.status === "pass") stats.passed++;
      if (result.status === "fail") stats.failed++;
      dimensionMap.set(dim, stats);
    }

    const dimensionStats = Array.from(dimensionMap.entries()).map(
      ([dimension, counts]) => ({
        dimension,
        ...counts,
      }),
    );

    // Fetch issues for risk summary
    const issues = await db
      .select()
      .from(reviewIssues)
      .where(eq(reviewIssues.reportId, report.id));

    const highRisks = issues.filter((i) => i.severity === "critical" || i.severity === "major").length;
    const mediumRisks = issues.filter((i) => i.severity === "minor").length;
    const lowRisks = issues.filter((i) => i.severity === "suggestion").length;

    const score = report.finalScore ? Number(report.finalScore) : report.aiScore ? Number(report.aiScore) : 0;
    const grade = this.scoreToGrade(score);

    const result: ReviewReportOutput = {
      projectId,
      score,
      grade,
      bidRejectionRisk: highRisks > 0 ? Math.min(highRisks * 20, 100) : 0,
      riskSummary: {
        total: issues.length,
        high: highRisks,
        medium: mediumRisks,
        low: lowRisks,
      },
      dimensionStats,
      suggestions: issues
        .filter((i) => i.suggestion)
        .map((i) => i.suggestion!)
        .slice(0, 10),
      riskItems: issues.map((i) => i.id),
      generatedAt: report.completedAt?.toISOString() ?? report.createdAt?.toISOString() ?? new Date().toISOString(),
    };

    return result;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private mapCategoryToRiskType(category: string): "废标" | "格式" | "合规" | "业绩" | "资质" | "技术" {
    const mapping: Record<string, "废标" | "格式" | "合规" | "业绩" | "资质" | "技术"> = {
      qualification: "资质",
      experience: "业绩",
      compliance: "合规",
      technical: "技术",
      format: "格式",
      bid_rejection: "废标",
    };
    return mapping[category] ?? "合规";
  }

  private mapSeverity(
    severity: string,
  ): "high" | "medium" | "low" {
    const mapping: Record<string, "high" | "medium" | "low"> = {
      critical: "high",
      major: "high",
      minor: "medium",
      suggestion: "low",
    };
    return mapping[severity] ?? "medium";
  }

  private scoreToGrade(score: number): "A" | "B" | "C" | "D" {
    if (score >= 90) return "A";
    if (score >= 75) return "B";
    if (score >= 60) return "C";
    return "D";
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const integrationService = new IntegrationService();
