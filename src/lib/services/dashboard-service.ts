/**
 * Dashboard Service — M7 Dashboard Module
 *
 * Aggregates data from multiple tables for the master control dashboard:
 * - Overview statistics (projects, documents, reports, issues)
 * - Tender analysis metrics (extraction items by type)
 * - Bid analysis metrics (draft generation stats)
 * - Risk insights (severity distribution, category breakdown)
 * - Knowledge base stats (items, vectorized status)
 * - Model usage metrics (call logs by model, agent, status)
 * - Team activity (recent actions by user)
 */

import { eq, and, gte, lte, inArray, sql, desc, count } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  tenderProjects,
  documents,
  reviewReports,
  reviewIssues,
  extractionItems,
  bidDocuments,
  knowledgeBases,
  knowledgeItems,
  agentCallLogs,
  agentDefinitions,
  aiModels,
  users,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardOverview {
  projectsCount: number;
  documents: { total: number; pending: number; processing: number; completed: number; failed: number };
  reports: { total: number; pending: number; in_progress: number; completed: number; avgScore: number | null };
  issues: { total: number; critical: number; major: number; minor: number; suggestion: number; resolved: number };
}

export interface TenderMetrics {
  totalExtractionItems: number;
  bySection: Array<{ section: string; count: number }>;
  topProjects: Array<{ projectId: string; name: string; itemCount: number }>;
}

export interface BidMetrics {
  totalDrafts: number;
  avgSections: number;
  recentDrafts: Array<{ id: string; title: string; createdAt: string }>;
}

export interface RiskInsights {
  bySeverity: Array<{ severity: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  highRiskProjects: Array<{ projectId: string; name: string; criticalCount: number }>;
}

export interface KnowledgeStats {
  totalBases: number;
  totalItems: number;
  vectorizedItems: number;
  byType: Array<{ type: string; count: number }>;
}

export interface ModelUsage {
  totalCalls: number;
  successRate: number;
  avgDurationMs: number | null;
  byModel: Array<{ modelId: string; modelName: string; calls: number; avgTokens: number }>;
  byAgent: Array<{ agentKey: string; agentName: string; calls: number }>;
  byDay: Array<{ date: string; calls: number }>;
}

export interface TeamActivity {
  recentActions: Array<{
    userId: string;
    userName: string;
    action: string;
    detail: string;
    createdAt: string;
  }>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DashboardService {

  // -----------------------------------------------------------------------
  // Overview stats
  // -----------------------------------------------------------------------

  async getOverview(orgId: string): Promise<DashboardOverview> {
    const projects = await db.query.tenderProjects.findMany({
      where: eq(tenderProjects.orgId, orgId),
      columns: { id: true },
    });
    const projectIds = projects.map((p) => p.id);

    if (projectIds.length === 0) {
      return {
        projectsCount: 0,
        documents: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
        reports: { total: 0, pending: 0, in_progress: 0, completed: 0, avgScore: null },
        issues: { total: 0, critical: 0, major: 0, minor: 0, suggestion: 0, resolved: 0 },
      };
    }

    // Document status aggregation
    const docAgg = await db
      .select({
        status: documents.parseStatus,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(documents)
      .where(inArray(documents.projectId, projectIds))
      .groupBy(documents.parseStatus);

    const docCounts = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    for (const r of docAgg) {
      const k = (r.status ?? "pending") as keyof typeof docCounts;
      if (k in docCounts) docCounts[k] += r.count;
      docCounts.total += r.count;
    }

    // Report status aggregation
    const reportAgg = await db
      .select({
        status: reviewReports.status,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(reviewReports)
      .where(inArray(reviewReports.projectId, projectIds))
      .groupBy(reviewReports.status);

    const avgScore = await db
      .select({ avg: sql<number | null>`avg(${reviewReports.aiScore})` })
      .from(reviewReports)
      .where(
        and(
          inArray(reviewReports.projectId, projectIds),
          eq(reviewReports.status, "completed"),
        ),
      );

    const reportCounts = { total: 0, pending: 0, in_progress: 0, completed: 0, avgScore: null as number | null };
    for (const r of reportAgg) {
      const s = (r.status ?? "pending") as keyof typeof reportCounts;
      if (s === "pending") reportCounts.pending += r.count;
      if (s === "in_progress") reportCounts.in_progress += r.count;
      if (s === "completed") reportCounts.completed += r.count;
      reportCounts.total += r.count;
    }
    reportCounts.avgScore = avgScore[0]?.avg != null ? Number(avgScore[0].avg) : null;

    // Issues aggregation
    const scopedReports = await db
      .select({ id: reviewReports.id })
      .from(reviewReports)
      .where(inArray(reviewReports.projectId, projectIds));
    const reportIds = scopedReports.map((r) => r.id);

    const issuesResult = { total: 0, critical: 0, major: 0, minor: 0, suggestion: 0, resolved: 0 };

    if (reportIds.length > 0) {
      const sevAgg = await db
        .select({
          severity: reviewIssues.severity,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(reviewIssues)
        .where(inArray(reviewIssues.reportId, reportIds))
        .groupBy(reviewIssues.severity);

      for (const r of sevAgg) {
        const sev = r.severity as keyof Omit<typeof issuesResult, "total" | "resolved">;
        if (sev in issuesResult) issuesResult[sev] += r.count;
        issuesResult.total += r.count;
      }

      const resolvedCount = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(reviewIssues)
        .where(
          and(
            inArray(reviewIssues.reportId, reportIds),
            eq(reviewIssues.isResolved, true),
          ),
        );
      issuesResult.resolved = resolvedCount[0]?.count ?? 0;
    }

    return {
      projectsCount: projectIds.length,
      documents: docCounts,
      reports: reportCounts,
      issues: issuesResult,
    };
  }

  // -----------------------------------------------------------------------
  // Tender analysis metrics
  // -----------------------------------------------------------------------

  async getTenderMetrics(orgId: string): Promise<TenderMetrics> {
    const projects = await db.query.tenderProjects.findMany({
      where: eq(tenderProjects.orgId, orgId),
      columns: { id: true, name: true },
    });
    const projectIds = projects.map((p) => p.id);

    if (projectIds.length === 0) {
      return { totalExtractionItems: 0, bySection: [], topProjects: [] };
    }

    const totalResult = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(extractionItems)
      .where(inArray(extractionItems.projectId, projectIds));
    const totalExtractionItems = totalResult[0]?.count ?? 0;

    const sectionAgg = await db
      .select({
        section: extractionItems.section,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(extractionItems)
      .where(inArray(extractionItems.projectId, projectIds))
      .groupBy(extractionItems.section)
      .orderBy(desc(sql`count(*)`));

    const bySection = sectionAgg.map((r) => ({
      section: r.section ?? "未分类",
      count: r.count,
    }));

    const topProjAgg = await db
      .select({
        projectId: extractionItems.projectId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(extractionItems)
      .where(inArray(extractionItems.projectId, projectIds))
      .groupBy(extractionItems.projectId)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    const topProjects = topProjAgg.map((r) => {
      const proj = projects.find((p) => p.id === r.projectId);
      return {
        projectId: r.projectId ?? "",
        name: proj?.name ?? "未知项目",
        itemCount: r.count,
      };
    });

    return { totalExtractionItems, bySection, topProjects };
  }

  // -----------------------------------------------------------------------
  // Bid analysis metrics
  // -----------------------------------------------------------------------

  async getBidMetrics(orgId: string): Promise<BidMetrics> {
    const projects = await db.query.tenderProjects.findMany({
      where: eq(tenderProjects.orgId, orgId),
      columns: { id: true },
    });
    const projectIds = projects.map((p) => p.id);

    if (projectIds.length === 0) {
      return { totalDrafts: 0, avgSections: 0, recentDrafts: [] };
    }

    const drafts = await db
      .select()
      .from(bidDocuments)
      .where(inArray(bidDocuments.projectId, projectIds))
      .orderBy(desc(bidDocuments.createdAt))
      .limit(20);

    const totalDrafts = drafts.length;
    const sectionCounts = drafts.map((d) => {
      const sections = d.sections as Array<unknown> | null;
      return Array.isArray(sections) ? sections.length : 0;
    });
    const avgSections = totalDrafts > 0
      ? Math.round(sectionCounts.reduce((a, b) => a + b, 0) / totalDrafts)
      : 0;

    const recentDrafts = drafts.slice(0, 5).map((d) => ({
      id: d.id,
      title: d.title,
      createdAt: d.createdAt?.toISOString() ?? new Date().toISOString(),
    }));

    return { totalDrafts, avgSections, recentDrafts };
  }

  // -----------------------------------------------------------------------
  // Risk insights
  // -----------------------------------------------------------------------

  async getRiskInsights(orgId: string): Promise<RiskInsights> {
    const projects = await db.query.tenderProjects.findMany({
      where: eq(tenderProjects.orgId, orgId),
      columns: { id: true, name: true },
    });
    const projectIds = projects.map((p) => p.id);

    if (projectIds.length === 0) {
      return { bySeverity: [], byCategory: [], highRiskProjects: [] };
    }

    const scopedReports = await db
      .select({ id: reviewReports.id })
      .from(reviewReports)
      .where(inArray(reviewReports.projectId, projectIds));
    const reportIds = scopedReports.map((r) => r.id);

    if (reportIds.length === 0) {
      return { bySeverity: [], byCategory: [], highRiskProjects: [] };
    }

    const sevAgg = await db
      .select({
        severity: reviewIssues.severity,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(reviewIssues)
      .where(inArray(reviewIssues.reportId, reportIds))
      .groupBy(reviewIssues.severity);

    const bySeverity = sevAgg.map((r) => ({
      severity: r.severity ?? "unknown",
      count: r.count,
    }));

    const catAgg = await db
      .select({
        category: reviewIssues.category,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(reviewIssues)
      .where(inArray(reviewIssues.reportId, reportIds))
      .groupBy(reviewIssues.category)
      .orderBy(desc(sql`count(*)`))
      .limit(8);

    const byCategory = catAgg.map((r) => ({
      category: r.category ?? "未分类",
      count: r.count,
    }));

    // High-risk projects (most critical issues)
    const criticalByProject = await db
      .select({
        reportId: reviewIssues.reportId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(reviewIssues)
      .where(
        and(
          inArray(reviewIssues.reportId, reportIds),
          sql`${reviewIssues.severity} in ('critical', 'major')`,
        ),
      )
      .groupBy(reviewIssues.reportId)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    // Resolve report -> project
    const highRiskProjects: RiskInsights["highRiskProjects"] = [];
    for (const row of criticalByProject) {
      const report = await db.query.reviewReports.findFirst({
        where: eq(reviewReports.id, row.reportId),
        columns: { projectId: true },
      });
      if (report?.projectId) {
        const proj = projects.find((p) => p.id === report.projectId);
        highRiskProjects.push({
          projectId: report.projectId,
          name: proj?.name ?? "未知项目",
          criticalCount: row.count,
        });
      }
    }

    return { bySeverity, byCategory, highRiskProjects };
  }

  // -----------------------------------------------------------------------
  // Knowledge base stats
  // -----------------------------------------------------------------------

  async getKnowledgeStats(orgId: string): Promise<KnowledgeStats> {
    const bases = await db.query.knowledgeBases.findMany({
      where: eq(knowledgeBases.organizationId, orgId),
      columns: { id: true },
    });

    const totalBases = bases.length;
    const baseIds = bases.map((b) => b.id);

    if (baseIds.length === 0) {
      return { totalBases: 0, totalItems: 0, vectorizedItems: 0, byType: [] };
    }

    const totalResult = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(knowledgeItems)
      .where(inArray(knowledgeItems.knowledgeBaseId, baseIds));
    const totalItems = totalResult[0]?.count ?? 0;

    const vectorizedResult = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(knowledgeItems)
      .where(
        and(
          inArray(knowledgeItems.knowledgeBaseId, baseIds),
          eq(knowledgeItems.isVectorized, true),
        ),
      );
    const vectorizedItems = vectorizedResult[0]?.count ?? 0;

    const typeAgg = await db
      .select({
        source: knowledgeItems.source,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(knowledgeItems)
      .where(inArray(knowledgeItems.knowledgeBaseId, baseIds))
      .groupBy(knowledgeItems.source);

    const byType = typeAgg.map((r) => ({
      type: r.source ?? "unknown",
      count: r.count,
    }));

    return { totalBases, totalItems, vectorizedItems, byType };
  }

  // -----------------------------------------------------------------------
  // Model usage
  // -----------------------------------------------------------------------

  async getModelUsage(orgId: string, days = 30): Promise<ModelUsage> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const allLogs = await db
      .select()
      .from(agentCallLogs)
      .where(
        and(
          eq(agentCallLogs.organizationId, orgId),
          gte(agentCallLogs.createdAt, since),
        ),
      );

    const totalCalls = allLogs.length;
    const successCalls = allLogs.filter((l) => l.status === "success").length;
    const successRate = totalCalls > 0 ? Math.round((successCalls / totalCalls) * 100) : 0;
    const avgDurationMs = totalCalls > 0
      ? Math.round(allLogs.reduce((sum, l) => sum + (l.durationMs ?? 0), 0) / totalCalls)
      : null;

    // By model
    const modelMap = new Map<string, { calls: number; totalTokens: number }>();
    for (const log of allLogs) {
      if (!log.modelId) continue;
      const entry = modelMap.get(log.modelId) ?? { calls: 0, totalTokens: 0 };
      entry.calls++;
      entry.totalTokens += (log.inputTokens ?? 0) + (log.outputTokens ?? 0);
      modelMap.set(log.modelId, entry);
    }

    const byModel: ModelUsage["byModel"] = [];
    for (const [modelId, data] of modelMap.entries()) {
      const model = await db.query.aiModels.findFirst({
        where: eq(aiModels.id, modelId),
        columns: { name: true },
      });
      byModel.push({
        modelId,
        modelName: model?.name ?? "未知模型",
        calls: data.calls,
        avgTokens: data.calls > 0 ? Math.round(data.totalTokens / data.calls) : 0,
      });
    }

    // By agent
    const agentMap = new Map<string, number>();
    for (const log of allLogs) {
      if (!log.agentId) continue;
      agentMap.set(log.agentId, (agentMap.get(log.agentId) ?? 0) + 1);
    }

    const byAgent: ModelUsage["byAgent"] = [];
    for (const [agentId, calls] of agentMap.entries()) {
      const agent = await db.query.agentDefinitions.findFirst({
        where: eq(agentDefinitions.id, agentId),
        columns: { agentKey: true, name: true },
      });
      byAgent.push({
        agentKey: agent?.agentKey ?? "unknown",
        agentName: agent?.name ?? "未知智能体",
        calls,
      });
    }

    // By day (for trend chart)
    const dayMap = new Map<string, number>();
    for (const log of allLogs) {
      const day = (log.createdAt as Date).toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    }
    const byDay = Array.from(dayMap.entries())
      .map(([date, calls]) => ({ date, calls }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { totalCalls, successRate, avgDurationMs, byModel, byAgent, byDay };
  }

  // -----------------------------------------------------------------------
  // Team activity
  // -----------------------------------------------------------------------

  async getTeamActivity(orgId: string, limit = 10): Promise<TeamActivity> {
    const recentLogs = await db
      .select()
      .from(agentCallLogs)
      .where(eq(agentCallLogs.organizationId, orgId))
      .orderBy(desc(agentCallLogs.createdAt))
      .limit(limit);

    const recentActions: TeamActivity["recentActions"] = [];
    for (const log of recentLogs) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, log.userId),
        columns: { name: true },
      });

      const agent = log.agentId
        ? await db.query.agentDefinitions.findFirst({
            where: eq(agentDefinitions.id, log.agentId),
            columns: { name: true, agentKey: true },
          })
        : null;

      recentActions.push({
        userId: log.userId,
        userName: user?.name ?? "未知用户",
        action: log.status === "success" ? "调用成功" : log.status === "failed" ? "调用失败" : "超时",
        detail: agent ? `${agent.agentKey} ${agent.name}` : log.errorMessage ?? "",
        createdAt: (log.createdAt as Date).toISOString(),
      });
    }

    return { recentActions };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const dashboardService = new DashboardService();
