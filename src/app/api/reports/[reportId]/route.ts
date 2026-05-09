import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { reviewReports } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ reportId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reportId } = await context.params;

  try {
    const report = await db.query.reviewReports.findFirst({
      where: eq(reviewReports.id, reportId),
      with: {
        document: {
          columns: {
            id: true,
            name: true,
            docType: true,
            parseStatus: true,
          },
        },
        project: {
          columns: {
            id: true,
            name: true,
            projectNo: true,
            orgId: true,
          },
        },
        reviewer: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        issues: {
          columns: {
            id: true,
            category: true,
            severity: true,
            title: true,
            description: true,
            location: true,
            suggestion: true,
            isResolved: true,
            createdAt: true,
          },
        },
        reviewItemResults: {
          with: {
            reviewItem: {
              columns: {
                id: true,
                itemType: true,
                itemNo: true,
                title: true,
                description: true,
                consequence: true,
              },
            },
          },
        },
        responseItemResults: {
          with: {
            responseItem: {
              columns: {
                id: true,
                responseType: true,
                itemNo: true,
                title: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!report || report.project?.orgId !== session.user?.orgId) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const responseCoverageSummary = {
      total: report.responseItemResults.length,
      answered: report.responseItemResults.filter((item) => item.status === "answered").length,
      partiallyAnswered: report.responseItemResults.filter((item) => item.status === "partially_answered").length,
      unanswered: report.responseItemResults.filter((item) => item.status === "unanswered").length,
      notApplicable: report.responseItemResults.filter((item) => item.status === "not_applicable").length,
    };

    const reviewItemsSummary = {
      total: report.reviewItemResults.length,
      pass: report.reviewItemResults.filter((item) => item.status === "pass").length,
      fail: report.reviewItemResults.filter((item) => item.status === "fail").length,
      needsManualReview: report.reviewItemResults.filter((item) => item.status === "needs_manual_review").length,
    };

    return NextResponse.json({
      report: {
        ...report,
        structuredSummary: {
          responseCoverageSummary,
          reviewItemsSummary,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch review report:", error);
    return NextResponse.json({ error: "Failed to fetch review report" }, { status: 500 });
  }
}
